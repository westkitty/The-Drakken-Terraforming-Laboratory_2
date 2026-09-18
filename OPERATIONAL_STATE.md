# Operational State — The Drakken Terraforming Laboratory
<!-- operational-state:metadata
{
  "schema_version": 1,
  "project_id": "drakken-terraforming-laboratory",
  "project_name": "The Drakken Terraforming Laboratory",
  "project_root": "/Users/andrew/The-Drakken-Terraforming-Laboratory_2",
  "artifact_path": "",
  "state_revision": 7,
  "last_updated": "2026-09-18T19:53:52Z",
  "current_baseline": {
    "identity": "repository v1.9.0 / deterministic experiment-session expansion",
    "state": "partially-verified",
    "last_verified": "2026-09-18T19:53:52Z"
  },
  "scope_boundaries": [
    "Deterministic computational Starsilk, stellar, terraforming, lattice, scenario, CLI, and test repository",
    "No external network services or real-world destructive operations"
  ],
  "linked_parent_state": null
}
-->

## 1. Project Identity and Scope
The Drakken Terraforming Laboratory is a Python repository implementing deterministic Starsilk Macro execution, stellar-core collapse mechanics, planetary transformation grids, Siege Wall singularity anchoring, reproducible canonical scenarios, CLI tooling, telemetry, packaging, and tests.

## 2. Current Baseline
Repository source is currently v1.9.0. The deterministic experiment-session expansion is verified by 81 passing tests, Python compilation, all shipped JavaScript syntax checks, CLI experiment round trips, and a bounded loopback dashboard replay smoke on 2026-09-18. Historical same-path Planet visual confirmation remains unresolved and is therefore not promoted to verified by the experiment work.

## 3. Artifact Contract
Deliver a complete executable repository with the user-requested source layout, no placeholders/TODO stubs, deterministic physics behavior, CLI, scenarios, README, package configuration, and comprehensive tests.

## 4. Active Invariants
<!-- operational-state:entry
{"id":"INV-001","title":"Total Starsilk depletion immediately causes heliocide","state":"verified","rule":"When active stellar-core Starsilk remaining reaches exactly zero, collapse into a black hole occurs in the same operation without threshold, delay, or override.","scope":"core.stellar and all callers","authority":"Current user request plus Starsilk canon lock","evidence":"tests/test_stellar.py and tests/test_integration.py passed 2026-08-26","validation_method":"Unit test partial vs total depletion and integration test macro withdrawal","last_checked":"2026-08-26","status":"active","recheck_trigger":"Any stellar withdrawal, core-state, or macro-executor change"}
-->
### INV-001 — Total Starsilk depletion immediately causes heliocide
- **State:** `verified`
- **Rule:** When active stellar-core Starsilk remaining reaches exactly zero, collapse into a black hole occurs in the same operation without threshold, delay, or override.
- **Scope:** core.stellar and all callers
- **Authority:** Current user request plus Starsilk canon lock
- **Evidence:** tests/test_stellar.py and tests/test_integration.py passed 2026-08-26
- **Validation method:** Unit test partial vs total depletion and integration test macro withdrawal
- **Last checked:** 2026-08-26
- **Status:** active
- **Recheck trigger:** Any stellar withdrawal, core-state, or macro-executor change
<!-- /operational-state:entry -->

<!-- operational-state:entry
{"id":"INV-002","title":"Syrin contact absolutely nullifies active Starsilk","state":"verified","rule":"Any strictly positive finite Syrin blood contact makes the runtime and active Macro threads inert before the contacted instruction can mutate state.","scope":"core.starsilk runtime","authority":"Current user request plus Starsilk canon lock","evidence":"tests/test_executor.py and tests/test_scenarios.py passed 2026-08-26","validation_method":"Executor interruption unit test and Syrin cascade scenario","last_checked":"2026-08-26","status":"active","recheck_trigger":"Any nullifier, thread, hook, or executor-order change"}
-->
### INV-002 — Syrin contact absolutely nullifies active Starsilk
- **State:** `verified`
- **Rule:** Any strictly positive finite Syrin blood contact makes the runtime and active Macro threads inert before the contacted instruction can mutate state.
- **Scope:** core.starsilk runtime
- **Authority:** Current user request plus Starsilk canon lock
- **Evidence:** tests/test_executor.py and tests/test_scenarios.py passed 2026-08-26
- **Validation method:** Executor interruption unit test and Syrin cascade scenario
- **Last checked:** 2026-08-26
- **Status:** active
- **Recheck trigger:** Any nullifier, thread, hook, or executor-order change
<!-- /operational-state:entry -->

