"""Command-line entrypoint for the Drakken Terraforming Laboratory."""
from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from pathlib import Path

from core.starsilk.executor import MacroExecutor, MacroRuntime
from core.starsilk.parser import MacroParser
from core.stellar.models import StarCore
from scenarios.siege_wall import SiegeWallConfig, run_siege_wall
from scenarios.starbinding import StarbindingConfig, run_starbinding
from scenarios.syrin_cascade import SyrinCascadeConfig, run_syrin_cascade
from sim.terraforming.engine import TerraformingEngine
from sim.terraforming.grids import AtmosphericGrid, LithosphereGrid, ThermalGrid
from .dashboard import render_banner, render_report
from .repl import run_repl
from .telemetry import TelemetryLogger


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="drakken-lab", description="Deterministic Drakken Starsilk simulation laboratory")
    sub = parser.add_subparsers(dest="command", required=True)

    scenario = sub.add_parser("scenario", help="run a reproducible historical/boundary scenario")
    scenario_sub = scenario.add_subparsers(dest="scenario", required=True)

    starbinding = scenario_sub.add_parser("starbinding")
    starbinding.add_argument("--stars", type=int, default=16)
    starbinding.add_argument("--represented-per-star", type=int, default=250_000_000)

    wall = scenario_sub.add_parser("siege-wall")
    wall.add_argument("--singularities", type=int, default=8)
    wall.add_argument("--nodes", type=int, default=12)
    wall.add_argument("--capacity", type=float, default=0.05)

    syrin = scenario_sub.add_parser("syrin")
    syrin.add_argument("--repeat", type=int, default=20)
    syrin.add_argument("--contact-step", type=int, default=7)
    syrin.add_argument("--contact-fraction", type=float, default=1e-12)

    macro = sub.add_parser("macro", help="execute a macro file and optionally apply emissions to a planet grid")
    macro.add_argument("file", type=Path)
    macro.add_argument("--planet", action="store_true", help="apply terraforming EMIT outputs to a 3D test planet")
    macro.add_argument("--telemetry", type=Path)

    sub.add_parser("repl", help="interactive Starsilk macro REPL")
    sub.add_parser("dashboard", help="show deterministic reference scenario dashboard")
    return parser


def _run_scenario(args: argparse.Namespace):
    if args.scenario == "starbinding":
        return "Starbinding", run_starbinding(
            StarbindingConfig(simulated_stars=args.stars, represented_stars_per_simulated=args.represented_per_star)
        )
    if args.scenario == "siege-wall":
        return "Siege Wall", run_siege_wall(
            SiegeWallConfig(singularities=args.singularities, orbital_nodes=args.nodes, node_capacity_m_s2=args.capacity)
        )
    if args.scenario == "syrin":
        return "Syrin Contamination Cascade", run_syrin_cascade(
            SyrinCascadeConfig(
                repeat_count=args.repeat,
                contaminate_at_step=args.contact_step,
                contact_fraction=args.contact_fraction,
            )
        )
    raise AssertionError(args.scenario)


def _run_macro(args: argparse.Namespace) -> int:
    source = args.file.read_text(encoding="utf-8")
    runtime = MacroRuntime()
    runtime.star_registry.add(StarCore(core_id="LAB-STAR"))
    result = MacroExecutor(runtime).execute(MacroParser().parse(source, source_name=str(args.file)))
    payload: dict[str, object] = {
        "status": result.status.value,
        "steps": result.steps,
        "cycles": result.cycles,
        "registers": result.registers,
        "emissions": [
            {"sequence": emission.sequence, "channel": emission.channel, "args": [str(arg) for arg in emission.args]}
            for emission in result.emissions
        ],
        "stellar_events": [event.event_id for event in result.stellar_events],
    }
    if args.planet:
        engine = TerraformingEngine(
            AtmosphericGrid(3, 8, 8),
            LithosphereGrid(2, 8, 8),
            ThermalGrid(3, 8, 8),
        )
        engine.apply_many(result.emissions)
        engine.step(1.0)
        payload["planet_state_hash"] = engine.state_hash()
    if args.telemetry:
        logger = TelemetryLogger(args.telemetry)
        payload["telemetry"] = logger.log("macro_execution", payload.copy())["hash"]
    print(json.dumps(payload, indent=2, sort_keys=True))
    return 0


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if args.command == "scenario":
        title, report = _run_scenario(args)
        render_report(title, report)
        return 0
    if args.command == "macro":
        return _run_macro(args)
    if args.command == "repl":
        render_banner()
        run_repl()
        return 0
    if args.command == "dashboard":
        render_banner()
        render_report("Starbinding", run_starbinding())
        render_report("Siege Wall", run_siege_wall())
        render_report("Syrin Contamination Cascade", run_syrin_cascade())
        return 0
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
