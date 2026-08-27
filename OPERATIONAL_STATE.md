# Operational State — The Drakken Terraforming Laboratory
<!-- operational-state:metadata
{
  "schema_version": 1,
  "project_id": "drakken-terraforming-laboratory",
  "project_name": "The Drakken Terraforming Laboratory",
  "project_root": "/mnt/data/drakken-terraforming-laboratory",
  "artifact_path": "",
  "state_revision": 4,
  "last_updated": "2026-08-27T02:59:48Z",
  "current_baseline": {
    "identity": "repository v1.8.4 / lexical app-binding Planet repair",
    "state": "implemented-unverified",
    "last_verified": null
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
Repository v1.0.0 is the verified baseline. Source tests, compile checks, CLI scenarios, wheel construction, package metadata, packaged-code execution, and placeholder scans all passed on 2026-08-26.

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

## 6. Known Not Working
<!-- operational-state:entry
{"id":"BKN-001","title":"Planet visualization absent on user macOS path through v1.8.3","state":"failed","capability":"Station 01 should visibly render the planet and celestial environment.","scope":"browser UI / Planet station","evidence":"Two user-provided macOS screenshots show shell/state/controls loaded while the visualization stage remains blank. User additionally reported that v1.8.3 briefly flashes a glow during reload before returning to the blank stage.","diagnosis":"v1.8.3 core-surface.js incorrectly read globalThis.app even though app.js declares top-level const app. Classic-script lexical app is visible by identifier but is not a window/globalThis property. The core space canvas also sat above the CSS emergency sphere, so its black background covered the only fallback body.","last_checked":"2026-08-26","status":"active","recheck_trigger":"User visually confirms v1.8.4 or later on the same Mac browser path"}
-->
### BKN-001 — Planet visualization absent on user macOS path through v1.8.3
- **State:** `failed`
- **Capability:** Station 01 should visibly render the planet and celestial environment.
- **Evidence:** Two user-provided macOS screenshots show a live shell/state/control path with a blank visualization stage; v1.8.3 briefly flashes a glow during reload before returning to blank.
- **Root cause:** `core-surface.js` used `globalThis.app`, but `app.js` declares `const app`; later classic scripts can resolve `app` by identifier, while `globalThis.app` is `undefined`. The black core-space canvas also overlaid the CSS fallback sphere.
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
{"id":"IMP-002","title":"v1.8.4 lexical app-binding and persistent fallback repair","state":"implemented-unverified","capability":"The dedicated Planet renderer now resolves the shared classic-script app binding by identifier, the starfield canvas is below the CSS fallback body, and no JS lifecycle hides the fallback sphere.","scope":"browser UI / Planet station","evidence":"54-test suite, Python compile, all JS parse, Node classic-script binding proof; exact macOS pixels still pending.","artifact_revision":"v1.8.4","last_checked":"2026-08-27T02:59:48Z","status":"active","recheck_trigger":"Visual confirmation on the user macOS browser path"}
-->
### IMP-002 — v1.8.4 lexical app-binding and persistent fallback repair
- **State:** `implemented-unverified`
- **Capability:** Core rendering now reads the actual `app` lexical binding; the starfield is layered below a permanent CSS fallback planet; no `core-render-live` transition can remove the final visible body.
- **Evidence:** 54 passing tests, Python compilation, all shipped JavaScript syntax checks, and a Node classic-script proof showing `app` resolves while `globalThis.app` is undefined.
- **Artifact revision:** v1.8.4
<!-- /operational-state:entry -->

## 8. Unknown or Evidence-Stale State
Exact bitwise floating-point identity across different CPU architectures and different NumPy builds was not claimed. Determinism is verified under the supported single-process update path and strongest when Python/NumPy versions are pinned identically.

## 9. Pending Work
- Visually confirm v1.8.4 on the same user macOS browser path that demonstrated BKN-001 before promoting the Planet display to verified.

## 10. Active Decisions, Defaults, and Prohibitions
- Python 3.11+ with NumPy and Rich.
- Decimal register arithmetic, float64 grid simulation.
- No wall-clock timestamps in deterministic telemetry.
- Historical qualitative catastrophe magnitudes are represented as lower bounds rather than fabricated exact counts.
- Aureal Gate is anchored at Year 170; no extra exact war-casualty precision is invented.
- No placeholders, TODOs, stubbed `pass`, or allegorical replacements for canonical physics.

## 11. Validation and Evidence Matrix
| ID | Capability / invariant | State | Evidence | Required recheck | Recheck trigger |
|---|---|---|---|---|---|
| INV-001 | Immediate heliocide at zero Starsilk | verified | stellar + integration tests | rerun affected tests | stellar/runtime changes |
| INV-002 | Absolute Syrin nullification | verified | executor + scenario tests | rerun affected tests | nullifier/runtime changes |
| INV-003 | Deterministic bounded execution | verified | reproducibility, budget, telemetry tests | rerun full deterministic suite | executor/scenario/hash changes |
| VER-001 | Complete repository baseline | verified | VALIDATION.md | full validation ladder | any repository change |
| BKN-001 | Planet visible on user macOS path | failed through v1.8.3 | user screenshots + reload flash report | same-path visual check | Planet rendering changes |
| IMP-002 | Lexical binding + persistent fallback repair | implemented-unverified | 54 tests + compile + JS parse + Node binding proof | same-path visual check | user confirms v1.8.4 |

## 12. Current Change Scope and Impact Radius
Current change scope is the bounded Planet-station visibility repair. Preserve INV-001 through INV-003 and the display-first interaction shell while repairing BKN-001. Do not promote Planet rendering to verified until the same macOS path that reproduced the failure visibly confirms it.

## 13. Compact Revision Log
- **Revision 4 — 2026-08-27:** User disproved v1.8.3 and reported a brief reload glow before the stage returned blank. Root cause isolated to `globalThis.app` misuse plus starfield/fallback z-order. Added v1.8.4 lexical-binding and persistent-fallback repair as implemented-unverified.
- **Revision 3 — 2026-08-27:** Recorded the v1.8.2 macOS blank Planet viewport as BKN-001 and v1.8.3 independent core rendering as implemented-unverified pending same-path visual confirmation.
- **Revision 2 — 2026-08-26:** Promoted v1.0.0 to verified after 27 passing tests, compile/placeholder checks, CLI scenario/dashboard smokes, wheel build/metadata inspection, packaged-code execution, and one bounded hygiene/edge-semantics hardening pass.
- **Revision 1 — 2026-08-26:** Bootstrapped project state for the initial complete repository build. Validation pending.