<!-- operational-state:entry
{"id":"INV-003","title":"Macro execution remains deterministic and bounded","state":"verified","rule":"Macro arithmetic, loop order, instruction order, and state outputs must not depend on wall clock, ambient randomness, asynchronous ordering, or silent budget truncation.","scope":"Starsilk parser/runtime, scenarios, telemetry","authority":"Current user request","evidence":"27-test suite, reproducibility tests, telemetry hash-chain tests, and deterministic CLI scenarios passed 2026-08-26","validation_method":"Reproducibility tests, cycle-limit tests, deterministic state hashes","last_checked":"2026-08-26","status":"active","recheck_trigger":"Any executor, hashing, scenario, or telemetry change"}
-->
### INV-003 — Macro execution remains deterministic and bounded
- **State:** `verified`
- **Rule:** Macro arithmetic, loop order, instruction order, and state outputs must not depend on wall clock, ambient randomness, asynchronous ordering, or silent budget truncation.
- **Scope:** Starsilk parser/runtime, scenarios, telemetry
- **Authority:** Current user request
- **Evidence:** 27-test suite, reproducibility tests, telemetry hash-chain tests, and deterministic CLI scenarios passed 2026-08-26
- **Validation method:** Reproducibility tests, cycle-limit tests, deterministic state hashes
- **Last checked:** 2026-08-26
- **Status:** active
- **Recheck trigger:** Any executor, hashing, scenario, or telemetry change
<!-- /operational-state:entry -->

<!-- operational-state:entry
{"id":"INV-004","title":"Experiment identity excludes presentation timing","state":"verified","rule":"Experiment deterministic hashes contain simulator state/actions only; human export timestamps and presentation animation are excluded from deterministic identity.","scope":"labui.experiments and replay/export surfaces","authority":"Current user request","evidence":"tests/test_experiments.py plus CLI replay round trip and loopback dashboard smoke passed 2026-09-18","validation_method":"Record/replay hash equality, non-finite validation, metadata exclusion","last_checked":"2026-09-18","status":"active","recheck_trigger":"Any experiment schema, hashing, replay, or export change"}
-->
### INV-004 — Experiment identity excludes presentation timing
- **State:** `verified`
- **Rule:** Experiment deterministic hashes contain simulator state/actions only; human export timestamps and presentation animation are excluded from deterministic identity.
- **Evidence:** Experiment regression suite, CLI replay and loopback dashboard smoke passed 2026-09-18.
- **Status:** active.
<!-- /operational-state:entry -->

## 5. Verified Working Behavior
<!-- operational-state:entry
{"id":"VER-001","title":"Complete repository baseline validates end to end","state":"verified","capability":"All requested source packages, scenarios, CLI, README, packaging, telemetry, and tests are present and execute under the validated dependency environment.","scope":"entire repository","verification_method":"27-test pytest suite, compileall, placeholder scan, three scenario smokes, dashboard smoke, wheel build, wheel metadata inspection, packaged-code smoke","evidence":"VALIDATION.md","artifact_revision":"v1.0.0","last_verified":"2026-08-26T11:59:02Z","dependencies":"Python 3.11+, NumPy 2.x, Rich 13.7-14.x","freshness":"current","recheck_trigger":"Any source, test, packaging, or dependency-range change"}
-->
### VER-001 — Complete repository baseline validates end to end
- **State:** `verified`
- **Capability:** All requested source packages, scenarios, CLI, README, packaging, telemetry, and tests are present and execute under the validated dependency environment.
- **Scope:** entire repository
- **Verification method:** 27-test pytest suite, compileall, placeholder scan, three scenario smokes, dashboard smoke, wheel build, wheel metadata inspection, packaged-code smoke
- **Evidence:** VALIDATION.md
- **Artifact revision:** v1.0.0
- **Last verified:** 2026-08-26T11:59:02Z
- **Dependencies:** Python 3.11+, NumPy 2.x, Rich 13.7-14.x
- **Freshness:** current
- **Recheck trigger:** Any source, test, packaging, or dependency-range change
<!-- /operational-state:entry -->

