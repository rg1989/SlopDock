---
phase: 3
slug: voice-io
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-30
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3 + @testing-library/react 16 |
| **Config file** | `vitest.config.ts` (jsdom environment) |
| **Quick run command** | `npm test -- --reporter=verbose` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 0 | VOICE-01, VOICE-02, TTS-03 | unit | `npm test -- tests/useVoiceInput.test.ts` | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 0 | TTS-01, TTS-02 | unit | `npm test -- tests/useTts.test.ts` | ❌ W0 | ⬜ pending |
| 3-01-03 | 01 | 0 | TTS-04 | integration | `npm test -- tests/VoiceBar.test.tsx` | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 1 | VOICE-01, VOICE-02 | unit | `npm test -- tests/useVoiceInput.test.ts` | ❌ W0 | ⬜ pending |
| 3-03-01 | 03 | 1 | TTS-01, TTS-02 | unit | `npm test -- tests/useTts.test.ts` | ❌ W0 | ⬜ pending |
| 3-04-01 | 04 | 2 | TTS-03, TTS-04 | integration | `npm test -- tests/VoiceBar.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/useVoiceInput.test.ts` — stubs for VOICE-01, VOICE-02, TTS-03; needs `SpeechRecognition` mock
- [ ] `tests/useTts.test.ts` — stubs for TTS-01, TTS-02; needs `speechSynthesis` mock
- [ ] `tests/VoiceBar.test.tsx` — stubs for TTS-04 integration; needs both mocks
- [ ] `tests/setup.ts` — add `vi.stubGlobal` mocks for `window.SpeechRecognition`, `window.webkitSpeechRecognition`, `window.speechSynthesis`

*Note: jsdom does not implement Web Speech API — all test files must mock these globals using `vi.stubGlobal`. Pattern mirrors existing `usePty.test.ts` (vi.mock WebSocket).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Voice recording button triggers browser mic permission prompt | VOICE-02 | Browser permission dialogs cannot be automated in jsdom | Open app in Chrome, click mic button, confirm browser permission dialog appears |
| TTS reads aloud PTY output in audible speech | TTS-01 | Audio output requires human verification | Toggle TTS mode, send a message, verify speech plays through speakers |
| TTS stops immediately on stop button click | TTS-02 | Audio state requires human verification | Start TTS, click stop — verify audio halts within 0.5s |
| Voice interrupt stops TTS and sends transcript | TTS-03 | Mic + audio interaction requires human verification | Start TTS, speak into mic — verify audio stops and transcript appears as sent message |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
