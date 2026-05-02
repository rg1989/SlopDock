import { Bot, type Context } from 'grammy';
import path from 'path';
import os from 'os';
import { readFile } from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { spawnSession } from './pty-manager.js';
import { registry } from './session-registry.js';
import { loadTelegramConfig } from './telegram-config.js';
import { resolveProjectFolderName, listAllProjects, shellSingleQuotedPath } from './project-resolve.js';
import type { ServerMessage } from '../shared/protocol.js';
import { getTelegramBotToken, TELEGRAM_CONFIG_PATH, loadChatSessions, saveChatSession } from './telegram-persist.js';
import { transcribe, getWhisperStatus, checkWhisper } from './whisper-stt.js';
import { fetchTelegramFileBuffer, saveTelegramFileToInbound } from './telegram-media.js';
import { chunkTextForTelegram } from './telegram-chunk.js';

const execFileAsync = promisify(execFile);

const SLOP_DIR = path.join(os.homedir(), '.slop');
const SETTINGS_FILE = path.join(SLOP_DIR, 'settings.json');

const SESSION_PREFIX = 'tg:';
const TELEGRAM_CHUNK = 3800;
const PTY_COLS = 120;
const PTY_ROWS = 40;
const OUTPUT_DEBOUNCE_MS = 420;

let botInstance: Bot<Context> | null = null;

type ChatState = { lastProjectPath: string | null };
const chatState = new Map<number, ChatState>();

type FlushState = { timer: ReturnType<typeof setTimeout> | null; buf: string; suppressUntil: number };
const outputFlush = new Map<string, FlushState>();

const inboundChain = new Map<number, Promise<void>>();

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Batch Telegram albums (same media_group_id) before one Composer turn. */
type AlbumItem =
  | { t: 'photo'; fileId: string; fileSize?: number }
  | { t: 'doc'; fileId: string; fileSize?: number; name: string };

type AlbumBuf = {
  items: AlbumItem[];
  caption: string;
  timer: ReturnType<typeof setTimeout> | null;
  notified: boolean;
};

const albumBuffers = new Map<string, AlbumBuf>();
const ALBUM_DEBOUNCE_MS = 800;

function albumBufferKey(chatId: number, groupId: string): string {
  return `${chatId}:${groupId}`;
}

async function flushAlbumBuffer(key: string, ctx: Context, chatId: number, token: string): Promise<void> {
  const buf = albumBuffers.get(key);
  albumBuffers.delete(key);
  if (!buf || buf.items.length === 0) return;

  chainInbound(chatId, async () => {
    const paths: string[] = [];
    for (const it of buf.items) {
      const gf = await ctx.api.getFile(it.fileId);
      if (!gf.file_path) continue;
      const suggested =
        it.t === 'photo'
          ? path.basename(gf.file_path) || 'photo.jpg'
          : it.name || path.basename(gf.file_path) || 'file';
      const saved = await saveTelegramFileToInbound({
        botToken: token,
        telegramFilePath: gf.file_path,
        chatId,
        suggestedName: suggested,
        knownSize: it.fileSize,
      });
      if (saved.ok) paths.push(saved.absolutePath);
    }
    if (paths.length === 0) {
      await ctx.reply('Could not save media group files.');
      return;
    }
    await ctx.reply(`Saved ${paths.length} file(s).`);
    await deliverTelegramTurn(ctx, chatId, buf.caption, paths);
  });
}

function scheduleAlbumItem(
  ctx: Context,
  chatId: number,
  token: string,
  groupId: string,
  item: AlbumItem,
  caption: string,
): void {
  const k = albumBufferKey(chatId, groupId);
  let b = albumBuffers.get(k);
  if (!b) {
    b = { items: [], caption: '', timer: null, notified: false };
    albumBuffers.set(k, b);
  }
  b.items.push(item);
  if (caption.trim()) b.caption = caption.trim();
  if (!b.notified) {
    b.notified = true;
    void ctx.reply('Collecting media group…');
  }
  if (b.timer) clearTimeout(b.timer);
  b.timer = setTimeout(() => {
    void flushAlbumBuffer(k, ctx, chatId, token);
  }, ALBUM_DEBOUNCE_MS);
}