<!-- operational-state:entry
{"id":"VER-002","title":"Versioned experiment record/replay/comparison system","state":"verified","capability":"Six-station laboratory records strict versioned experiment JSON, exports/imports it, replays real simulator logic stepwise or continuously, verifies final hashes, compares runs descriptively, exposes executable invariants, and provides CLI parity.","scope":"labui experiments/server/UI plus cli.main","verification_method":"81-test full suite, compileall, all JS parse, CLI list/run/validate/replay/compare round trip, loopback dashboard smoke","evidence":"VALIDATION.md","artifact_revision":"v1.9.0","last_verified":"2026-09-18T19:53:52Z","dependencies":"existing Python/NumPy/Rich stack only","freshness":"current","recheck_trigger":"Any experiment, session, server route, CLI, or telemetry-ledger change"}
-->
### VER-002 — Versioned experiment record/replay/comparison system
- **State:** `verified`
- **Capability:** Strict versioned experiment sessions, manual action recording, import/export, real deterministic replay, checkpoint stepping, descriptive A/B comparison, executable invariant proof and CLI parity operate over the existing six-station laboratory.
- **Evidence:** 81 passing tests, compileall, all shipped JS parse, CLI experiment round trip and loopback dashboard smoke.
- **Artifact revision:** v1.9.0
<!-- /operational-state:entry -->

## 6. Known Not Working
<!-- operational-state:entry
{"id":"BKN-001","title":"Planet visualization absent on user macOS path through v1.8.5","state":"failed","capability":"Station 01 should visibly render the planet and celestial environment.","scope":"browser UI / Planet station","evidence":"Repeated same-path user macOS evidence shows shell/state/controls loaded while Station 01 remains visually unchanged through v1.8.5. v1.8.3 briefly flashed a glow during reload; v1.8.5 produced no improvement.","diagnosis":"v1.8.5 disproved the prior cascade-only diagnosis: even after removing known canvas-opacity conflicts, the same user path remained unchanged. The exact late-render failure is therefore still unresolved. v1.8.6 deliberately bypasses that uncertainty by placing the minimum visible celestial scene in a static SVG resource inserted into the HTML response before scripts run, with an independent final safety layer and active-build identity.","last_checked":"2026-08-26","status":"active","recheck_trigger":"User visually confirms v1.8.6 or later on the same Mac browser path"}
-->
### BKN-001 — Planet visualization absent on user macOS path through v1.8.5
- **State:** `failed`
- **Capability:** Station 01 should visibly render the planet and celestial environment.
- **Evidence:** Repeated same-path macOS screenshots show a live shell/state/control path with a blank visualization stage through v1.8.5; the latest same-path report explicitly states there is no improvement.
- **Current diagnosis:** prior canvas-binding/cascade explanations were real defects but were not sufficient; v1.8.5 still showed no improvement on the same Mac path. The exact dynamic-render failure remains unresolved. A second plausible route-level failure was also identified: the launcher silently searched 8766–8775 when 8765 was occupied, which could leave a user reloading an older server tab. That explanation is inferred, not confirmed. v1.8.6 bypasses the renderer chain with a pre-script static SVG scene and removes silent port hopping while exposing the active build identity.
- **Status:** active until the repaired user path is visually confirmed.
<!-- /operational-state:entry -->

<!-- operational-state:entry
{"id":"IMP-001","title":"v1.8.3 independent Planet surface attempt","state":"failed","capability":"Independent core canvases were intended to guarantee a visible Planet surface.","scope":"browser UI / Planet station","evidence":"User macOS path disproved the repair; reload glow followed by blank stage.","artifact_revision":"v1.8.3","last_checked":"2026-08-26","status":"superseded","recheck_trigger":"none"}
-->
### IMP-001 — v1.8.3 independent Planet surface attempt
- **State:** `failed`
- **Status:** `superseded`
- **Evidence:** Same-path user testing disproved the repair.
<!-- /operational-state:entry -->

## 7. Implemented but Unverified
<!-- operational-state:entry
{"id":"IMP-002","title":"v1.8.4 lexical app-binding and persistent fallback repair","state":"failed","capability":"The dedicated Planet renderer now resolves the shared classic-script app binding by identifier, the starfield canvas is below the CSS fallback body, and no JS lifecycle hides the fallback sphere.","scope":"browser UI / Planet station","evidence":"54-test suite, Python compile, all JS parse, Node classic-script binding proof; exact macOS pixels still pending.","artifact_revision":"v1.8.4","last_checked":"2026-08-27T02:59:48Z","status":"superseded","recheck_trigger":"none"}
-->
### IMP-002 — v1.8.4 lexical app-binding and persistent fallback repair
- **State:** `failed`
- **Capability:** Core rendering now reads the actual `app` lexical binding; the starfield is layered below a permanent CSS fallback planet; no `core-render-live` transition can remove the final visible body.
- **Evidence:** 54 passing tests, Python compilation, all shipped JavaScript syntax checks, and a Node classic-script proof showing `app` resolves while `globalThis.app` is undefined.
- **Artifact revision:** v1.8.4
- **Status:** `superseded` by v1.8.5 after same-path user evidence showed no visible change.
<!-- /operational-state:entry -->

