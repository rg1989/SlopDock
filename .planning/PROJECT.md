# ClaudeTalk

## What This Is

A premium local web application that wraps the Claude CLI in a rich, beautifully designed interface. It provides a real pseudo-terminal (PTY) experience inside the browser, a VSCode-style file explorer sidebar, file attachment with previews, voice-to-text input, and a text-to-speech mode that reads agent responses aloud with mid-speech interruption support.

## Core Value

A single-user power tool that makes working with Claude CLI feel as fluid as a native IDE — voice in, voice out, files at your fingertips, and full terminal fidelity.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can select a folder which opens Claude CLI in a real PTY terminal session in the browser
- [ ] User can type multiline messages and send them to the Claude CLI session
- [ ] User can attach files with previews before sending a message (passed as CLI args via @path syntax)
- [ ] User can see a file explorer sidebar showing all files or only changed files (VSCode-style toggle)
- [ ] User can record voice input that is transcribed and sent as a message to the agent
- [ ] User can toggle a TTS mode where agent responses are read aloud
- [ ] User can interrupt TTS playback mid-sentence to ask a question or stop reading
- [ ] App is a local web server (Node.js + browser), single-user, no auth required

### Out of Scope

- Multi-user / auth — personal tool only
- Electron packaging — web app is sufficient; can be added post-v1
- Cloud hosting — local-only
- Multiple concurrent sessions — single active Claude CLI session per folder

## Context

- Terminal: xterm.js in the browser connected to a Node.js PTY backend (node-pty)
- Voice: TTS implementation guided by the ghost-pepper repo (https://github.com/matthartman/ghost-pepper) which has solved the interruption/streaming read-aloud problem well
- Voice input: Web Speech API or whisper.js for transcription
- File explorer: tree view with git diff integration for the "changes only" toggle
- Design: Premium, dark-mode-first, VSCode/Linear aesthetic

## Constraints

- **Tech**: Node.js backend required (node-pty for PTY, xterm.js for frontend terminal)
- **Platform**: macOS primary (Claude CLI is Mac/Linux)
- **Users**: Personal / single-user, no auth

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Local web app over Electron | Faster to ship; design quality independent of packaging; ghost-pepper is also local web | — Pending |
| Real PTY over chat-style input | Full terminal fidelity — color, interactive prompts, stdin/stdout all work | — Pending |
| Files via CLI @path syntax | Mirrors how Claude CLI actually works; no reimplementation needed | — Pending |
| Ghost-pepper for TTS | Already solved streaming + interruption; proven implementation | — Pending |

---
*Last updated: 2026-04-30 after initialization*
