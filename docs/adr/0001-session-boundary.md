# Session owns PTY, editor tabs, and attachments

The three pieces of state most tightly coupled to a single agent interaction — the PTY connection, open editor tabs, and staged attachments — are grouped into a single `useSession` hook rather than kept as separate App-level state.

The reason is locality: all three are per-interaction state. Tabs open because the agent (or user) is inspecting a file relevant to the current task. Attachments stage files to include in the next message. Both are meaningless when the PTY session ends or the workspace changes. Keeping them together means the session boundary is explicit and self-contained — App clears exactly one thing when the workspace changes, and a future multi-session layout maps over an array of sessions without needing to partition three separate state trees.

## Considered options

**Keep each concern in App separately** — this was the original structure. It worked for a single session but had no natural seam for multi-session support. Any feature touching tabs, PTY, or attachments required reading all of App.tsx.

**Include sidebar/panel state in the session** — rejected. Panels (file tree, roadmap, source control) are workspace context, not interaction context. They should survive a session restart and be shared if multiple sessions are ever shown side by side.

## Consequences

The session boundary is the right place to add any future per-session state (e.g. per-session history, agent-specific tool state, session labels for the multi-session switcher). If a future feature needs to be "per session", add it to `useSession`. If it needs to survive across sessions, keep it in App.
