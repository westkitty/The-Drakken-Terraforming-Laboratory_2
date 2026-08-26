# The Drakken Terraforming Laboratory

A deterministic computational laboratory for Drakken planetary transformation work, Starsilk Macro execution, stellar-core stability, and Siege Wall heliocide containment.

This repository treats the supplied Starsilk mechanics as literal simulation invariants. Starsilk is a programmable cosmological substrate. A Macro is an executable deterministic reality loop. Removing the final available Starsilk from an active stellar core is not a warning threshold: it is an immediate state transition to black-hole collapse. Any positive Syrin-blood contact nullifies the active Starsilk runtime and leaves its active threads inert.

## Interactive laboratory

`drakken-lab dashboard` is the product interface. It starts a loopback-only local server and opens an interactive browser workbench; it is not a terminal report. No Node, Vite, Docker, cloud service, account, or external runtime is required after the Python package is installed.

The workbench contains five live stations:

- **Planetary Transformation Workbench** — a rotatable planetary projection driven by the actual atmospheric, lithospheric, and thermal grids. Select Heat, Cool, Uplift, Fracture, Pressure, or CO₂ and click the planet to commit the corresponding Starsilk emission into the solver. Switch among composite, thermal, lithosphere, atmosphere, and Starsilk field views.
- **Starsilk Macro Runtime** — edit Macro source, compile it, step deterministic instructions one at a time, run/pause the execution cursor, inspect registers, and watch `EMIT` operations mutate the same live planet. A heliocide preset exposes the hard zero-Starsilk collapse boundary.
- **Starbinding Vector Bench** — aim star-dive vectors by offset and approach angle, vary velocity and withdrawal fraction, and commit them against the actual ray/core intersection model. Hits, misses, surviving partial withdrawals, and heliocide are visually distinct.
- **Siege Wall Heliocide Lattice** — generate singularities from actual `HeliocideEvent` objects, place orbital nodes, solve the inverse-square anchoring matrix, visualize event-horizon sources and node loads, and deliberately drive the lattice into a capacity fracture.
- **Deterministic Telemetry Ledger** — inspect the ordered mutation record without introducing wall-clock input into simulation state.

Syrin blood injection is available from the main workbench. Any positive finite contact immediately makes the Starsilk runtime inert and disables Starsilk-driven controls until the entire laboratory session is reset. Natural planetary solver stepping remains possible because nullifying Starsilk does not freeze ordinary physics.

Launch it:

```bash
drakken-lab dashboard
```

By default the laboratory binds only to `127.0.0.1:8765`. If that port is occupied, the launcher searches the next ten ports rather than terminating an unrelated process. Use `--no-open` when you want the server without an automatic browser tab.

## Canon invariants encoded in the runtime

1. **Starsilk is programmable substrate, not metaphor.** Macro source is parsed into an AST and executed by a bounded deterministic runtime.
2. **Total stellar-core depletion causes immediate heliocide.** `StarRegistry.withdraw()` clamps an overdraw to the Starsilk actually present; when remaining Starsilk becomes exactly zero, the core changes to `collapsed` and a `HeliocideEvent` is emitted in the same instruction step.
3. **Syrin blood is an absolute nullification exception.** Any strictly positive contact fraction flips the runtime to inert. The instruction at which the contact is observed is not executed, and no later Macro work resumes in that runtime.
4. **Starbinding uses explicit star-dive vectors.** The scenario uses ray/sphere core interception. Successful dives perform core Starsilk withdrawal and therefore collapse the targeted star when the configured withdrawal fraction is 1.
5. **Blood Eclipse catastrophe scale is represented as a conservative floor, not invented precision.** The historical constants use Year 170 and numerical lower bounds for the canon wording “thousands of stars” and “trillions of lives.”
6. **The Siege Wall is a black-hole containment lattice.** Heliocide events become tracked singularities with Schwarzschild radii. Orbital nodes participate in an inverse-square anchoring matrix and fracture if a node enters an event horizon or exceeds its declared gravimetric anchoring capacity.

## Repository layout