<!-- operational-state:entry
{"id":"IMP-003","title":"v1.8.5 single-owner Planet stacking repair","state":"failed","capability":"Station 01 was intended to have one guaranteed visual owner: dedicated core space and planet surfaces. The legacy #planet-canvas was forced transparent with an inline !important contract while retaining pointer input; duplicate legacy globe canvases were disabled; core-surface.css was served last.","scope":"browser UI / Planet station","evidence":"58-test suite, Python compile, all JS parse, explicit served-order regression, conflicting-opacity regression, inline cascade guard; same-path macOS pixels still pending.","artifact_revision":"v1.8.5","last_checked":"2026-08-27T03:15:00Z","status":"superseded","recheck_trigger":"none"}
-->
### IMP-003 — v1.8.5 single-owner Planet stacking repair
- **State:** `failed`
- **Capability:** Dedicated core space/planet surfaces own Station 01; the legacy canvas remains pointer-active but permanently transparent through inline `!important`; duplicate legacy globe/space canvases are disabled; the final stacking contract is served last.
- **Evidence:** 58 passing tests, Python compilation, all shipped JavaScript syntax checks, stylesheet-order regression, and explicit guards against either optional celestial stylesheet re-promoting the legacy canvas.
- **Artifact revision:** v1.8.5
- **Status:** `superseded` after same-path user evidence reported no improvement.
<!-- /operational-state:entry -->

<!-- operational-state:entry
{"id":"IMP-004","title":"v1.8.6 non-canvas base scene and last-load safety contract","state":"implemented-unverified","capability":"Station 01 contains a static SVG celestial scene inserted into the served Station 01 HTML before browser scripts execute, independent of Canvas2D/WebGL/application state. planet-safe.css/js load after every optional presentation layer, keep the legacy canvas pointer-active but visually transparent, suppress duplicate Planet renderers, and expose a visible v1.8.6 scene identity.","scope":"browser UI / Planet station","evidence":"65-test suite, Python compile, all JS parse, served-order regressions, static SVG extraction and independent CairoSVG render; same-path macOS pixels still pending.","artifact_revision":"v1.8.6","last_checked":"2026-08-27T03:32:00Z","status":"active","recheck_trigger":"Visual confirmation on the user macOS browser path"}
-->
### IMP-004 — v1.8.6 non-canvas base scene and last-load safety contract
- **State:** `implemented-unverified`
- **Capability:** A static SVG planet/star-system scene is present in the served HTML before browser scripts and cannot depend on renderer startup. A final direct stylesheet/script pair owns Station 01 visibility, leaves the old canvas input-only, suppresses duplicate visual canvases, and shows `SCENE 1.8.6 // SVG BASE` as active-build proof.
- **Evidence:** 65 passing tests, Python compilation, all JS syntax checks, served-order guards, and independent SVG-to-PNG rendering.
- **Artifact revision:** v1.8.6
<!-- /operational-state:entry -->

## 8. Unknown or Evidence-Stale State
Exact bitwise floating-point identity across different CPU architectures and different NumPy builds was not claimed. Determinism is verified under the supported single-process update path and strongest when Python/NumPy versions are pinned identically.

## 9. Pending Work
- Visually confirm v1.8.6 on the same user macOS browser path that demonstrated BKN-001. The visible `SCENE 1.8.6 // SVG BASE` marker is also the active-build identity check.

## 10. Active Decisions, Defaults, and Prohibitions
- Python 3.11+ with NumPy and Rich.
- Decimal register arithmetic, float64 grid simulation.
- No wall-clock timestamps in deterministic telemetry.
- Historical qualitative catastrophe magnitudes are represented as lower bounds rather than fabricated exact counts.
- Aureal Gate is anchored at Year 170; no extra exact war-casualty precision is invented.
- No placeholders, TODOs, stubbed `pass`, or allegorical replacements for canonical physics.
- Dashboard launch must bind the requested port exactly; it must not silently start a second laboratory instance on another port.

