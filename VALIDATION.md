# Validation and Requirement Traceability

## v1.9.0 native macOS wrapper

The local macOS wrapper is a native AppKit/WebKit shell over the existing six-station browser laboratory. It does not replace the Python simulator or introduce a second application model. The installed wrapper resolves the repository, launches the exact local `.venv` dashboard backend when needed, verifies the backend product/version/UI-build identity and loads only the loopback origin inside WebKit.

| Check | Evidence | Result |
|---|---|---|
| Native build | `macos/build_macos_wrapper.sh` using Apple Swift 6.2.4 / macOS SDK 26.2 | PASS |
| Bundle structure | Info.plist, executable bit, arm64 Mach-O and AppKit/WebKit linkage | PASS |
| Plist validation | `plutil -lint macos/Info.plist` | PASS |
| Local-only ATS | `NSAllowsLocalNetworking=true`; no arbitrary-load exception | PASS |
| Backend identity gate | wrapper requires product, v1.9.0 and `1.9.0-concept-single-globe` health identity | PASS |
| Persistent browser data | wrapper uses `WKWebsiteDataStore.default()` | PASS |
| Import/export preservation | native file picker plus collision-safe Downloads handling for state/experiment JSON | PASS — source regression coverage |
| External navigation boundary | only 127.0.0.1:8765 stays in wrapper; external HTTP/HTTPS opens via system browser | PASS — source regression coverage |
| Local app seal | credential-free ad-hoc bundle seal; `codesign --verify --deep --strict` | PASS |
| Developer ID / notarization | no Developer ID identity or notarization requested/performed | NOT PERFORMED |
| Gatekeeper distribution assessment | `spctl --assess` rejects ad-hoc local build | EXPECTED — not a distribution release |
| Installed artifact | `~/Applications/Drakken Terraforming Laboratory.app` | PASS |
| LaunchServices open | installed app opened through `open`; wrapper process remained alive | PASS |
| Window lifecycle guard | close is intercepted as hide; backend remains owned until real app termination; application reopen path is implemented | PASS — runtime close interception + source regression |
| Owned backend launch | `.venv` Python dashboard child remains alive on 127.0.0.1:8765 | PASS |
| Runtime health | repeated `/api/health` returned product v1.9.0 and correct UI build | PASS |
| Full Python suite after wrapper work | `.venv/bin/python -m pytest -q` | PASS — 86 tests |
| Python compilation | `.venv/bin/python -m compileall -q src` | PASS |
| Shipped JS syntax | `node --check` on every shipped JS file | PASS |
| Wrapper build-script syntax | `zsh -n macos/build_macos_wrapper.sh` | PASS |
| Existing same-path Planet pixel proof | prior human-visible issue remains separate | PENDING / NOT CLAIMED |

## v1.9.0 deterministic experiment-session expansion

The v1.9.0 expansion adds a versioned deterministic experiment contract, real simulator replay, descriptive A/B comparison, six bounded experiment presets, a timeline/invariant proof surface inside the existing telemetry station and CLI parity under drakken-lab experiment.

Historical v1.8.x Planet-render evidence remains preserved and is not promoted by these unrelated experiment tests.

| Check | Evidence | Result |
|---|---|---|
| Full Python suite | `.venv/bin/python -m pytest -q` | PASS — 81 tests |
| Python compilation | `.venv/bin/python -m compileall -q src` | PASS |
| Shipped browser JavaScript syntax | `node --check` for every `src/labui/static/*.js` | PASS |
| Preset replay determinism | all six experiment presets replay through real LaboratorySession methods | PASS — recorded and replay hashes match |
| Session format validation | round trip, unsupported version, malformed/non-finite handling, safe overwrite | PASS |
| Manual current-session recording | ordinary deterministic station actions enter the experiment action ledger and replay | PASS |
| Syrin boundary proof | contacted instruction remains prevented; inert attempt is evidence, not mutation | PASS |
| Heliocide replay proof | partial withdrawal survives; zero depletion collapses in the same deterministic stellar operation | PASS |
| Cross-station composition | current-session HeliocideEvent -> BlackHoleRecord -> Siege Wall solve | PASS |
| Comparison semantics | descriptive difference report; no score/winner field | PASS |
| CLI parity | experiment list/run/validate/replay/compare round trip using temporary files | PASS |
| Legacy CLI scenario paths | Starbinding, Siege Wall and Syrin scenario commands | PASS |
| Wheel build | `.venv/bin/python -m pip wheel . --no-deps` to temporary directory | PASS — v1.9.0 wheel built |
| Loopback dashboard smoke | root/static delivery, six stations present, experiment run/export/replay, replay mismatch absent | PASS |
| Existing UI build identity guard | `1.9.0-concept-single-globe` preserved | PASS |
| Same-path user macOS Planet pixels | historical completion evidence remains required | PENDING / NOT CLAIMED |


## v1.8.6 Station 01 visibility repair

User-path evidence disproved v1.8.5: the same macOS browser path still rendered the unchanged blank Planet stage. v1.8.6 therefore moves the final fallback out of Canvas/WebGL entirely. The base celestial scene is a static SVG resource inserted into the served Station 01 HTML before browser scripts execute; a direct last-loaded safety stylesheet/script makes the legacy canvas input-only and exposes a visible build identity.

| Check | Evidence | Result |
|---|---|---|
| Full Python suite | `PYTHONPATH=src pytest -q` | PASS — 65 tests |
| Python compilation | `PYTHONPATH=src python -m compileall -q src` | PASS |
| JavaScript syntax | `node --check` on every shipped JS asset | PASS |
| Static body exists without JS | served HTML contains `#planet-static-scene` before `#planet-canvas`; `/static/planet-base.svg` contains the central planet and distant system | PASS |
| Safety assets are truly last | served HTML asserts `planet-safe.css/js` occur after server-injected celestial/core assets | PASS |
| Legacy canvas cannot cover scene | last stylesheet + last script force `#planet-canvas` transparent while retaining pointer input | PASS |
| Duplicate Planet renderers suppressed | command-center/v1.7/v1.8 Planet visual canvases disabled by final contract | PASS |
| Dynamic solver layer remains additive | `core-planet-surface` may render above permanent SVG base | PASS |
| Static SVG renders independently | exact `/static/planet-base.svg` resource rendered successfully to PNG with CairoSVG | PASS |
| Managed Chromium pixel journey | Chromium hangs in container DBus/zygote startup before screenshot | NOT CLAIMED |
| Exact-port launch guard | occupied requested port returns failure instead of silently spawning another build on 8766+ | PASS |
| Active-build identity | terminal, `/api/health`, launch query, header, and scene badge all expose v1.8.6 identity | PASS |
| Same-path user macOS pixels | exact required completion evidence | PENDING |

The Planet display remains **implemented-unverified**, not verified, until the user sees the new scene on the same Mac/browser path.

---

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