```text
.
├── OPERATIONAL_STATE.md
├── README.md
├── VALIDATION.md
├── pyproject.toml
├── src
│   ├── cli
│   │   ├── dashboard.py
│   │   ├── main.py
│   │   ├── repl.py
│   │   └── telemetry.py
│   ├── core
│   │   ├── errors.py
│   │   ├── starsilk
│   │   │   ├── ast.py
│   │   │   ├── executor.py
│   │   │   ├── nullification.py
│   │   │   ├── parser.py
│   │   │   └── registers.py
│   │   └── stellar
│   │       ├── models.py
│   │       ├── monitor.py
│   │       └── physics.py
│   ├── labui
│   │   ├── server.py
│   │   ├── session.py
│   │   └── static
│   │       ├── app.js
│   │       ├── index.html
│   │       └── styles.css
│   ├── scenarios
│   │   ├── constants.py
│   │   ├── siege_wall.py
│   │   ├── starbinding.py
│   │   └── syrin_cascade.py
│   └── sim
│       ├── lattice
│       │   ├── anchoring.py
│       │   ├── horizons.py
│       │   ├── models.py
│       │   └── wall.py
│       └── terraforming
│           ├── engine.py
│           └── grids.py
└── tests
    ├── test_executor.py
    ├── test_integration.py
    ├── test_labui.py
    ├── test_lattice.py
    ├── test_parser.py
    ├── test_registers.py
    ├── test_scenarios.py
    ├── test_stellar.py
    ├── test_telemetry.py
    └── test_terraforming.py
```

All package directories also contain `__init__.py` files.

## Requirements and installation

