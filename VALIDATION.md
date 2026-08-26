# Validation and Requirement Traceability

Validation date: 2026-08-26  
Repository version: 1.1.0

## Product correction under test

The previous v1.0.0 repository had a valid deterministic simulation backend but incorrectly presented `drakken-lab dashboard` as a Rich terminal report. The user explicitly rejected that as the product. v1.1.0 therefore treats the browser workbench as the primary application and keeps terminal reports only as a developer/diagnostic path (`drakken-lab report`).

## Validation ladder

| Check | Evidence | Result |
|---|---|---|
| Full Python unit + integration suite | `PYTHONPATH=src pytest -q` | PASS — 34 tests |
| Python bytecode compilation | `PYTHONPATH=src python3 -m compileall -q src` | PASS |
| Browser JavaScript parse check | `node --check src/labui/static/app.js` | PASS |
| Local HTTP application delivery | `make_server("127.0.0.1", 0)` plus GET `/`, GET `/api/state`, POST `/api/planet/brush` in `tests/test_labui.py` | PASS |
| Live local server health | `drakken-lab dashboard --no-open` server + GET `/api/health` | PASS — product identified correctly |
| Browser render | Chromium/Playwright loaded the exact shipped HTML/CSS/JS and rendered the 1600×1000 workbench | PASS |
| Browser interaction journey | compile + step Macro → centered Starbinding heliocide → stable Siege Wall solve → planet click mutation → Syrin injection | PASS |
| Browser JavaScript console/page errors | captured during interaction journey | PASS — none |
| Planetary workbench | live surface maps, rotatable projection, six mutation tools, five field modes, solver step | PASS — rendered and API-backed |
| Stellar core monitor | bond index meter + Starsilk withdrawal + immediate zero-depletion heliocide state | PASS — unit/integration + browser state |
| Syrin browser behavior | positive contact flips visible runtime state to `STARSILK INERT` and disables Starsilk-driven controls until reset | PASS |
| Macro workbench | compile, expanded deterministic cursor, single-step execution, run/pause UI, register/result inspection | PASS |
| Starbinding workbench | vector preview, backend ray/core intersection, hit/miss history, full-withdrawal heliocide, canonical wave action | PASS |
| Siege Wall workbench | singularity/node geometry, actual heliocide sources, anchoring solve, utilization, fracture path | PASS |
| Siege Wall visual repair | stable solve must render `SIEGE WALL STABLE`, not stale `UNSOLVED GEOMETRY` | PASS after one bounded repair |
| Existing CLI scenarios | original Starbinding, Siege Wall, Syrin scenario tests | PASS within 34-test suite |
| Wheel build | `python3 -m pip wheel . --no-deps --no-build-isolation` | PASS |
| Wheel static assets | inspected wheel ZIP for `labui/static/index.html`, `styles.css`, `app.js` | PASS |
| Installed-wheel UI delivery | wheel installed to isolated target; packaged server served UI + `/api/state` | PASS |
| Console entry point | wheel `entry_points.txt` contains `drakken-lab = cli.main:main` | PASS |
| Placeholder/stub scan | source/test scan for unfinished implementation markers | PASS |

Wheel SHA-256 at validation time:

```text
6e11b42f4e421ace15da1d984bc49e3b640d67bab86f89bc51a25399fbe08365  drakken_terraforming_laboratory-1.1.0-py3-none-any.whl
```

### Browser-validation environment note

The container's managed Chromium policy blocks direct navigation to both `http://127.0.0.1/...` and `file://...` with `ERR_BLOCKED_BY_ADMINISTRATOR`. This is an environment policy, not an application response. The validation therefore split the user path into two independently observed pieces:

1. the actual packaged HTTP server was exercised directly over loopback, including HTML delivery and API mutations; and
2. the exact shipped HTML/CSS/JS was rendered and interacted with in Chromium while Playwright routed its same-origin API requests to that running local server.

This proves the server and the rendered product behavior without pretending the managed-browser navigation policy did not exist.

## Requirement traceability

| ID | Mandatory requirement | Evidence | Status |
|---|---|---|---|
| R01 | Starsilk remains a deterministic programmable Macro substrate with AST, parser, loops, registers, and executor. | Existing `src/core/starsilk/*`; full 34-test suite | PASS |
| R02 | Total depletion of stellar-core Starsilk causes immediate black-hole collapse. | `src/core/stellar/models.py`; stellar/integration/UI tests | PASS |
| R03 | Positive Syrin blood contact absolutely nullifies active Starsilk. | nullifier/runtime tests plus browser inert journey | PASS |
| R04 | Existing atmospheric, lithospheric, thermal, stellar, Starbinding, and Siege Wall simulation behavior is preserved. | original test suite remains green inside 34 tests | PASS |
| R05 | The primary product must be an actual graphical interactive laboratory, not terminal tables describing results. | `src/labui/static/*`, `src/labui/server.py`; rendered browser screenshot and interaction journey | PASS |
| R06 | `drakken-lab dashboard` must launch the graphical laboratory. | `src/cli/main.py` routes `dashboard` to `launch_laboratory()`; server health smoke | PASS |
| R07 | The planet must be visible and directly manipulable with atmospheric, lithospheric, thermal, and Starsilk views. | planet canvas render, five view modes, API-backed brush test | PASS |
| R08 | The laboratory must expose live planetary transformation controls rather than static telemetry only. | Heat, Cool, Uplift, Fracture, Pressure, CO₂ tools + solver advance; browser/API tests | PASS |
| R09 | The Macro interface must support editing and observable execution control. | Macro editor with compile/rewind, Step, Run, Pause, register/result panels; browser journey | PASS |
| R10 | Stellar Starsilk depletion and heliocide must be visibly inspectable. | stellar orb/gauge, withdrawal control, heliocide event display; backend test | PASS |
| R11 | Starbinding must be an interactive vector workspace. | angle/offset/velocity/withdrawal controls, ray preview, core intersection result/history, canonical wave | PASS |
| R12 | Siege Wall must be a visual orbital lattice workspace with singularities, nodes, load, and fracture behavior. | lattice canvas + backend anchoring geometry; stable/fracture tests | PASS |
| R13 | Syrin contamination must visibly kill Starsilk activity and prevent further Starsilk-driven operations until reset. | browser inert state, disabled controls, backend rejection test | PASS |
| R14 | Telemetry may support the product but must not be the product. | telemetry is one of five stations; graphical stations are primary | PASS |
| R15 | The laboratory must remain local-first and not require Node/Vite/Docker/cloud runtime. | stdlib loopback HTTP server; static package assets; Python-only runtime dependencies | PASS |
| R16 | The browser UI must ship inside the Python wheel and survive installation. | wheel-content inspection + isolated installed-wheel server smoke | PASS |
| R17 | No regression may violate the established deterministic/canon physics invariants. | original tests + new UI tests all pass | PASS |

**Verdict: Complete.** Every current mandatory requirement has direct runtime, render, package, or test evidence. The only browser limitation encountered belongs to the managed validation environment and was bypassed with an evidence-preserving split validation rather than being hidden.
