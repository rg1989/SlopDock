import { spawn } from 'child_process';
import { writeFile, unlink, readFile } from 'fs/promises';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import path from 'path';

interface SttState {
  available: boolean;
  cmd: string | null;        // 'whisper' | 'python3'
  setupHint: string | null;
}

const st: SttState = { available: false, cmd: null, setupHint: null };
let _checked: Promise<void> | null = null;

// Try running a command and see if it exits cleanly
function probe(cmd: string, args: string[]): Promise<boolean> {
  return new Promise(resolve => {
    const p = spawn(cmd, args, { stdio: 'ignore' });
    p.on('exit', code => resolve(code === 0));
    p.on('error', () => resolve(false));
  });
}

async function doCheck(): Promise<void> {
  // Try `whisper` CLI first (pip install openai-whisper)
  if (await probe('whisper', ['--help'])) {
    st.available = true;
    st.cmd = 'whisper';
    console.log('[whisper-stt] using whisper CLI');
    return;
  }
  // Try via python3 -m whisper
  if (await probe('python3', ['-m', 'whisper', '--help'])) {
    st.available = true;
    st.cmd = 'python3';
    console.log('[whisper-stt] using python3 -m whisper');
    return;
  }
  st.setupHint = [
    'Whisper not found.',
    'Install: pip install openai-whisper',
    'Requires ffmpeg: brew install ffmpeg',
  ].join(' ');
  console.warn('[whisper-stt]', st.setupHint);
}

export function checkWhisper(): Promise<void> {
  _checked ??= doCheck().catch(err => {
    console.error('[whisper-stt] check error:', err);
    st.setupHint = 'Whisper check failed.';
  });
  return _checked;
}

export function getWhisperStatus(): { available: boolean; setupHint: string | null } {
  return { available: st.available, setupHint: st.setupHint };
}

export async function transcribe(audioBuffer: Buffer, mimeType: string): Promise<string | null> {
  await checkWhisper();
  if (!st.available) return null;

  // Map MIME type to extension (whisper needs a real extension for ffmpeg)
  const ext = mimeType.includes('ogg') ? 'ogg'
    : mimeType.includes('mp4') ? 'mp4'
    : mimeType.includes('wav') ? 'wav'
    : 'webm';

  const id = randomUUID();
  const inputPath = path.join(tmpdir(), `stt-${id}.${ext}`);
  const outputPath = path.join(tmpdir(), `stt-${id}.txt`);

  try {
    await writeFile(inputPath, audioBuffer);

    const args = st.cmd === 'python3'
      ? ['-m', 'whisper', inputPath, '--model', 'tiny.en', '--output_format', 'txt', '--output_dir', tmpdir(), '--language', 'en', '--fp16', 'False']
      : [inputPath, '--model', 'tiny.en', '--output_format', 'txt', '--output_dir', tmpdir(), '--language', 'en', '--fp16', 'False'];

    await new Promise<void>((resolve, reject) => {
      const proc = spawn(st.cmd!, args, { stdio: 'pipe' });
      let stderr = '';
      proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString(); });
      proc.on('exit', code => {
        if (code === 0) { resolve(); }
        else { reject(new Error(`whisper exited ${code}: ${stderr.slice(0, 300)}`)); }
      });
      proc.on('error', reject);
    });

    // Whisper exits 0 but skips unreadable audio — output file may not exist
    try {
      return (await readFile(outputPath, 'utf-8')).trim();
    } catch {
      return '';
    }
  } catch (err) {
    console.error('[whisper-stt] transcription error:', err);
    return null;
  } finally {
    unlink(inputPath).catch(() => {});
    unlink(outputPath).catch(() => {});
  }
}
