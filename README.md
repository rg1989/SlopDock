# SlopDock

A local browser-based terminal for Claude CLI — full PTY fidelity, file explorer, voice I/O, git integration, and GSD roadmap tracking, all in one window.

## What it is

SlopDock wraps Claude CLI in a proper browser UI so you get a real interactive terminal alongside the tools you actually use while coding: a file tree, syntax-highlighted previews, a diff viewer, source control actions, and voice input/output. Everything runs locally — no cloud, no telemetry.

## Features

- **Full PTY terminal** — real pseudo-terminal, not a fake shell. Colours, interactive prompts, and keyboard shortcuts all work.
- **File explorer** — browse, preview, and attach files to your Claude prompt. Supports search, collapse-all, and hidden file toggle.
- **Syntax-highlighted editor** — view and edit files with Shiki highlighting. Preview tabs promote to permanent on edit.
- **Git integration** — staged/unstaged diff viewer, stage/unstage/discard actions, commit from the UI.
- **Voice input** — push-to-talk or toggle mode via a configurable keyboard shortcut. Transcribed by local Whisper.
- **Voice output (TTS)** — Claude's terminal output read aloud sentence-by-sentence via local Piper.
- **GSD roadmap** — displays your `.planning/ROADMAP.md` phases, plans, and quick tasks inline. Remove phases/plans without leaving the app.
- **Drag-resizable panels** — sidebar, terminal, and preview panel widths are all adjustable and persisted per working directory.

## Requirements

- Node.js 20+
- macOS (Linux untested but likely works; Windows not supported)
- Claude CLI installed and on your PATH
- Optional: [Piper TTS](https://github.com/rhasspy/piper) for voice output
- Optional: [Whisper](https://github.com/openai/whisper) (`pip install openai-whisper`) for voice input

## Quick start

```bash
git clone <repo>
cd slopdock
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173), pick a folder, and start a Claude session.

## Project structure

```
slopdock/
├── client/               # React + Vite frontend
│   ├── components/       # UI components
│   ├── hooks/            # Custom React hooks
│   └── App.tsx           # Root layout and wiring
├── server/               # Express + node-pty backend
│   ├── index.ts          # HTTP endpoints
│   ├── gsd.ts            # GSD roadmap parsing (pure functions)
│   ├── ws-handler.ts     # WebSocket PTY handler
│   ├── file-api.ts       # File tree + git status helpers
│   ├── piper-tts.ts      # Piper TTS integration
│   └── whisper-stt.ts    # Whisper STT integration
├── shared/
│   └── protocol.ts       # WebSocket message types
└── tests/                # Vitest unit tests
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start server + Vite dev server concurrently |
| `npm run build` | TypeScript compile + Vite production build |
| `npm test` | Run unit tests with Vitest |

## Settings

Accessible via the gear icon. Configurable:
- Push-to-talk keyboard combo (hold or toggle mode)
- Sidebar tab orientation (horizontal/vertical)
- Show/hide hidden files

Settings are persisted in `localStorage` under `slopdock_settings`.
