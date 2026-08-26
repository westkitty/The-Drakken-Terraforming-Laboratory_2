# Validation and Requirement Traceability

Validation date: 2026-08-26  
Repository version: 1.2.0

## v1.2.0 change under test

v1.1.0 corrected the original product mistake by making the browser workbench the primary laboratory. v1.2.0 adds the missing identity layer: a **Drakken Egg & Specimen Incubator** backed by the same deterministic planetary solver rather than a decorative lore panel.

The Incubator exposes four canon-attested archive phenotype models — Fault-Tongue, Obsidian Gul, Tremorhound, and Vortenbray — plus a clearly labeled non-canon Experimental Egg. Named archive profiles have locked laboratory coefficients. The Experimental Egg alone accepts user tuning. Numerical strengths and movement paths are simulation coefficients, not claims about exact canon biology.

## Validation ladder

| Check | Evidence | Result |
|---|---|---|
| Full Python unit + integration suite | `PYTHONPATH=src pytest -q` | PASS — 44 tests |
| Python bytecode compilation | `PYTHONPATH=src python -m compileall -q src` | PASS |
| Browser JavaScript parse check | `node --check src/labui/static/app.js` | PASS |
| Existing backend regression | original Starsilk, stellar, terraforming, Starbinding, Siege Wall, Syrin, telemetry tests | PASS inside 44-test suite |
| Specimen catalog | exact stable IDs + non-canon Experimental Egg classification | PASS |
| Specimen determinism | two independent Fault-Tongue sessions, same hatch point + 7 pulses | PASS — identical planet hashes |
| Archive profile lock | attempts to tune named archive phenotype | PASS — rejected |
| Experimental Egg compiler | signed thermal/elevation/pressure and tunable stress/CO₂ coefficients | PASS |
| 24-pulse endurance | every one of five profiles | PASS — finite state, 25-point trail |
| Shared planetary state | specimen pulses mutate the same `TerraformingEngine` used by Planet/Macro stations | PASS |
| Syrin / specimen boundary | contact nullifies the active Notebook Starsilk field and blocks further pulses | PASS; physical specimen death is not inferred |
| Local specimen API | POST hatch + pulse through actual HTTP server | PASS |
| Browser render | exact shipped HTML/CSS/JS rendered in headless Chromium | PASS |
| Browser Incubator journey | open Station 05 → choose Fault-Tongue → hatch → pulse → render trail/field signature | PASS |
| Browser JavaScript console/page errors | captured during Incubator journey | PASS — none |
| Browser Syrin journey | active specimen → Syrin injection → Incubator reads `NULLIFIED` | PASS |
| Wheel build | `python -m pip wheel . --no-deps --no-build-isolation` | PASS |
| Wheel contents | `labui/specimens.py`, server/session, and all three static UI assets inspected in wheel ZIP | PASS |
| Installed-wheel smoke | isolated wheel target imports specimen catalog and packaged Incubator HTML | PASS |
| Placeholder/stub scan | source/test scan for `TODO`, `FIXME`, `NotImplementedError`, and bare `pass` | PASS |

Wheel SHA-256:

```text
c4f087af6405284bf5158247f80ce34f4f51a3c2af05714bfd79c559a30387c4  drakken_terraforming_laboratory-1.2.0-py3-none-any.whl
```

### Browser-validation environment note

The managed Chromium build in this environment blocks direct loopback navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`. Validation therefore keeps the evidence split explicit: the actual local HTTP server is exercised over loopback by Python tests, while the exact shipped HTML/CSS/JS is rendered in Chromium with its same-origin `fetch()` calls bridged to that same running server. No static mock state replaces the backend.

## Requirement traceability

| ID | Mandatory requirement | Evidence | Status |
|---|---|---|---|
| R01 | Starsilk remains a deterministic programmable Macro substrate. | core runtime + regression suite | PASS |
| R02 | Total stellar-core Starsilk depletion causes immediate black-hole collapse. | stellar/integration/UI tests | PASS |
| R03 | Positive Syrin blood contact absolutely nullifies active Starsilk. | nullifier/runtime/browser tests | PASS |
| R04 | Existing atmospheric, lithospheric, thermal, Starbinding, and Siege Wall behavior is preserved. | 44-test suite | PASS |
| R05 | Primary product remains a graphical interactive laboratory rather than terminal tables. | shipped browser workbench | PASS |
| R06 | `drakken-lab dashboard` remains the graphical launcher. | CLI route + server smoke | PASS |
| R07 | Planetary state remains directly manipulable and shared across stations. | brush, Macro, and specimen tests | PASS |
| R08 | Macro interface remains editable and observable. | regression + browser product | PASS |
| R09 | Starbinding remains an interactive vector workspace with hard heliocide semantics. | regression tests | PASS |
| R10 | Siege Wall remains a visual lattice with capacity fracture behavior. | regression tests | PASS |
| R11 | Telemetry supports the product but is not the product. | UI structure | PASS |
| R12 | Laboratory remains local-first with no required Node/Vite/Docker/cloud runtime. | stdlib loopback server + Python package | PASS |
| R13 | Browser UI ships inside the Python wheel. | wheel inspection + isolated install smoke | PASS |
| R14 | Drakken themselves must become an executable part of the laboratory, not just branding. | Station 05 Incubator + shared solver mutations | PASS |
| R15 | Canon-attested specimen names/incident anchors must not be silently expanded into invented canon biology. | locked archive profiles + explicit model boundary in code/UI/README | PASS |
| R16 | A user must be able to create a new lab phenotype without declaring it canon. | Experimental Egg compiler, visibly labeled non-canon | PASS |
| R17 | Specimen actions must be deterministic and visibly leave a planetary trajectory/effect field. | deterministic hash test + browser trail/field signature render | PASS |
| R18 | Syrin contact must nullify the specimen's active Starsilk field without inventing physical death. | session state + UI status note + test | PASS |

**Verdict: Complete for v1.2.0.** The Incubator exists as an executable, shared-state laboratory system; all current mandatory rows pass.
