# Validation and Requirement Traceability

Validation date: 2026-08-27  
Repository version: 1.8.5

## v1.8.5 single-owner Planet stacking repair

User evidence disproved v1.8.4: the same macOS path remained visually unchanged. The reload flash from v1.8.3/1.8.4 was traced through the full stylesheet cascade. `system-view.css` and `celestial-interaction.css` each contained historical rules that promoted `#planet-canvas` to `opacity:1 !important` after the guaranteed render surface initialized. That legacy canvas carries the original opaque black frame and sat above the replacement scene, so it blanketed the fallback sphere, starfield, rendered planet, projector effects, and low-level HUD layers.

The repair removes both opacity promotions, serves `core-surface.css` last, sets the legacy canvas to `opacity:0 !important` using an inline contract, and disables the duplicate command-center/v1.7 globe canvases on Station 01. The old canvas remains pointer-active for the established direct-manipulation event handlers.

| Check | Evidence | Result |
|---|---|---|
| Full deterministic Python suite | `PYTHONPATH=src pytest -q` | PASS — 58 tests |
| Python compilation | `PYTHONPATH=src python -m compileall -q src` | PASS |
| JavaScript syntax | `node --check` on every shipped JS asset | PASS |
| Served stylesheet order | regression requires `core-surface.css` after `celestial-interaction.css` | PASS |
| Opaque-canvas regression | tests reject any optional Planet rule that re-promotes `#planet-canvas` and require final `opacity:0 !important` | PASS |
| Inline cascade guard | `core-surface.js` applies input-canvas opacity/background/z-index with inline `!important` and re-enforces after late initialization | PASS |
| Single visual owner | Station 01 disables `.cc-globe-layer`, `.v17-globe-layer`, and `.v17-space-layer`; core surfaces remain | PASS |
| Chromium pixel proof in this container | raw Chromium hangs in DBus/zygote before screenshot output | UNAVAILABLE — not claimed |
| Same-path macOS visual confirmation | user browser | PENDING — do not call Planet rendering verified yet |

---

## v1.8.4 bounded Planet visibility repair

User evidence disproved v1.8.3: the macOS path still showed a blank Planet stage and briefly flashed the CSS glow during reload. Inspection isolated two coupled failures: `core-surface.js` read `globalThis.app` even though `app.js` declares `const app`, and the full-stage starfield canvas was above the CSS emergency sphere. v1.8.4 resolves the shared classic-script `app` binding directly, keeps the CSS fallback body permanently present, and places the starfield below it.

| Check | Evidence | Result |
|---|---|---|
| Full deterministic Python suite | `PYTHONPATH=src pytest -q` | PASS — 54 tests |
| Python compilation | `PYTHONPATH=src python -m compileall -q src` | PASS |
| JavaScript syntax | `node --check` on every shipped JS asset | PASS |
| Classic-script binding semantics | Node `vm`: later script resolves `app.view`; `globalThis.app` is `undefined` | PASS — reproduces root cause and repaired access model |
| Fallback layering guard | regression asserts starfield z-index is below persistent CSS planet and no `core-render-live` hide rule remains | PASS |
| Same-path macOS visual confirmation | user browser | PENDING — do not call Planet rendering verified yet |

---

# Validation — v1.8.3

The user supplied a macOS screenshot showing v1.8.2 with the application shell and authoritative state loaded while the entire Station 01 visualization remained blank. v1.8.3 treats that as a failed visual baseline and moves the guaranteed scene onto an independent render surface.

- Full pytest suite: **53/53 passing**.
- Python compilation: **pass**.
- JavaScript syntax: **pass for every shipped `.js` file**.
- `core-surface.js` is loaded immediately after the confirmed-working display-first layer and before optional celestial renderers.
- `core-space-surface` and `core-planet-surface` are absolute stage-sized canvases independent of `#planet-canvas`.
- `#planet-canvas` remains the interaction hit surface at near-zero opacity, so its stale bitmap cannot cover the guaranteed visual surface.
- A CSS-only fallback sphere is visible until the JS surface successfully paints and adds `core-render-live`.
- The guaranteed scene paints the deep parallax star field, state-bound distant primary, orbital bodies, and a complete sphere before solver-map sampling.
- User macOS pixel verification remains required before promoting the repaired path to verified.
