# Audio mutual exclusion enforced by a coordinator, not a combined hook

TTS and voice input remain as separate hooks (`useTts`, `useVoiceInput`) with a thin `useAudioCoordinator` that wires them together and enforces the rule that starting the microphone stops any in-progress speech.

The alternative was merging both into a single `useAudio` hook. That would have hidden the mutual-exclusion rule more deeply and was rejected for two reasons:

1. **Risk.** Both hooks manage real browser audio APIs (AudioContext, MediaRecorder). They are already working and tested. Merging them into one hook meant rewriting both and risking audio bugs — mic cutting out, TTS double-playing, state getting out of sync — which are hard to reproduce and debug. The coordinator adds the rule without touching either implementation.

2. **Bypass risk is acceptable.** The main drawback of the coordinator pattern is that a future caller could bypass the coordinator and use `useTts` or `useVoiceInput` directly, silently breaking mutual exclusion. This is an acceptable risk: both hooks are internal to the `hooks/` directory, the coordinator is the only consumer in App, and the `useAudioCoordinator` file documents the rule clearly.

## Consequences

The mutual-exclusion rule lives in exactly one place: `useAudioCoordinator.ts`. Any change to the rule (e.g. adding a third audio source, or making TTS pause rather than stop) happens there. If a future audio source is added, it should be integrated through the coordinator, not wired separately in App.
