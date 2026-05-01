import { spawn, type ChildProcess } from 'child_process';
import { homedir } from 'os';
import path from 'path';
import { readdir } from 'fs/promises';

const HTTP_PORT = 5001;
const STARTUP_TIMEOUT_MS = 12_000;
const POLL_INTERVAL_MS = 500;

interface PiperState {
  proc: ChildProcess | null;
  ready: boolean;
  voice: string | null;
  setupHint: string | null;
}

const st: PiperState = { proc: null, ready: false, voice: null, setupHint: null };
let _init: Promise<void> | null = null;

async function findOnnxModel(): Promise<string | null> {
  const dirs = [
    path.join(homedir(), '.local', 'share', 'piper', 'voices'),
    path.join(homedir(), 'Library', 'Application Support', 'piper', 'voices'),
    path.join(homedir(), '.piper', 'voices'),
    path.join(homedir(), '.piper'),
    path.join(homedir(), '.config', 'piper'),
  ];
  for (const dir of dirs) {
    try {
      const files = await readdir(dir);
      const f = files.find(x => x.endsWith('.onnx'));
      if (f) return path.join(dir, f);
    } catch { /* dir doesn't exist */ }
  }
  return null;
}

async function pollUntilReady(): Promise<boolean> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline && st.proc !== null) {
    try {
      // GET /voices is a lightweight readiness probe
      const r = await fetch(`http://localhost:${HTTP_PORT}/voices`, {
        signal: AbortSignal.timeout(1000),
      });
      if (r.status < 500) return true;
    } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  return false;
}

async function doInit(): Promise<void> {
  // Reuse a piper server already running on the port (survives tsx watch restarts)
  try {
    const r = await fetch(`http://localhost:${HTTP_PORT}/voices`, { signal: AbortSignal.timeout(1500) });
    if (r.status === 200) {
      const voices = await r.json() as Record<string, unknown>;
      st.voice = Object.keys(voices)[0] ?? 'unknown';
      st.ready = true;
      console.log(`[piper-tts] reusing existing server on :${HTTP_PORT} — voice: ${st.voice}`);
      return;
    }
  } catch { /* not running, fall through to spawn */ }

  const modelPath = await findOnnxModel();

  if (!modelPath) {
    st.setupHint = [
      'No Piper voice model found.',
      'Install Piper and download a voice:',
      '  pip install "piper-tts[http]"',
      '  python3 -m piper --download-dir ~/.local/share/piper/voices --model en_US-lessac-medium',
    ].join(' ');
    return;
  }

  const args = ['-m', 'piper.http_server', '--port', String(HTTP_PORT), '--model', modelPath];
  const proc = spawn('python3', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  st.proc = proc;
  st.voice = path.basename(modelPath, '.onnx');

  proc.on('error', (err) => {
    st.proc = null;
    st.ready = false;
    st.setupHint = `Failed to start piper: ${err.message}. Install: pip install "piper-tts[http]"`;
    _init = null;
  });

  proc.on('exit', (code) => {
    const wasReady = st.ready;
    st.proc = null;
    st.ready = false;
    if (!wasReady) {
      st.setupHint ??= `piper.http_server exited (code ${code}). Install: pip install "piper-tts[http]"`;
    } else {
      // Died while running — allow restart on next request
      _init = null;
    }
  });

  const up = await pollUntilReady();

  if (!up) {
    st.setupHint ??= 'Piper HTTP server did not start in time. Check: pip install "piper-tts[http]"';
    proc.kill();
    st.proc = null;
    return;
  }

  st.ready = true;
  console.log(`[piper-tts] ready on :${HTTP_PORT} — voice: ${st.voice}`);
}

export function initPiper(): Promise<void> {
  _init ??= doInit().catch(err => {
    console.error('[piper-tts] init error:', err);
    st.setupHint ??= 'Piper TTS initialization failed.';
  });
  return _init;
}

export function getPiperStatus(): { available: boolean; voice: string | null; setupHint: string | null } {
  return { available: st.ready, voice: st.voice, setupHint: st.setupHint };
}

export async function synthesize(text: string): Promise<Buffer | null> {
  await initPiper();
  if (!st.ready) return null;
  try {
    const res = await fetch(`http://localhost:${HTTP_PORT}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

// Graceful shutdown — kill piper when the Node process exits
for (const sig of ['exit', 'SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => { st.proc?.kill(); });
}
