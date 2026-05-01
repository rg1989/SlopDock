import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import { spawnSession, resizeSession } from './pty-manager.js';
import { registry } from './session-registry.js';
import type { ClientMessage, ServerMessage } from '../shared/protocol.js';

export function attachWebSocketServer(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    let currentSessionId: string | null = null;

    function send(msg: ServerMessage): void {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
      }
    }

    ws.on('message', (raw: Buffer | ArrayBuffer | Buffer[]) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString()) as ClientMessage;
      } catch (err) {
        send({ type: 'error', message: 'Invalid JSON message' });
        return;
      }

      if (msg.type === 'start') {
        currentSessionId = msg.sessionId;
        const existing = registry.get(msg.sessionId);

        if (existing) {
          // Reconnect: attach this WebSocket to the existing session
          registry.attach(msg.sessionId, send);
          send({ type: 'session-ready', sessionId: msg.sessionId });
          // Replay buffered output so the terminal shows history
          const buffered = registry.getBuffer(msg.sessionId);
          if (buffered) send({ type: 'data', data: buffered });
          // If the session already exited, tell the client
          if (existing.status === 'exited') {
            send({ type: 'exit', code: existing.exitCode ?? 0 });
          }
          return;
        }

        // New session: spawn PTY
        try {
          const ptyProcess = spawnSession(msg.cwd, msg.cols, msg.rows, msg.agentCommand, msg.agentArgs);
          registry.create(msg.sessionId, ptyProcess, msg.cwd, send);
          send({ type: 'session-ready', sessionId: msg.sessionId });

          ptyProcess.onData((data: string) => {
            registry.appendBuffer(msg.sessionId, data);
            send({ type: 'data', data });
          });

          ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
            registry.markExited(msg.sessionId, exitCode);
            send({ type: 'exit', code: exitCode });
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          send({ type: 'error', message: `Failed to start session: ${message}` });
        }

      } else if (msg.type === 'input') {
        const session = currentSessionId ? registry.get(currentSessionId) : null;
        if (session?.pty) session.pty.write(msg.data);

      } else if (msg.type === 'resize') {
        const session = currentSessionId ? registry.get(currentSessionId) : null;
        if (session?.pty) resizeSession(session.pty, msg.cols, msg.rows);

      } else if (msg.type === 'kill') {
        if (currentSessionId) registry.destroy(currentSessionId);
      }
    });

    ws.on('close', () => {
      // Detach but keep PTY alive — client may reconnect
      if (currentSessionId) registry.detach(currentSessionId);
    });

    ws.on('error', (err: Error) => {
      console.error('[ws-handler] WebSocket error:', err.message);
      if (currentSessionId) registry.detach(currentSessionId);
    });
  });

  console.log('[ws-handler] WebSocket server attached at /ws');
}
