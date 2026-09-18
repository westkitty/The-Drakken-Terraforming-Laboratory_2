# v1.9 — Deterministic Experiment Sessions

v1.9 keeps the existing six-station Drakken Terraforming Laboratory and adds a versioned experiment layer over the real simulator.

- Versioned experiment JSON records deterministic initial state, ordered actions, event stream, checkpoints, final state hash, invariant results and bounded telemetry summary.
- Human export timestamps are metadata only and never enter deterministic state hashing.
- Import validates strictly and fails closed on unsupported versions, malformed structures and non-finite numeric values.
- Replay resets to the deterministic laboratory baseline and re-executes real station methods. It does not animate stored values.
- Replay supports start/reset, deterministic step-through, pause/run and checkpoint jumps.
- Final replay state is compared against the recorded SHA-256 deterministic state hash and explicit mismatch evidence is exposed.
- A/B comparison reports descriptive differences only. It does not invent a quality score or winner.
- Six experiment presets cover partial/total withdrawal, Syrin interruption, terraforming cascade, Starbinding geometry, Siege Wall stability/fracture and a real current-session heliocide -> singularity -> Siege Wall composition.
- The Deterministic Telemetry Ledger now exposes the experiment timeline and executable invariant proof results without creating a seventh top-level station.
- CLI parity is provided through the existing drakken-lab command under the experiment subcommand family.
- Manual browser station actions are routed through the same experiment action ledger so current work can be recorded and exported.
- A native macOS AppKit/WebKit wrapper now hosts the same six-station laboratory in its own window, launches the exact localhost backend when necessary, preserves WebKit persistent storage, supports import/export, rejects stale backend identity and keeps external navigation outside the wrapper.
- Wrapper window-close behavior is lifecycle-safe: closing hides the native window without killing the owned laboratory backend; application reopen restores the window, while explicit app quit owns termination.

Historical Planet-render verification remains separate. v1.9 experiment tests do not convert unresolved same-path visual evidence into a verified claim.
