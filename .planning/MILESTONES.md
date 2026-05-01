# Milestones

## v1.0 Foundation ✅ SHIPPED 2026-05-02

**Phases:** 1–9 (6 formal + 3 ad-hoc)
**Timeline:** 2026-04-30 → 2026-05-02 (3 days)
**Plans:** 25 formal plans executed

### Delivered

A fully functional browser-based Claude CLI interface: PTY terminal with xterm.js, VSCode-style file explorer, voice input + TTS playback with interruption, multi-session tab management, project onboarding wizard, health check strip, .slop config vault, Shiki syntax highlighting, AI Guardian alignment rules, and full UI state persistence across reloads.

### Key Accomplishments

1. **Real PTY terminal in the browser** — xterm.js + node-pty over WebSocket; full ANSI color, interactive prompts, resize, scrollback (Phase 1)
2. **VSCode-style file explorer** — collapsible tree, git-changed toggle, file attachment via @path, preview panel (Phase 2)
3. **Voice I/O with interruption** — Web Speech API input, AudioContext TTS, mid-sentence interruption sends new message (Phase 3)
4. **Multi-session tab management** — up to 8 concurrent sessions, live status indicators, session names from first prompt, sessionId architecture ready for PTY reconnect (Phase 4)
5. **.slop config vault** — per-project + global disk-based config, dotfile backup/restore for Claude/GSD/git/SSH (Phase 6)
6. **AI Guardian** — standing Claude alignment rules loaded via CLAUDE.md, per-project toggle in Settings (Phase 8)

### Archive

- [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) — full phase details
- [v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md) — all 22 requirements validated

---

*Next milestone: v1.1 — PTY Session Persistence (live reconnect after browser reload)*