## 11. Validation and Evidence Matrix
| ID | Capability / invariant | State | Evidence | Required recheck | Recheck trigger |
|---|---|---|---|---|---|
| INV-001 | Immediate heliocide at zero Starsilk | verified | stellar + integration tests | rerun affected tests | stellar/runtime changes |
| INV-002 | Absolute Syrin nullification | verified | executor + scenario tests | rerun affected tests | nullifier/runtime changes |
| INV-003 | Deterministic bounded execution | verified | reproducibility, budget, telemetry tests | rerun full deterministic suite | executor/scenario/hash changes |
| INV-004 | Experiment identity excludes presentation timing | verified | experiment replay/hash tests + CLI/browser smoke | rerun experiment validation | schema/hash/replay/export changes |
| VER-002 | Experiment record/replay/comparison | verified | 81 tests + compile + JS parse + CLI + dashboard smoke | full experiment ladder | experiment/session/UI/CLI changes |
| VER-001 | Complete repository baseline | verified | VALIDATION.md | full validation ladder | any repository change |
| BKN-001 | Planet visible on user macOS path | failed through v1.8.5 | repeated same-path user evidence | same-path visual check | Planet rendering changes |
| IMP-002 | v1.8.4 lexical binding + persistent fallback repair | failed/superseded | same-path user evidence | none | superseded by v1.8.5 |
| IMP-003 | v1.8.5 single-owner stacking repair | failed/superseded | same-path user evidence: no improvement | none | superseded by v1.8.6 |
| IMP-004 | v1.8.6 non-canvas base scene | implemented-unverified | 65 tests + compile + JS parse + static SVG render + served-order guards | same-path visual check | user confirms v1.8.6 |

## 12. Current Change Scope and Impact Radius
Current completed change scope is the v1.9.0 deterministic experiment-session expansion across the existing six-station command center, CLI and telemetry ledger. Preserve INV-001 through INV-004, all six station identities, the display-first interaction shell, exact-port launch behavior and historical Planet evidence. The experiment/replay capability is verified; BKN-001 / IMP-004 remain separately unresolved pending same-path human visual confirmation and must not be promoted by unrelated simulator tests.

## 13. Compact Revision Log
- **Revision 7 — 2026-09-18:** Reconciled the source baseline to v1.9.0 and added the deterministic experiment-session system: strict versioned JSON, manual/preset action recording, six bounded presets, real replay with step/run/pause/checkpoint semantics, replay hash mismatch detection, descriptive A/B comparison, executable invariant proofs, cross-station HeliocideEvent -> Siege Wall composition, browser timeline/proof controls and drakken-lab experiment CLI parity. Validation: 81 tests, compileall, all shipped JS parse, CLI round trip and loopback dashboard smoke. Historical Planet user-path evidence remains unresolved and preserved.
- **Revision 6 — 2026-08-27:** User disproved v1.8.5 with “no improvement.” The repair strategy changed categories: Station 01 now contains a static SVG celestial scene inserted into the served HTML plus a final safety stylesheet/script and visible build identity. Canvas/WebGL layers are enhancements only; duplicate Planet renderers are suppressed. The launcher now refuses silent port hopping and exposes the build in the terminal, health endpoint, query string, header, and scene badge. User-path verification remains pending.
- **Revision 5 — 2026-08-27:** User disproved v1.8.4. Reload-flash analysis and full CSS-order audit found two later celestial stylesheets re-promoting the opaque legacy Planet canvas above the replacement scene. v1.8.5 removes both promotions, moves the core CSS contract last, adds inline `!important` transparency for the hit canvas, disables duplicate Station 01 globe renderers, and adds cascade regressions. User-path verification remains pending.
- **Revision 4 — 2026-08-27:** User disproved v1.8.3 and reported a brief reload glow before the stage returned blank. Root cause isolated to `globalThis.app` misuse plus starfield/fallback z-order. Added v1.8.4 lexical-binding and persistent-fallback repair as implemented-unverified.
- **Revision 3 — 2026-08-27:** Recorded the v1.8.2 macOS blank Planet viewport as BKN-001 and v1.8.3 independent core rendering as implemented-unverified pending same-path visual confirmation.
- **Revision 2 — 2026-08-26:** Promoted v1.0.0 to verified after 27 passing tests, compile/placeholder checks, CLI scenario/dashboard smokes, wheel build/metadata inspection, packaged-code execution, and one bounded hygiene/edge-semantics hardening pass.
- **Revision 1 — 2026-08-26:** Bootstrapped project state for the initial complete repository build. Validation pending.