- Python 3.11+
- NumPy 2.x
- Rich 13.7–14.x
- pytest 8.x for development/tests

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e '.[dev]'
pytest
```

## CLI

After installation:

```bash
drakken-lab dashboard
drakken-lab report
drakken-lab scenario starbinding
drakken-lab scenario siege-wall
drakken-lab scenario syrin
drakken-lab repl
```

Scale the Starbinding surrogate while keeping deterministic geometry:

```bash
drakken-lab scenario starbinding --stars 32 --represented-per-star 250000000
```

Run a Siege Wall configuration with explicit lattice capacity:

```bash
drakken-lab scenario siege-wall --singularities 16 --nodes 24 --capacity 0.05
```

Inject Syrin contamination at a precise instruction boundary:

```bash
drakken-lab scenario syrin --repeat 100 --contact-step 12 --contact-fraction 1e-18
```

## Starsilk Macro syntax

The language is intentionally small. Every operation is deterministic and line-oriented.

### Register operations

```text
SET counter 0
ADD counter 1
MUL counter 2
DIV counter 4
ASSERT counter == 2
```

Registers use Python `Decimal` arithmetic with 50-digit precision and a default absolute magnitude ceiling of `1e100`. Crossing the configured ceiling raises `RegisterOverflowError`. Division by zero raises `RegisterDomainError`.

Supported assertion operators: `==`, `!=`, `<`, `<=`, `>`, `>=`.

### Reality loops

```text
REPEAT 4 {
  ADD counter 1
  EMIT THERMAL_ENERGY 0 2 2 5e12
}
```

`MacroExecutor` has separate instruction and loop-cycle budgets. The defaults are 100,000 statements and 10,000 repeat cycles. Exceeding either budget raises a hard domain error; the runtime does not silently truncate a loop.

### Stellar Starsilk withdrawal

```text
WITHDRAW LAB-STAR 0.25
WITHDRAW LAB-STAR 0.75
```

The second instruction removes the final Starsilk and therefore creates a black hole immediately. The event includes the stellar mass and Schwarzschild radius. There is no grace threshold and no “nearly depleted” collapse.

The CLI macro runner creates one star named `LAB-STAR` with one unit of Starsilk.

### Terraforming emissions

The macro runtime emits typed commands. `TerraformingEngine` consumes them.

```text
EMIT ATMOS_PRESSURE 0 4 4 1200
EMIT ATMOS_GAS co2 0 4 4 0.002
EMIT LITHO_ELEVATION 0 4 4 50
EMIT LITHO_STRESS 0 4 4 1e8
EMIT THERMAL_ENERGY 0 4 4 5e12
```

Argument order:

| Channel | Arguments |
|---|---|
| `ATMOS_PRESSURE` | `layer row col delta_pa` |
| `ATMOS_GAS` | `species layer row col delta_fraction` |
| `LITHO_ELEVATION` | `layer row col delta_m` |
| `LITHO_STRESS` | `layer row col delta_pa` |
| `THERMAL_ENERGY` | `layer row col energy_j` |

The atmospheric model tracks pressure, temperature, and normalized gas fractions across a 3-D grid. The lithosphere tracks elevation, stress, and density. The thermal grid tracks temperature using explicit cell heat capacity. Grid steps use a deterministic Neumann-boundary finite-difference update.

## Running a macro against a planet

Create `sample.starsilk`:

```text
SET pulse 0
REPEAT 3 {
  ADD pulse 1
  EMIT ATMOS_PRESSURE 0 3 3 250
  EMIT THERMAL_ENERGY 0 3 3 5e12
}
ASSERT pulse == 3
```

Then:

```bash
drakken-lab macro sample.starsilk --planet
```

The JSON result includes the macro status, registers, emissions, any heliocide events, and a SHA-256 planetary state hash.

## Syrin nullification semantics

The nullifier accepts a `contact_fraction`. Zero means no contact. Every positive finite quantity, however small, is sufficient to invalidate active Starsilk behavior. Once contact exists, the runtime remains inert. This repository does not implement resistance, recovery, attenuation, partial operation, or an immunity roll because those would contradict the supplied mechanic.

Programmatic injection:

```python
runtime.contact_syrin_blood(contact_fraction=1e-30)
```

For deterministic tests or scenario playback, `MacroExecutor.execute(..., step_hook=...)` can introduce contact at an exact instruction boundary. Contact is checked before that instruction mutates state.

## Stellar model

`StarCore` tracks:

- stellar mass in solar masses
- radius in solar radii
- effective surface temperature
- Starsilk capacity and remaining Starsilk
- active/collapsed state

`StellarStabilityMonitor` reports:

- Starsilk bond index (`remaining / capacity`)
- Stefan–Boltzmann surface radiative flux
- luminosity
- escape velocity

A collapse event computes the Schwarzschild radius using the actual modeled stellar mass.

## Starbinding scenario

`run_starbinding()` generates deterministic radial dive vectors. Each ray must intersect a modeled stellar core sphere before withdrawal occurs. The default surrogate simulates 16 targeted stars while declaring each simulated star to represent 250,000,000 successful dives, yielding a represented catastrophe scale of 4 billion collapses when every vector succeeds.

This scale factor is explicit scenario metadata. It does not alter individual collapse physics and does not pretend the simulator iterated billions of objects.

## Blood Eclipse War boundary conditions

`scenarios.constants.BLOOD_ECLIPSE_SCALE` encodes:

- final Aureal Gate / war endpoint: Year 170
- conservative floor for “thousands of stars”: 2,000
- conservative floor for “trillions of lives”: 2,000,000,000,000

These values are intentionally lower bounds. The code refuses to invent an exact historical count where the governing canon provides only a plural magnitude.

## Siege Wall lattice

The Siege Wall path is:

1. Deplete a stellar core completely.
2. Receive the resulting `HeliocideEvent`.
3. Convert the event to a `BlackHoleRecord` at a declared spatial coordinate.
4. Track its event horizon.
5. Add it to the lattice.
6. Compute singularity/node coupling through normalized inverse-square influence.
7. Evaluate each node's weighted local gravimetric load.
8. Fracture if a node is inside a horizon or exceeds capacity.

The model deliberately distinguishes singularities from orbital anchor nodes. A node is not itself a black hole.

## Telemetry

`TelemetryLogger` writes deterministic JSONL records. It does not include wall-clock timestamps. Each record contains:

- monotonic sequence number
- topic
- payload
- previous record hash
- current SHA-256 hash

Existing logs are revalidated on resume. A discontinuous sequence or invalid hash fails immediately.

```bash
drakken-lab macro sample.starsilk --planet --telemetry telemetry/run.jsonl
```

## Determinism contract

The laboratory avoids ambient entropy:

- no unseeded randomness
- no wall-clock input in simulation state
- no asynchronous update order
- bounded Decimal macro arithmetic
- fixed-order iteration for state hashes and lattice inputs
- NumPy `float64` grid state with explicit single-process update equations

The supplied tests assert repeatability of scenario reports and planetary state hashes within the supported dependency range. Exact cross-architecture floating-point identity is strongest when Python and NumPy versions are pinned to the same versions; the simulation does not use parallel reductions or BLAS-backed matrix multiplication in its state update path.

## Error model

The project fails loudly on conditions that would invalidate a result:

- `ParseError` — invalid macro grammar or non-finite numeric literal
- `MacroCycleLimitExceeded` — reality loop exceeded cycle budget
- `MacroStepLimitExceeded` — instruction budget exceeded
- `RegisterOverflowError` — register magnitude exceeded numeric domain
- `RegisterDomainError` — invalid arithmetic/assertion/thread state
- `PhysicsDomainError` — impossible/non-finite stellar or planetary state
- `TerraformingCommandError` — invalid emitted grid command
- `LatticeFractureError` — node horizon incursion, singular anchoring state, or capacity breach

## Test suite

Run:

```bash
pytest
```

The suite covers:

- local browser server delivery and API mutation paths
- browser-session planetary brush behavior, Macro stepping, Starbinding vector hits/misses, Siege Wall stable/fractured states, and Syrin UI lockout
- parsing and nested repeat blocks
- bounded Decimal arithmetic and overflow
- loop/cycle enforcement
- Syrin interruption semantics
- partial versus total Starsilk depletion
- immediate heliocide event generation
- radiative/stellar observables
- atmosphere, lithosphere, and thermal emission application
- deterministic planetary state hashes
- event-horizon tracking
- lattice capacity fracture
- Starbinding, Siege Wall, and Syrin scenario reproducibility
- end-to-end Macro → planetary grid + heliocide integration

No test relies on network access.