function stripAnsi(s: string): string {
  return s
    .replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, '')   // OSC sequences (terminal titles, etc.)
    .replace(/\x1b\[[\x30-\x3f]*[\x20-\x2f]*[\x40-\x7e]/g, '') // CSI sequences (includes ?2026l, private modes)
    .replace(/\x1b[@-Z\\-_]/g, '');                    // other single-char ESC sequences
}

/** Simulate terminal line overwriting: \r without following \n resets the current line. */
function resolveCarriageReturns(s: string): string {
  const out: string[] = [];
  let line = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (ch === '\n') {
      out.push(line);
      line = '';
    } else if (ch === '\r' && s[i + 1] !== '\n') {
      line = '';
    } else {
      line += ch;
    }
  }
  if (line) out.push(line);
  return out.join('\n');
}

/** Strip Claude Code UI chrome: spinners, status lines, progress bars, prompts. */
function filterClaudeStatusLines(s: string): string {
  const kept: string[] = [];
  for (const raw of s.split('\n')) {
    const t = raw.trim();
    if (!t) continue;
    // Braille spinner / pure-symbol lines (animation frames)
    if (/^[⠀-⣿\s✢✳✶✻✽·❯─▶⏺]+$/.test(t)) continue;
    // Claude Code status phrases (short lines only — avoid filtering real content)
    if (t.length < 120 && /Deliberating|thinking with|running stop hooks|stop hooks|\.\.\.$/.test(t)) continue;
    // Token / timing counters  e.g. "↓ 51 tokens · 5s"
    if (/^[↑↓]\s*\d/.test(t)) continue;
    // Progress bars  e.g. "█░░░░░░░░░ 13%"
    if (/^[█░▓▒▌▍▎▏\s]+(\d+%)?$/.test(t)) continue;
    // Status bar line  e.g. "⬆/gsd:update │Sonnet4.6│…"
    if (/^⬆.*│/.test(t)) continue;
    // Idle prompt line
    if (/^❯\s*$/.test(t)) continue;
    // Divider lines
    if (/^─{4,}/.test(t)) continue;
    // Strip ⏺ response-marker prefix but keep the content that follows
    kept.push(t.replace(/^⏺\s*/, ''));
  }
  return kept.join('\n').trim();
}

function clearOutputFlush(sessionId: string): void {
  const st = outputFlush.get(sessionId);
  if (st?.timer) clearTimeout(st.timer);
  outputFlush.delete(sessionId);
}

function suppressTelegramOutput(sessionId: string, durationMs: number): void {
  let st = outputFlush.get(sessionId);
  if (!st) {
    st = { timer: null, buf: '', suppressUntil: 0 };
    outputFlush.set(sessionId, st);
  }
  st.suppressUntil = Date.now() + durationMs;
}

function scheduleTelegramOutput(sessionId: string, chatId: number, api: Bot<Context>['api'], chunk: string): void {
  let st = outputFlush.get(sessionId);
  if (!st) {
    st = { timer: null, buf: '', suppressUntil: 0 };
    outputFlush.set(sessionId, st);
  }
  if (Date.now() < st.suppressUntil) return;
  st.buf += chunk;
  if (st.timer) clearTimeout(st.timer);
  st.timer = setTimeout(() => {
    const raw = st!.buf;
    st!.buf = '';
    st!.timer = null;
    const text = filterClaudeStatusLines(resolveCarriageReturns(stripAnsi(raw)));
    if (!text) return;
    const parts = chunkTextForTelegram(text, TELEGRAM_CHUNK);
    void (async () => {
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i]!;
        try {
          await api.sendMessage(chatId, p);
        } catch (e) {
          const msg = String(e);
          console.error('[telegram] sendMessage failed:', e);
          if (msg.includes('429') || msg.toLowerCase().includes('flood')) {
            await sleep(2600);
            try {
              await api.sendMessage(chatId, p);
            } catch (e2) {
              console.error('[telegram] sendMessage retry failed:', e2);
            }
          }
        }
        if (i < parts.length - 1) await sleep(55);
      }
    })();
  }, OUTPUT_DEBOUNCE_MS);
}

