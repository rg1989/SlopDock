# SlopMop

## What This Is

A premium local web application that wraps the Claude CLI in a rich, beautifully designed interface. It provides a real pseudo-terminal (PTY) experience inside the browser, a VSCode-style file explorer sidebar, file attachment with previews, voice-to-text input, and a text-to-speech mode that reads agent responses aloud with mid-speech interruption support.

## Current State — v1.2 Shipped 2026-05-03

**Version:** v1.2 Terminal-Native Composer ✅
**Status:** Production-ready for single-user local use

The full input stack is now terminal-native: typing, arrow-key permission menus, Ctrl sequences, Tab completion all route through a real xterm.js input strip directly to the Claude PTY. Attach, voice, and TTS float as overlays — always accessible. Old Composer textarea is fully gone.

### What's Live

- **PTY terminal** — xterm.js + node-pty, full ANSI, resize, scrollback
- **Terminal input strip** — xterm.js TerminalInput component; arrow-key menus, Ctrl+C/D, Tab all reach PTY natively; fixed-height strip at bottom of session
- **PTY session persistence** — sessions survive browser reload; server-side registry with 30-min TTL, scrollback replay
- **File explorer** — collapsible VSCode-style tree, git-changed toggle, @path attachment, preview panel with syntax highlighting and edit mode
- **Voice I/O** — Whisper STT (local), Piper TTS (local), animated recording/transcribing states in UI; ANSI-safe stripping so only prose is spoken
- **Multi-session tabs** — up to 8 concurrent sessions, live status, name from first prompt
- **Floating action bar** — attach, voice, TTS buttons float as CSS overlay above terminal input; never obscures cursor
- **Slash command popup** — `/` detection via `attachCustomKeyEventHandler`; overlay popup with arrow-key navigation
- **Attachment chips** — floating chip strip above input; dismissible
- **Project onboarding** — first-run modal + health strip (git, CLAUDE.md, CLI, node_modules, .slop)
- **.slop config vault** — per-project + global disk-based config, dotfile backup/restore
- **Shiki rules modal** — CLAUDE.md with fenced code block syntax highlighting
- **AI Guardian** — standing Claude alignment rules, per-project toggle in Settings
- **UI state persistence** — sidebar tab, panel widths, open editor files restored on reload
- **Canvas panel** — persistent right-column panel; MCP tools for agent-controlled multi-tab canvas; resizable
- **Bottom panel** — collapsible panel; raw PTY terminal shells with multi-tab support
- **Telegram bot** — full remote control via Telegram: send messages, receive PTY output, voice notes via Whisper, photo/file delivery
- **Per-project accent color** — project-level theme accent color via Settings UI

---

## Core Value

A single-user power tool that makes working with Claude CLI feel as fluid as a native IDE — voice in, voice out, files at your fingertips, and full terminal fidelity.

---

## Architecture

- **Stack**: Node/Express backend (`server/`), React 18 + Vite frontend (`client/`)
- **Terminal**: node-pty over WebSocket (`server/index.ts`)
- **Config**: Per-project `.slop/config.json` + global `~/.slop/settings.json`
- **State**: React hooks only — no Redux, no Zustand
- **Styling**: Plain CSS (`client/App.css`, `client/theme.css`) + inline styles

## Constraints

- **Tech**: Node.js backend required (node-pty for PTY, xterm.js for frontend terminal)
- **Platform**: macOS primary (Claude CLI is Mac/Linux)
- **Users**: Personal / single-user, no auth

---

## v1.1 Goals ✅ ALL SHIPPED 2026-05-03

1. **PTY Session Persistence** (Phase 10) ✅ — live reconnect after browser reload
2. **Canvas Panel Extraction** (Phase 11) ✅ — persistent right-column panel, resizable
3. **Bottom Panel Shell** (Phase 12) ✅ — collapsible bottom zone with horizontal resize
4. **Raw Terminal Sessions** (Phase 13) ✅ — multi-tab PTY shells in bottom panel
5. **Canvas MCP + Multi-Tab + MCP UI** (Phase 14) ✅ — agent-controlled multi-tab canvas via MCP tools; MCP connections management UI

## v1.2 Goals ✅ ALL SHIPPED 2026-05-03

1. **Terminal-Native Composer** (Phase 15) ✅ — xterm.js TerminalInput strip; arrow-key menus, Ctrl sequences, Tab all native
2. **Floating Action Bar** (Phase 16) ✅ — Attach/Voice/TTS float as CSS overlay; never obscures input cursor
3. **Slash Command Preservation** (Phase 16) ✅ — `/` detected via xterm key handler; overlay popup with arrow-key nav
4. **Attachment Chips** (Phase 16) ✅ — Floating strip above input; dismissible per-file
5. **Composer Deletion** (Phase 16) ✅ — Composer.tsx, test, and CSS fully removed

## v1.3 Goals

*Not yet defined. Run `/gsd:new-milestone` to start planning.*

---

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Local web app over Electron | Faster to ship; design quality independent of packaging | ✅ Correct — shipped in 3 days |
| Real PTY over chat-style input | Full terminal fidelity — color, interactive prompts, stdin/stdout | ✅ Validated |
| Files via CLI @path syntax | Mirrors how Claude CLI actually works; no reimplementation | ✅ Validated |
| Ghost-pepper AudioContext for TTS | Already solved streaming + interruption | ✅ Validated |
| .slop/ per-project config over localStorage | Survives browser clears, version-controllable | ✅ Validated |
| Propose+confirm for AI write-back | Anything influencing future agent behavior needs explicit approval | ✅ Validated |
| Modal anchor-to-top (flex-start) | Header stays at fixed screen position regardless of content height | ✅ Validated |
| `useRef` booleans in xterm key handler | React state captured at init causes stale closures; refs see current values | ✅ Validated |
| All overlays anchor to `.terminal-input-wrapper` | Single relative-positioned anchor avoids z-index wars across overlays | ✅ Validated |
| TTS reads only after 600ms input gate | PTY echoes user input immediately; suppress onData briefly to avoid reading back user's own message | ✅ Validated |

---

*Last updated: 2026-05-04 — v1.2 milestone complete: Terminal-Native Composer shipped*
