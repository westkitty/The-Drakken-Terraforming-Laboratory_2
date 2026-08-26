# Validation and Requirement Traceability

Validation date: 2026-08-26  
Repository version: 1.3.0

## Product change under test

The controlling correction for v1.3 is visual and literal: **change the actual running application so it resembles the cinematic Drakken command-center concept; do not answer with another generated picture or mockup.**

The implementation therefore preserves the deterministic Python simulation and the validated v1.2 interaction model while replacing the product presentation with a real shipped command-center layer. The browser UI now renders the same live planetary state through a large cinematic globe, holographic instrument overlays, orbital/projector geometry, illuminated archive/dossier panels, and command-deck controls. The new presentation files are ordinary package assets loaded by `drakken-lab dashboard`; no concept image is used as a background or substituted for application behavior.

The globe renderer prefers a custom WebGL2 sphere when WebGL2 is available. A deterministic Canvas renderer provides the same application view when WebGL2 is unavailable. Both consume the actual server state. Presentation animation is not included in deterministic state hashes.

## Validation ladder

| Check | Evidence | Result |
|---|---|---|
| Full Python unit + integration suite | `PYTHONPATH=src pytest -q` | PASS — 46 tests |
| Python bytecode compilation | `PYTHONPATH=src python3 -m compileall -q src` | PASS |
| Browser JavaScript parse checks | `node --check` on `app.js`, `incubator.js`, `command-center.js` | PASS |
| Placeholder/stub scan | source/test scan for `TODO`, `FIXME`, `NotImplementedError`, and bare `pass` | PASS |
| Local HTTP product delivery | packaged server serves `/`, command-center CSS/JS, state API, and mutation APIs | PASS |
| Command-center assets are real product code | `server.py` injects `command-center.css` and `command-center.js`; no generated concept image is referenced | PASS |
| Shared globe data | Planet and Incubator presentation consume the same live planetary maps returned by `LaboratorySession.snapshot()` | PASS |
| Solver-backed fracture visualization | `stress_pa` is exported from the actual lithospheric solver and used by the renderer; Fracture brush and Fault-Tongue pulses produce nonzero stress | PASS |
| Planet mutation user path | browser click commits real mutation and changes deterministic planet hash | PASS |
| Macro user path | browser compile/run reaches complete Macro state | PASS |
| Starbinding user path | centered full-withdrawal vector produces actual heliocide/collapsed core | PASS |
| Siege Wall user path | browser solve produces stable non-fractured lattice under stable parameters | PASS |
| Incubator user path | Fault-Tongue hatch + pulses mutate shared planet and produce solver stress | PASS |
| Syrin user path | injection makes runtime inert and Incubator/command-center field visibly `NULLIFIED` | PASS |
| Browser console/page errors | captured across full interaction journey | PASS — none |
| 1600×960 product fit | rendered document width equals viewport width; no horizontal overflow | PASS |
| Actual command-center render | real browser application screenshot after 24 Fault-Tongue pulses | PASS — `/mnt/data/drakken-command-center-actual-24.png` |
| Canvas fallback renderer | headless Chromium user journey | PASS |
| WebGL2 implementation | shader/mesh/data-texture path parses and is packaged | IMPLEMENTED — runtime unavailable in managed headless Chromium |
| Graceful renderer selection | app automatically falls back when no WebGL2 context is exposed | PASS |
| Existing deterministic backend regression | Starsilk, stellar, terraforming, Starbinding, lattice, Syrin, telemetry tests inside full suite | PASS |
| Wheel build | `python3 -m pip wheel . --no-deps --no-build-isolation` | PASS |
| Wheel product assets | wheel contains command-center, Incubator, base UI assets, server/session code | PASS |
| Installed-wheel import/state smoke | isolated wheel target imports and exposes stress map | PASS |
| Installed-wheel HTTP UI smoke | isolated wheel serves root and command-center assets | PASS |

Final wheel SHA-256:

```text
05a628ac7d8991cb0e03c4157c593d400503af11b3c81fc8cd45a1fac55ade5a  drakken_terraforming_laboratory-1.3.0-py3-none-any.whl
```

### Browser environment limitation

The managed Chromium environment used for automated browser QA exposes neither WebGL nor WebGL2, including when its software-rendering flags are enabled. It also blocks direct loopback page navigation. Accordingly:

- the **actual loopback HTTP server and APIs** were exercised independently over `127.0.0.1`;
- the **exact shipped HTML/CSS/JavaScript** was rendered in Chromium with same-origin requests bridged to that running server;
- the **cinematic Canvas fallback** completed the full browser interaction journey and produced the actual screenshot referenced above;
- the WebGL2 code path is packaged, parsed, and statically inspected but remains `implemented-unverified` in this particular headless environment.

WebGL2 is an enhancement, not a completion dependency: the verified Canvas path supplies the redesigned application and preserves all product functions when WebGL2 is unavailable.

## Requirement traceability

| ID | Mandatory requirement | Evidence | Status |
|---|---|---|---|
| R01 | Starsilk remains a deterministic programmable Macro substrate. | core runtime + regression suite | PASS |
| R02 | Total stellar-core Starsilk depletion causes immediate black-hole collapse. | stellar/integration/browser journey | PASS |
| R03 | Positive Syrin blood contact absolutely nullifies active Starsilk. | nullifier/runtime/browser journey | PASS |
| R04 | Existing Planet, Macro, Starbinding, Siege Wall, Incubator, and telemetry behavior remains functional after the redesign. | 46-test suite + full browser journey | PASS |
| R05 | The **actual application**, not another picture/mockup, receives the cinematic command-center redesign. | shipped CSS/JS/server changes + real browser screenshot | PASS |
| R06 | The product shell materially resembles the target direction: dark command deck, illuminated navigation/header, cut-corner panels, holographic instrumentation, large central globe, dossier/archive rails, and integrated controls. | actual running browser render | PASS |
| R07 | The central globe visualizes actual shared simulation data, not canned art. | state-driven temperature/elevation/pressure/CO₂/stress textures/maps | PASS |
| R08 | Orange fracture/stress energy derives from actual lithospheric stress. | stress map exported by session + fracture/specimen tests | PASS |
| R09 | Drakken Incubator remains a real shared-state simulation surface with hatch/pulse/terminate controls. | API tests + browser Fault-Tongue journey | PASS |
| R10 | Syrin nullification is reflected in the redesigned visual state as well as backend state. | browser NULLIFIED journey | PASS |
| R11 | The redesign must remain local-first and not require Node, Vite, Docker, a cloud account, or a network runtime. | Python stdlib server + packaged browser assets | PASS |
| R12 | The redesign must survive environments without WebGL2. | verified automatic Canvas fallback | PASS |
| R13 | The complete product must ship in the Python wheel and remain launchable through `drakken-lab dashboard`. | wheel inspection + installed-wheel HTTP smoke | PASS |
| R14 | The UI must fit a normal desktop viewport without basic layout breakage. | 1600×960 browser QA | PASS |
| R15 | No generated concept image may masquerade as the implemented UI. | source inspection; actual screenshot captured from running app | PASS |

**Verdict: Complete with declared limitation.** All mandatory product requirements pass through the verified application path. The only declared limitation is runtime verification of the optional WebGL2 renderer in this headless environment; the automatic Canvas command-center renderer is fully browser-verified and is sufficient to satisfy the requested redesign.