function chainInbound(chatId: number, fn: () => Promise<void>): void {
  const prev = inboundChain.get(chatId) ?? Promise.resolve();
  const next = prev.then(fn).catch((e) => console.error('[telegram] inbound:', e));
  inboundChain.set(chatId, next);
}

async function loadAgentFromSlopSettings(): Promise<{ command: string; args: string[] }> {
  try {
    const raw = await readFile(SETTINGS_FILE, 'utf-8');
    const s = JSON.parse(raw) as { agent?: { command?: string; args?: string[] } };
    if (s.agent?.command?.trim()) {
      return { command: s.agent.command.trim(), args: Array.isArray(s.agent.args) ? s.agent.args : [] };
    }
  } catch {
    /* default */
  }
  return { command: 'claude', args: [] };
}

async function whichCmd(cmd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('which', [cmd]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

function sessionIdForChat(chatId: number): string {
  return `${SESSION_PREFIX}${chatId}`;
}

/**
 * Translate Telegram-safe command names (underscores) back to Claude Code names (hyphens/colons).
 * Only applies when the message is a bare slash command (no spaces, no other content).
 * e.g. "/security_review" → "/security-review", "/full_feature" → "/full-feature"
 */
function translateTelegramCommand(text: string): string {
  const bare = text.trim();
  if (!bare.startsWith('/')) return bare;
  // Only translate if it looks like a bare command (no spaces → no args)
  const [cmd, ...rest] = bare.split(' ');
  if (!cmd) return bare;
  const translated = cmd.replace(/^\//, '').replace(/_/g, '-');
  const parts = rest.length ? [translated, ...rest] : [translated];
  return '/' + parts.join(' ');
}

/** Parse leading `PROJECT=name` or `PROJECT: name` line; remainder is body. */
export function parseTelegramProjectLine(text: string): { project?: string; body: string } {
  const lines = text.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i++;
  if (i >= lines.length) return { body: '' };
  const first = lines[i]!.trim();
  const m = /^PROJECT\s*[=:]\s*(.+)$/i.exec(first);
  if (!m) return { body: text.trim() };
  const project = m[1]!.trim();
  const rest = lines.slice(i + 1).join('\n').replace(/^\s*\n/, '');
  return { project, body: rest.trim() };
}

/** Same shape as browser Composer: `@/abs/path` lines then body (SlopMop/client/components/Composer.tsx). */
function buildComposerStyleMessage(paths: string[], body: string): string {
  const atPaths = paths.map((p) => `@${p}`).join(' ');
  const trimmed = body.trim();
  if (atPaths && trimmed) return `${atPaths}\n${trimmed}`;
  if (atPaths) return `${atPaths}\n`;
  return trimmed;
}

function ensurePrivateChat(ctx: Context): boolean {
  return ctx.chat?.type === 'private';
}

async function ensureSession(
  chatId: number,
  cfg: Awaited<ReturnType<typeof loadTelegramConfig>>,
  api: Bot<Context>['api'],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const sid = sessionIdForChat(chatId);
  const existing = registry.get(sid);
  if (existing?.pty && existing.status === 'alive') return { ok: true };

  if (existing?.status === 'exited') {
    registry.destroy(sid);
    clearOutputFlush(sid);
  }

  const st = chatState.get(chatId) ?? { lastProjectPath: null };
  if (!st.lastProjectPath) {
    return {
      ok: false,
      message:
        'Set a project on the first line, then your message:\n\n' +
        'PROJECT=my_folder\n\nYour question here.\n\n' +
        `Roots: ${cfg.projectRoots.length ? cfg.projectRoots.join(', ') : '(none — edit ~/.slop/telegram.json)'}`,
    };
  }

  const agent = await loadAgentFromSlopSettings();
  const home = os.homedir();
  try {
    const ptyProcess = spawnSession(home, PTY_COLS, PTY_ROWS, agent.command, agent.args);
    const sendFn = (msg: ServerMessage) => {
      if (msg.type === 'data') scheduleTelegramOutput(sid, chatId, api, msg.data);
    };
    registry.create(sid, ptyProcess, home, sendFn, { persistent: true });

    ptyProcess.onData((data: string) => {
      registry.appendBuffer(sid, data);
      registry.send(sid, { type: 'data', data });
    });

    ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
      clearOutputFlush(sid);
      void api.sendMessage(chatId, `(session exited, code ${exitCode})`).catch(() => {});
      registry.markExited(sid, exitCode);
    });

    const q = shellSingleQuotedPath(st.lastProjectPath);
    suppressTelegramOutput(sid, 3000); // suppress echo of cd + terminal init sequences
    ptyProcess.write(`cd ${q}\r`);

    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `Failed to spawn agent: ${message}` };
  }
}

async function deliverTelegramTurn(
  ctx: Context,
  chatId: number,
  textPart: string,
  attachmentPaths: string[],
): Promise<void> {
  const cfgLatest = await loadTelegramConfig(TELEGRAM_CONFIG_PATH);
  const trimmedPart = textPart.trim();
  const { project, body } = parseTelegramProjectLine(trimmedPart);
  let cwdPath: string | null = null;

  if (project) {
    const resolved = await resolveProjectFolderName(project, cfgLatest.projectRoots, cfgLatest.maxSearchDepth);
    if (!resolved.ok) {
      await ctx.reply(resolved.error);
      return;
    }
    cwdPath = resolved.absolutePath;
    const st = chatState.get(chatId) ?? { lastProjectPath: null };
    st.lastProjectPath = cwdPath;
    chatState.set(chatId, st);
    void saveChatSession(chatId, cwdPath).catch((e) => console.error('[telegram] saveChatSession:', e));
  }

  const prep = await ensureSession(chatId, cfgLatest, ctx.api);
  if (!prep.ok) {
    await ctx.reply(prep.message);
    return;
  }

  const sid = sessionIdForChat(chatId);
  const sess = registry.get(sid);
  if (!sess?.pty) {
    await ctx.reply('No active PTY.');
    return;
  }

  if (cwdPath) {
    suppressTelegramOutput(sid, 1500); // suppress cd echo on project switch
    sess.pty.write(`cd ${shellSingleQuotedPath(cwdPath)}\r`);
  }

  const fullMessage = buildComposerStyleMessage(attachmentPaths, translateTelegramCommand(body));
  if (!fullMessage.trim()) {
    if (project && attachmentPaths.length === 0) {
      await ctx.reply('Project set. Send your message, a file, or a voice note next.');
      return;
    }
    await ctx.reply(
      attachmentPaths.length
        ? '(No caption or transcription — add text, or start with PROJECT=name.)'
        : '(empty message)',
    );
    return;
  }

  sess.pty.write(fullMessage + '\r');
}

export async function stopTelegramTransport(): Promise<void> {
  if (botInstance) {
    try {
      await botInstance.stop();
    } catch (e) {
      console.error('[telegram] stop:', e);
    }
    botInstance = null;
  }
}

export async function restartTelegramTransport(): Promise<void> {
  await stopTelegramTransport();
  await startTelegramTransport();
}

function assertAllowed(ctx: Context, cfg: Awaited<ReturnType<typeof loadTelegramConfig>>): boolean {
  const uid = ctx.from?.id;
  if (!uid) return false;
  if (cfg.allowedUserIds.length === 0) return false;
  return cfg.allowedUserIds.includes(uid);
}

export async function startTelegramTransport(): Promise<void> {
  const token = (await getTelegramBotToken())?.trim();
  if (!token) {
    console.log('[telegram] No bot token — transport disabled (Settings → Telegram or TELEGRAM_BOT_TOKEN)');
    return;
  }

  const bootCfg = await loadTelegramConfig(TELEGRAM_CONFIG_PATH);
  if (bootCfg.allowedUserIds.length === 0) {
    console.warn(
      '[telegram] No allowedUserIds in ~/.slop/telegram.json (or TELEGRAM_ALLOWED_USER_IDS). Bot will reject all users.',
    );
  }
  if (bootCfg.projectRoots.length === 0) {
    console.warn('[telegram] No projectRoots configured — project resolution will fail until ~/.slop/telegram.json is set.');
  }

  // Restore last project per chat from disk so PROJECT= isn't needed after restarts
  const savedSessions = await loadChatSessions().catch(() => new Map<number, string>());
  for (const [chatId, projectPath] of savedSessions) {
    chatState.set(chatId, { lastProjectPath: projectPath });
  }
  if (savedSessions.size > 0) {
    console.log(`[telegram] Restored ${savedSessions.size} chat session(s) from disk.`);
  }

  const bot = new Bot(token);
  botInstance = bot;

  bot.command('start', async (ctx) => {
    const cfg = await loadTelegramConfig(TELEGRAM_CONFIG_PATH);
    if (!ensurePrivateChat(ctx)) return;
    if (!assertAllowed(ctx, cfg)) {
      await ctx.reply('Not authorized. Add your Telegram user id in SlopMop Settings → Telegram (or allowedUserIds in ~/.slop/telegram.json).');
      return;
    }
    await ctx.reply(
      'SlopMop → Claude CLI over Telegram.\n\n' +
        '/projects — list available projects\n' +
        '/project — show or switch active project\n' +
        '/doctor — check setup\n' +
        '/reset — clear PTY session\n' +
        '/help — full help\n\n' +
        'Voice notes are transcribed with Whisper. Photos/documents are saved and passed as @paths.',
    );
  });

  bot.command('help', async (ctx) => {
    const cfg = await loadTelegramConfig(TELEGRAM_CONFIG_PATH);
    if (!ensurePrivateChat(ctx)) return;
    if (!assertAllowed(ctx, cfg)) return;
    await ctx.reply(
      'Commands:\n' +
        '/projects — list SlopMop projects\n' +
        '/project — show active project\n' +
        '/project <name> — switch project\n' +
        '/clear — clear Claude conversation history\n' +
        '/compact — summarize conversation to save context\n' +
        '/doctor — check Whisper, agent, token\n' +
        '/reset — destroy PTY (need /project again after)\n\n' +
        'Voice notes → Whisper → Claude.\n' +
        'Photos/documents → ~/.slop/telegram-inbound/<chat-id>/ → passed as @paths.\n\n' +
        'Example: /project SlopMop then just send messages.',
    );
  });

  bot.command('doctor', async (ctx) => {
    const cfg = await loadTelegramConfig(TELEGRAM_CONFIG_PATH);
    if (!ensurePrivateChat(ctx)) return;
    if (!assertAllowed(ctx, cfg)) {
      await ctx.reply('Not authorized.');
      return;
    }
    const agent = await loadAgentFromSlopSettings();
    const agentPath = await whichCmd(agent.command);
    const tokenOk = !!(await getTelegramBotToken())?.trim();
    await checkWhisper();
    const ws = getWhisperStatus();
    const lines = [
      `token: ${tokenOk ? 'set' : 'missing'}`,
      `allowedUserIds: ${cfg.allowedUserIds.length}`,
      `projectRoots: ${cfg.projectRoots.length}`,
      `maxSearchDepth: ${cfg.maxSearchDepth}`,
      `agent: ${agent.command} ${agent.args.join(' ')}`.trim(),
      `which ${agent.command}: ${agentPath ?? 'NOT FOUND'}`,
      `whisper (voice): ${ws.available ? 'ok' : 'unavailable'}`,
      `settings: ${SETTINGS_FILE}`,
      `telegram config: ${TELEGRAM_CONFIG_PATH}`,
    ];
    await ctx.reply(lines.join('\n'));
  });

  bot.command('reset', async (ctx) => {
    const cfg = await loadTelegramConfig(TELEGRAM_CONFIG_PATH);
    if (!ensurePrivateChat(ctx)) return;
    if (!assertAllowed(ctx, cfg)) return;
    const chatId = ctx.chat!.id;
    const sid = sessionIdForChat(chatId);
    clearOutputFlush(sid);
    registry.destroy(sid);
    chatState.set(chatId, { lastProjectPath: null });
    await ctx.reply('PTY cleared for this chat. Send PROJECT=name again before the next prompt.');
  });

  bot.command('clear', async (ctx) => {
    if (!ensurePrivateChat(ctx)) return;
    const cfg = await loadTelegramConfig(TELEGRAM_CONFIG_PATH);
    if (!assertAllowed(ctx, cfg)) { await ctx.reply('Not authorized.'); return; }
    const chatId = ctx.chat!.id;
    const sid = sessionIdForChat(chatId);
    const sess = registry.get(sid);
    if (!sess?.pty || sess.status !== 'alive') {
      await ctx.reply('No active session. Use /project <name> to start one.');
      return;
    }
    suppressTelegramOutput(sid, 2000);
    sess.pty.write('\x15/clear\r');
    await ctx.reply('Conversation history cleared.');
  });

  bot.command('compact', async (ctx) => {
    if (!ensurePrivateChat(ctx)) return;
    const cfg = await loadTelegramConfig(TELEGRAM_CONFIG_PATH);
    if (!assertAllowed(ctx, cfg)) { await ctx.reply('Not authorized.'); return; }
    const chatId = ctx.chat!.id;
    const sid = sessionIdForChat(chatId);
    const sess = registry.get(sid);
    if (!sess?.pty || sess.status !== 'alive') {
      await ctx.reply('No active session. Use /project <name> to start one.');
      return;
    }
    sess.pty.write('\x15/compact\r');
  });

  bot.on('message:voice', async (ctx) => {
    if (!ensurePrivateChat(ctx)) return;
    const cfg = await loadTelegramConfig(TELEGRAM_CONFIG_PATH);
    if (!assertAllowed(ctx, cfg)) {
      await ctx.reply('Not authorized.');
      return;
    }
    const voice = ctx.message.voice;
    if (!voice) return;
    const chatId = ctx.chat!.id;
    const token = (await getTelegramBotToken())?.trim();
    if (!token) return;

    await ctx.reply('Transcribing voice…');
    chainInbound(chatId, async () => {
      const gf = await ctx.api.getFile(voice.file_id);
      if (!gf.file_path) {
        await ctx.reply('Could not access voice file from Telegram.');
        return;
      }
      const dl = await fetchTelegramFileBuffer({
        botToken: token,
        telegramFilePath: gf.file_path,
        knownSize: voice.file_size,
      });
      if (!dl.ok) {
        await ctx.reply(dl.error);
        return;
      }
      const text = await transcribe(dl.buffer, 'audio/ogg');
      if (text === null) {
        await ctx.reply('Whisper is not available on this server. Install: pip install openai-whisper and ffmpeg.');
        return;
      }
      if (!text.trim()) {
        await ctx.reply('(Empty transcription — try again or speak closer to the mic.)');
        return;
      }
      await deliverTelegramTurn(ctx, chatId, text, []);
    });
  });

  bot.on('message:photo', async (ctx) => {
    if (!ensurePrivateChat(ctx)) return;
    const cfg = await loadTelegramConfig(TELEGRAM_CONFIG_PATH);
    if (!assertAllowed(ctx, cfg)) {
      await ctx.reply('Not authorized.');
      return;
    }
    const photos = ctx.message.photo;
    if (!photos?.length) return;
    const best = photos[photos.length - 1]!;
    const caption = ctx.message.caption ?? '';
    const chatId = ctx.chat!.id;
    const token = (await getTelegramBotToken())?.trim();
    if (!token) return;

    const groupId = ctx.message.media_group_id;
    if (groupId != null) {
      scheduleAlbumItem(ctx, chatId, token, groupId, { t: 'photo', fileId: best.file_id, fileSize: best.file_size }, caption);
      return;
    }

    await ctx.reply('Downloading image…');
    chainInbound(chatId, async () => {
      const gf = await ctx.api.getFile(best.file_id);
      if (!gf.file_path) {
        await ctx.reply('Could not get photo file.');
        return;
      }
      const baseName = path.basename(gf.file_path) || 'photo.jpg';
      const saved = await saveTelegramFileToInbound({
        botToken: token,
        telegramFilePath: gf.file_path,
        chatId,
        suggestedName: baseName,
        knownSize: best.file_size,
      });
      if (!saved.ok) {
        await ctx.reply(saved.error);
        return;
      }
      await ctx.reply(`Saved: ${saved.absolutePath}`);
      await deliverTelegramTurn(ctx, chatId, caption, [saved.absolutePath]);
    });
  });

  bot.on('message:document', async (ctx) => {
    if (!ensurePrivateChat(ctx)) return;
    const cfg = await loadTelegramConfig(TELEGRAM_CONFIG_PATH);
    if (!assertAllowed(ctx, cfg)) {
      await ctx.reply('Not authorized.');
      return;
    }
    const doc = ctx.message.document;
    if (!doc) return;
    const caption = ctx.message.caption ?? '';
    const chatId = ctx.chat!.id;
    const token = (await getTelegramBotToken())?.trim();
    if (!token) return;

    const groupId = ctx.message.media_group_id;
    if (groupId != null) {
      scheduleAlbumItem(
        ctx,
        chatId,
        token,
        groupId,
        {
          t: 'doc',
          fileId: doc.file_id,
          fileSize: doc.file_size,
          name: doc.file_name ?? 'document',
        },
        caption,
      );
      return;
    }

    await ctx.reply('Downloading file…');
    chainInbound(chatId, async () => {
      const gf = await ctx.api.getFile(doc.file_id);
      if (!gf.file_path) {
        await ctx.reply('Could not get document file.');
        return;
      }
      const suggested = doc.file_name ?? path.basename(gf.file_path) ?? 'document';
      const saved = await saveTelegramFileToInbound({
        botToken: token,
        telegramFilePath: gf.file_path,
        chatId,
        suggestedName: suggested,
        knownSize: doc.file_size,
      });
      if (!saved.ok) {
        await ctx.reply(saved.error);
        return;
      }
      await ctx.reply(`Saved: ${saved.absolutePath}`);
      await deliverTelegramTurn(ctx, chatId, caption, [saved.absolutePath]);
    });
  });

  bot.command('projects', async (ctx) => {
    if (!ensurePrivateChat(ctx)) return;
    const cfg = await loadTelegramConfig(TELEGRAM_CONFIG_PATH);
    if (!assertAllowed(ctx, cfg)) { await ctx.reply('Not authorized.'); return; }
    if (cfg.projectRoots.length === 0) {
      await ctx.reply('No project roots configured. Add them in SlopMop Settings → Telegram.');
      return;
    }
    const all = await listAllProjects(cfg.projectRoots);
    if (all.length === 0) {
      await ctx.reply('No projects found under configured roots:\n' + cfg.projectRoots.join('\n'));
      return;
    }
    const chatId = ctx.chat!.id;
    const current = chatState.get(chatId)?.lastProjectPath;
    const lines = all.map((p) => {
      const active = current && p.absolutePath === current;
      return (active ? '● ' : '  ') + p.name;
    });
    await ctx.reply('Projects:\n\n' + lines.join('\n') + '\n\nUse /project <name> to switch.');
  });

  bot.command('gsd', async (ctx) => {
    if (!ensurePrivateChat(ctx)) return;
    const cfg = await loadTelegramConfig(TELEGRAM_CONFIG_PATH);
    if (!assertAllowed(ctx, cfg)) { await ctx.reply('Not authorized.'); return; }
    const sub = ctx.match?.trim();
    if (!sub) {
      await ctx.reply(
        'GSD commands — use /gsd <subcommand>:\n\n' +
        'progress · execute-phase · plan-phase · verify-work\n' +
        'resume-work · pause-work · check-todos · add-todo\n' +
        'quick · debug · new-project · new-milestone\n' +
        'add-phase · insert-phase · remove-phase\n' +
        'audit-milestone · complete-milestone\n' +
        'map-codebase · help · update\n\n' +
        'Example: /gsd progress',
      );
      return;
    }
    const chatId = ctx.chat!.id;
    const sid = sessionIdForChat(chatId);
    const sess = registry.get(sid);
    if (!sess?.pty || sess.status !== 'alive') {
      await ctx.reply('No active session. Use /project <name> first.');
      return;
    }
    sess.pty.write(`/gsd:${sub}\r`);
  });

  bot.command('project', async (ctx) => {
    if (!ensurePrivateChat(ctx)) return;
    const cfg = await loadTelegramConfig(TELEGRAM_CONFIG_PATH);
    if (!assertAllowed(ctx, cfg)) { await ctx.reply('Not authorized.'); return; }
    const chatId = ctx.chat!.id;
    const arg = ctx.match?.trim();

    if (!arg) {
      const current = chatState.get(chatId)?.lastProjectPath;
      if (!current) {
        await ctx.reply('No active project. Use /project <name> to set one, or /projects to list available.');
      } else {
        await ctx.reply(`Active project: ${path.basename(current)}\n${current}`);
      }
      return;
    }

    const resolved = await resolveProjectFolderName(arg, cfg.projectRoots, cfg.maxSearchDepth);
    if (!resolved.ok) {
      await ctx.reply(resolved.error + '\n\nUse /projects to see what\'s available.');
      return;
    }
    const st = chatState.get(chatId) ?? { lastProjectPath: null };
    st.lastProjectPath = resolved.absolutePath;
    chatState.set(chatId, st);
    void saveChatSession(chatId, resolved.absolutePath).catch((e) => console.error('[telegram] saveChatSession:', e));

    // If session exists, cd into the new project
    const sid = sessionIdForChat(chatId);
    const sess = registry.get(sid);
    if (sess?.pty && sess.status === 'alive') {
      suppressTelegramOutput(sid, 1500);
      sess.pty.write(`cd ${shellSingleQuotedPath(resolved.absolutePath)}\r`);
    }

    await ctx.reply(`Switched to: ${path.basename(resolved.absolutePath)}\n${resolved.absolutePath}\n\nSend your message.`);
  });

  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text ?? '';
    if (!ensurePrivateChat(ctx)) return;
    const cfg = await loadTelegramConfig(TELEGRAM_CONFIG_PATH);
    if (!assertAllowed(ctx, cfg)) {
      await ctx.reply('Not authorized.');
      return;
    }

    const chatId = ctx.chat!.id;
    chainInbound(chatId, async () => {
      await deliverTelegramTurn(ctx, chatId, text, []);
    });
  });

  void bot.api.setMyCommands([
    { command: 'projects',        description: 'List SlopMop projects' },
    { command: 'project',         description: 'Show or switch active project' },
    { command: 'clear',           description: 'Clear Claude conversation history' },
    { command: 'compact',         description: 'Compact/summarize conversation history' },
    { command: 'doctor',          description: 'Check Whisper, agent, and token status' },
    { command: 'reset',           description: 'Destroy PTY session for this chat' },
    { command: 'help',            description: 'Show help' },
    { command: 'gsd',             description: '/gsd <subcommand> — run any GSD command (e.g. /gsd progress)' },
    { command: 'review',          description: 'Review current branch / PR' },
    { command: 'init',            description: 'Initialize CLAUDE.md for the project' },
    { command: 'tdd',             description: 'Test-driven development loop' },
    { command: 'diagnose',        description: 'Diagnose a bug or regression' },
    { command: 'security_review', description: 'Security review of pending changes' },
    { command: 'full_feature',    description: 'Implement a full feature end-to-end' },
    { command: 'simplify',        description: 'Review and simplify changed code' },
  ]).catch((e) => console.error('[telegram] setMyCommands:', e));

  void bot.start();
  console.log('[telegram] Long polling started');
}
