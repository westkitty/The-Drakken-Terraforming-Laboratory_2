"""Stateful local laboratory session backing the browser workbench.

The web UI is deliberately thin: every state-changing laboratory operation is
executed here against the same deterministic physics objects used by the CLI and
test suite. Browser animation is presentation; this module remains authoritative.
"""
from __future__ import annotations

from collections import deque
from dataclasses import asdict
from decimal import Decimal
import hashlib
import math
from threading import RLock
from typing import Any

import numpy as np

from core.errors import DrakkenLabError, LatticeFractureError
from core.starsilk.ast import Program, Repeat, Statement
from core.starsilk.executor import ExecutionResult, MacroEmission, MacroExecutor, MacroRuntime
from core.starsilk.parser import MacroParser
from core.stellar.models import StarCore, StarCoreState, StarRegistry
from scenarios.starbinding import StarbindingConfig, intersects_core, run_starbinding
from sim.lattice.models import BlackHoleRecord, OrbitalNode
from sim.lattice.wall import SiegeWallLattice
from sim.terraforming.engine import TerraformingEngine
from sim.terraforming.grids import AtmosphericGrid, LithosphereGrid, ThermalGrid
from .specimens import SPECIMEN_PROFILES, profile_catalog


LAB_ROWS = 36
LAB_COLS = 72
LAB_STAR_ID = "LAB-STAR"
MAX_UI_MACRO_INSTRUCTIONS = 10_000


def _float(value: Decimal | float | int) -> float:
    result = float(value)
    if not math.isfinite(result):
        raise ValueError("numeric value must be finite")
    return result


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return min(maximum, max(minimum, value))


class LaboratorySession:
    """One deterministic, in-memory laboratory experiment session."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._event_sequence = 0
        self._revision = 0
        self._telemetry: deque[dict[str, Any]] = deque(maxlen=160)
        self._macro_source = ""
        self._macro_instructions: list[Statement] = []
        self._macro_cursor = 0
        self._macro_hash = ""
        self._macro_last_result: dict[str, Any] | None = None
        self._starbinding_registry = StarRegistry()
        self._starbinding_history: deque[dict[str, Any]] = deque(maxlen=80)
        self._starbinding_sequence = 0
        self._siege_state: dict[str, Any] | None = None
        self._specimen: dict[str, Any] | None = None
        self._specimen_history: deque[dict[str, Any]] = deque(maxlen=160)
        self._specimen_sequence = 0
        self._reset_world(initial=True)

    # ------------------------------------------------------------------
    # Session lifecycle and deterministic presentation snapshots
    # ------------------------------------------------------------------
    def reset(self) -> dict[str, Any]:
        with self._lock:
            self._reset_world(initial=False)
            self._record("system", "Laboratory state reset", {"recovery": "full reset"})
            return self.snapshot()

    def _reset_world(self, *, initial: bool) -> None:
        atmosphere = AtmosphericGrid(4, LAB_ROWS, LAB_COLS)
        lithosphere = LithosphereGrid(2, LAB_ROWS, LAB_COLS)
        thermal = ThermalGrid(4, LAB_ROWS, LAB_COLS)

        # Deterministic synthetic test planet. This is laboratory geometry, not a
        # claim about a named canon world.
        lat = np.linspace(-math.pi / 2.0, math.pi / 2.0, LAB_ROWS, dtype=np.float64)[:, None]
        lon = np.linspace(-math.pi, math.pi, LAB_COLS, endpoint=False, dtype=np.float64)[None, :]
        elevation = (
            1450.0 * np.sin(2.0 * lon) * np.cos(lat) ** 2
            + 720.0 * np.cos(3.0 * lat + lon)
            + 280.0 * np.sin(5.0 * lon - 2.0 * lat)
        )
        surface_temp = 238.0 + 69.0 * np.cos(lat) ** 2 + 6.0 * np.sin(2.0 * lon) * np.cos(lat)
        surface_pressure = 101_325.0 * (0.88 + 0.12 * np.cos(lat) ** 2) - elevation * 4.2
        surface_pressure = np.maximum(surface_pressure, 35_000.0)

        lithosphere.elevation_m[0, :, :] = elevation
        lithosphere.elevation_m[1, :, :] = elevation * 0.35
        for layer in range(thermal.layers):
            thermal.temperature_k[layer, :, :] = surface_temp + layer * 17.0
        for layer in range(atmosphere.layers):
            atmosphere.temperature_k[layer, :, :] = surface_temp - layer * 8.0
            atmosphere.pressure_pa[layer, :, :] = surface_pressure * (0.72**layer)

        self.engine = TerraformingEngine(atmosphere, lithosphere, thermal)
        self.runtime = MacroRuntime()
        self.runtime.star_registry.add(StarCore(core_id=LAB_STAR_ID, starsilk_capacity=Decimal("1")))
        self._starbinding_registry = StarRegistry()
        self._starbinding_history.clear()
        self._starbinding_sequence = 0
        self._siege_state = None
        self._specimen = None
        self._specimen_history.clear()
        self._specimen_sequence = 0
        self._macro_source = ""
        self._macro_instructions = []
        self._macro_cursor = 0
        self._macro_hash = ""
        self._macro_last_result = None
        if initial:
            self._telemetry.clear()
            self._revision = 0
        else:
            self._revision += 1

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            star = self.runtime.star_registry.get(LAB_STAR_ID)
            event = self.runtime.star_registry.events[-1] if self.runtime.star_registry.events else None
            surface_temp = self.engine.thermal.temperature_k[0]
            surface_elevation = self.engine.lithosphere.elevation_m[0]
            surface_pressure = self.engine.atmosphere.pressure_pa[0]
            surface_co2 = self.engine.atmosphere.species_fraction["co2"][0]
            surface_stress = self.engine.lithosphere.stress_pa[0]
            return {
                "revision": self._revision,
                "inert": self.runtime.nullifier.inert,
                "nullification": (
                    asdict(self.runtime.nullifier.record) if self.runtime.nullifier.record is not None else None
                ),
                "planet": {
                    "rows": LAB_ROWS,
                    "cols": LAB_COLS,
                    "steps": self.engine.steps,
                    "state_hash": self.engine.state_hash(),
                    "maps": {
                        "temperature_k": np.round(surface_temp, 3).tolist(),
                        "elevation_m": np.round(surface_elevation, 3).tolist(),
                        "pressure_pa": np.round(surface_pressure, 3).tolist(),
                        "co2_fraction": np.round(surface_co2, 8).tolist(),
                        "stress_pa": np.round(surface_stress, 3).tolist(),
                    },
                    "stats": {
                        "temperature_min_k": round(float(surface_temp.min()), 3),
                        "temperature_mean_k": round(float(surface_temp.mean()), 3),
                        "temperature_max_k": round(float(surface_temp.max()), 3),
                        "elevation_min_m": round(float(surface_elevation.min()), 3),
                        "elevation_max_m": round(float(surface_elevation.max()), 3),
                        "pressure_mean_pa": round(float(surface_pressure.mean()), 3),
                        "co2_mean_fraction": round(float(surface_co2.mean()), 8),
                        "stress_max_pa": round(float(surface_stress.max()), 3),
                    },
                },
                "star": {
                    "core_id": star.core_id,
                    "state": star.state.value,
                    "bond_index": float(star.bond_index),
                    "starsilk_remaining": str(star.starsilk_remaining),
                    "temperature_k": star.temperature_k,
                    "mass_solar": star.mass_solar,
                    "heliocide_event": (
                        {
                            "event_id": event.event_id,
                            "step": event.step,
                            "horizon_radius_m": event.schwarzschild_radius_m,
                            "reason": event.reason,
                        }
                        if event is not None
                        else None
                    ),
                },
                "macro": self._macro_status(),
                "starbinding": {"history": list(self._starbinding_history)},
                "siege_wall": self._siege_state,
                "specimens": {
                    "catalog": profile_catalog(),
                    "active": self._specimen,
                    "history": list(self._specimen_history),
                },
                "telemetry": list(self._telemetry),
            }

    # ------------------------------------------------------------------
    # Planet workbench
    # ------------------------------------------------------------------
    def apply_brush(
        self,
        *,
        tool: str,
        row: int,
        col: int,
        intensity: float,
        radius: int,
    ) -> dict[str, Any]:
        with self._lock:
            if self.runtime.nullifier.inert:
                raise DrakkenLabError("Starsilk runtime is inert; full laboratory reset is required")
            if not (0 <= row < LAB_ROWS and 0 <= col < LAB_COLS):
                raise ValueError("brush coordinates are outside the planetary grid")
            intensity = _clamp(_float(intensity), 1.0, 100.0)
            radius = int(_clamp(float(radius), 1.0, 8.0))
            tool = tool.lower()
            if tool not in {"heat", "cool", "uplift", "fracture", "pressure", "co2"}:
                raise ValueError(f"unknown planetary tool {tool!r}")

            emissions: list[MacroEmission] = []
            sigma = max(0.75, radius / 2.1)
            sequence = 0
            for drow in range(-radius, radius + 1):
                target_row = row + drow
                if not 0 <= target_row < LAB_ROWS:
                    continue
                for dcol in range(-radius, radius + 1):
                    distance = math.sqrt(drow * drow + dcol * dcol)
                    if distance > radius:
                        continue
                    target_col = (col + dcol) % LAB_COLS
                    weight = math.exp(-(distance * distance) / (2.0 * sigma * sigma))
                    sequence += 1
                    args: tuple[Decimal | str, ...]
                    if tool == "heat":
                        energy = Decimal(str(intensity * 5.0e11 * weight))
                        args = (Decimal(0), Decimal(target_row), Decimal(target_col), energy)
                        channel = "THERMAL_ENERGY"
                    elif tool == "cool":
                        energy = Decimal(str(-intensity * 3.2e11 * weight))
                        args = (Decimal(0), Decimal(target_row), Decimal(target_col), energy)
                        channel = "THERMAL_ENERGY"
                    elif tool == "uplift":
                        delta = Decimal(str(intensity * 16.0 * weight))
                        args = (Decimal(0), Decimal(target_row), Decimal(target_col), delta)
                        channel = "LITHO_ELEVATION"
                    elif tool == "fracture":
                        delta = Decimal(str(intensity * 5.0e6 * weight))
                        args = (Decimal(0), Decimal(target_row), Decimal(target_col), delta)
                        channel = "LITHO_STRESS"
                    elif tool == "pressure":
                        delta = Decimal(str(intensity * 260.0 * weight))
                        args = (Decimal(0), Decimal(target_row), Decimal(target_col), delta)
                        channel = "ATMOS_PRESSURE"
                    else:
                        delta = Decimal(str(intensity * 1.8e-5 * weight))
                        args = ("co2", Decimal(0), Decimal(target_row), Decimal(target_col), delta)
                        channel = "ATMOS_GAS"
                    emissions.append(MacroEmission(sequence=sequence, channel=channel, args=args))

            self.engine.apply_many(emissions)
            self.engine.step(0.5)
            self._record(
                "planet",
                f"{tool} brush committed",
                {"row": row, "col": col, "intensity": intensity, "radius": radius, "cells": len(emissions)},
            )
            return self.snapshot()

    def step_planet(self, *, seconds: float) -> dict[str, Any]:
        with self._lock:
            seconds = _clamp(_float(seconds), 0.01, 1_000.0)
            self.engine.step(seconds)
            self._record("planet", "Planetary solver advanced", {"dt_s": seconds})
            return self.snapshot()

    # ------------------------------------------------------------------
    # Starsilk and stellar-core controls
    # ------------------------------------------------------------------
    def inject_syrin(self, *, contact_fraction: float) -> dict[str, Any]:
        with self._lock:
            contact_fraction = _float(contact_fraction)
            if contact_fraction <= 0:
                raise ValueError("Syrin contact fraction must be strictly positive")
            record = self.runtime.contact_syrin_blood(contact_fraction=contact_fraction, source="laboratory injection")
            assert record is not None
            if self._specimen is not None and self._specimen.get("active"):
                self._specimen["active"] = False
                self._specimen["field_state"] = "nullified"
                self._specimen["status_note"] = "Notebook Starsilk field nullified by Syrin contact; physical specimen state is not inferred."
            self._record(
                "syrin",
                "Absolute Starsilk nullification interrupt",
                {"contact_fraction": record.contact_fraction, "sequence": record.sequence},
            )
            return self.snapshot()

    def withdraw_star(self, *, fraction: float) -> dict[str, Any]:
        with self._lock:
            if self.runtime.nullifier.inert:
                raise DrakkenLabError("Starsilk runtime is inert; stellar withdrawal cannot execute")
            fraction = _clamp(_float(fraction), 0.000001, 1.0)
            core = self.runtime.star_registry.get(LAB_STAR_ID)
            if core.state is StarCoreState.COLLAPSED:
                raise DrakkenLabError("stellar core has already collapsed")
            amount = core.starsilk_capacity * Decimal(str(fraction))
            event = self.runtime.star_registry.withdraw(LAB_STAR_ID, amount, step=self._revision + 1)
            self._record(
                "stellar",
                "Stellar-core Starsilk withdrawal",
                {
                    "requested_fraction": fraction,
                    "bond_index": float(core.bond_index),
                    "heliocide": event is not None,
                    "event_id": event.event_id if event is not None else None,
                },
            )
            return self.snapshot()

    # ------------------------------------------------------------------
    # Macro editor / deterministic stepping
    # ------------------------------------------------------------------
    def load_macro(self, *, source: str) -> dict[str, Any]:
        with self._lock:
            if len(source.encode("utf-8")) > 256_000:
                raise ValueError("macro source exceeds the 256 KiB laboratory editor limit")
            program = MacroParser().parse(source, source_name="laboratory-editor")
            instructions: list[Statement] = []
            self._flatten(program.statements, instructions)
            if len(instructions) > MAX_UI_MACRO_INSTRUCTIONS:
                raise ValueError(
                    f"expanded macro contains {len(instructions)} instructions; "
                    f"laboratory stepper limit is {MAX_UI_MACRO_INSTRUCTIONS}"
                )
            self._macro_source = source
            self._macro_instructions = instructions
            self._macro_cursor = 0
            self._macro_hash = hashlib.sha256(source.encode("utf-8")).hexdigest()
            self._macro_last_result = None
            self._record(
                "macro",
                "Macro loaded into deterministic stepper",
                {"instructions": len(instructions), "source_hash": self._macro_hash},
            )
            return self.snapshot()

    def macro_step(self) -> dict[str, Any]:
        with self._lock:
            if not self._macro_instructions:
                raise DrakkenLabError("no macro is loaded")
            if self._macro_cursor >= len(self._macro_instructions):
                return self.snapshot()
            statement = self._macro_instructions[self._macro_cursor]
            thread_id = f"ui-step-{self._macro_cursor + 1}"
            result = MacroExecutor(self.runtime, max_steps=8, max_cycles=8).execute(
                Program((statement,), source_name="laboratory-step"),
                thread_id=thread_id,
            )
            self.runtime.threads.pop(thread_id, None)
            if result.emissions:
                self.engine.apply_many(result.emissions)
                self.engine.step(0.25)
            self._macro_cursor += 1
            self._macro_last_result = self._execution_result(result, statement.span.line)
            self._record(
                "macro",
                "Macro instruction executed",
                {
                    "cursor": self._macro_cursor,
                    "total": len(self._macro_instructions),
                    "line": statement.span.line,
                    "status": result.status.value,
                    "emissions": len(result.emissions),
                    "heliocide_events": len(result.stellar_events),
                },
            )
            return self.snapshot()

    def macro_run(self) -> dict[str, Any]:
        with self._lock:
            if not self._macro_instructions:
                raise DrakkenLabError("no macro is loaded")
            remaining = len(self._macro_instructions) - self._macro_cursor
            for _ in range(remaining):
                if self.runtime.nullifier.inert:
                    break
                self.macro_step()
            return self.snapshot()

    def _flatten(self, statements: tuple[Statement, ...], out: list[Statement]) -> None:
        for statement in statements:
            if isinstance(statement, Repeat):
                if statement.count > MAX_UI_MACRO_INSTRUCTIONS:
                    raise ValueError("REPEAT count exceeds laboratory stepper limit")
                for _ in range(statement.count):
                    self._flatten(statement.body, out)
                    if len(out) > MAX_UI_MACRO_INSTRUCTIONS:
                        return
            else:
                out.append(statement)
                if len(out) > MAX_UI_MACRO_INSTRUCTIONS:
                    return

    def _macro_status(self) -> dict[str, Any]:
        next_line = None
        if self._macro_cursor < len(self._macro_instructions):
            next_line = self._macro_instructions[self._macro_cursor].span.line
        return {
            "loaded": bool(self._macro_instructions),
            "source_hash": self._macro_hash or None,
            "cursor": self._macro_cursor,
            "total": len(self._macro_instructions),
            "complete": bool(self._macro_instructions) and self._macro_cursor >= len(self._macro_instructions),
            "next_line": next_line,
            "last_result": self._macro_last_result,
            "registers": self.runtime.registers.snapshot(),
        }

    @staticmethod
    def _execution_result(result: ExecutionResult, line: int) -> dict[str, Any]:
        return {
            "status": result.status.value,
            "line": line,
            "steps": result.steps,
            "cycles": result.cycles,
            "registers": result.registers,
            "emissions": [
                {
                    "channel": emission.channel,
                    "args": [str(arg) for arg in emission.args],
                }
                for emission in result.emissions
            ],
            "stellar_events": [event.event_id for event in result.stellar_events],
            "fault": result.fault,
        }

    # ------------------------------------------------------------------
    # Starbinding vector bench
    # ------------------------------------------------------------------
    def starbinding_dive(
        self,
        *,
        offset_radii: float,
        angle_deg: float,
        velocity_fraction_c: float,
        withdrawal_fraction: float,
    ) -> dict[str, Any]:
        with self._lock:
            if self.runtime.nullifier.inert:
                raise DrakkenLabError("Starsilk runtime is inert; Starbinding dive cannot execute")
            offset_radii = _clamp(_float(offset_radii), -12.0, 12.0)
            angle_deg = _clamp(_float(angle_deg), -35.0, 35.0)
            velocity_fraction_c = _clamp(_float(velocity_fraction_c), 0.001, 0.999)
            withdrawal_fraction = _clamp(_float(withdrawal_fraction), 0.000001, 1.0)
            radius = 1.0e8
            start_distance = 5.0e9
            angle = math.radians(angle_deg)
            start = (-start_distance, offset_radii * radius, 0.0)
            direction = (math.cos(angle), math.sin(angle), 0.0)
            hit = intersects_core(start, direction, (0.0, 0.0, 0.0), radius)
            self._starbinding_sequence += 1
            index = self._starbinding_sequence
            core_id = f"VECTOR-{index:04d}"
            collapsed = False
            remaining = 1.0
            event_id = None
            if hit:
                core = StarCore(core_id=core_id, starsilk_capacity=Decimal("1"))
                self._starbinding_registry.add(core)
                event = self._starbinding_registry.withdraw(
                    core_id,
                    Decimal(str(withdrawal_fraction)),
                    step=index,
                )
                collapsed = event is not None
                remaining = float(core.bond_index)
                event_id = event.event_id if event is not None else None
            record = {
                "index": index,
                "offset_radii": offset_radii,
                "angle_deg": angle_deg,
                "velocity_fraction_c": velocity_fraction_c,
                "withdrawal_fraction": withdrawal_fraction,
                "hit": hit,
                "collapsed": collapsed,
                "bond_index": remaining,
                "event_id": event_id,
            }
            self._starbinding_history.append(record)
            self._record("starbinding", "Star-dive vector committed", record)
            return self.snapshot()

    def starbinding_wave(self, *, simulated_stars: int, represented_per_star: int) -> dict[str, Any]:
        with self._lock:
            if self.runtime.nullifier.inert:
                raise DrakkenLabError("Starsilk runtime is inert; Starbinding wave cannot execute")
            simulated_stars = int(_clamp(float(simulated_stars), 1.0, 256.0))
            represented_per_star = int(_clamp(float(represented_per_star), 1.0, 2_000_000_000.0))
            report = run_starbinding(
                StarbindingConfig(
                    simulated_stars=simulated_stars,
                    represented_stars_per_simulated=represented_per_star,
                )
            )
            payload = asdict(report)
            self._record("starbinding", "Canonical Starbinding wave simulated", payload)
            return {"report": payload, "state": self.snapshot()}

    # ------------------------------------------------------------------
    # Siege Wall lattice bench
    # ------------------------------------------------------------------
    def configure_siege_wall(
        self,
        *,
        singularities: int,
        nodes: int,
        capacity_m_s2: float,
    ) -> dict[str, Any]:
        with self._lock:
            singularities = int(_clamp(float(singularities), 1.0, 48.0))
            nodes = int(_clamp(float(nodes), 3.0, 72.0))
            capacity_m_s2 = _clamp(_float(capacity_m_s2), 0.0001, 1.0)
            heliocide_radius = 2.0e10
            node_radius = 8.0e10
            registry = StarRegistry()
            holes: list[BlackHoleRecord] = []
            for index in range(singularities):
                core = StarCore(core_id=f"AUREAL-{index:04d}", starsilk_capacity=Decimal("1"))
                registry.add(core)
                event = registry.withdraw(core.core_id, Decimal("1"), step=index + 1)
                assert event is not None
                angle = 2.0 * math.pi * index / singularities
                holes.append(
                    BlackHoleRecord.from_heliocide(
                        event,
                        (heliocide_radius * math.cos(angle), heliocide_radius * math.sin(angle), 0.0),
                    )
                )
            orbital_nodes = tuple(
                OrbitalNode(
                    node_id=f"NODE-{index:04d}",
                    position_m=(
                        node_radius * math.cos(2.0 * math.pi * index / nodes),
                        node_radius * math.sin(2.0 * math.pi * index / nodes),
                        0.0,
                    ),
                    capacity_m_s2=capacity_m_s2,
                )
                for index in range(nodes)
            )
            lattice = SiegeWallLattice(orbital_nodes)
            for hole in holes:
                lattice.anchor(hole)

            fractured = False
            fracture_reason = None
            utilization: list[float] = []
            loads: list[float] = []
            try:
                solution = lattice.stabilize()
                utilization = [float(value) for value in solution.utilization.tolist()]
                loads = [float(value) for value in solution.node_loads_m_s2.tolist()]
            except LatticeFractureError as exc:
                fractured = True
                fracture_reason = str(exc)

            self._siege_state = {
                "singularities": [
                    {
                        "id": hole.hole_id,
                        "x": hole.position_m[0] / node_radius,
                        "y": hole.position_m[1] / node_radius,
                        "horizon_radius_m": hole.horizon_radius_m,
                    }
                    for hole in holes
                ],
                "nodes": [
                    {
                        "id": node.node_id,
                        "x": node.position_m[0] / node_radius,
                        "y": node.position_m[1] / node_radius,
                        "capacity_m_s2": node.capacity_m_s2,
                        "load_m_s2": loads[index] if index < len(loads) else None,
                        "utilization": utilization[index] if index < len(utilization) else None,
                    }
                    for index, node in enumerate(orbital_nodes)
                ],
                "fractured": fractured,
                "fracture_reason": fracture_reason,
                "max_utilization": max(utilization) if utilization else None,
            }
            self._record(
                "siege_wall",
                "Siege Wall anchoring matrix solved" if not fractured else "Siege Wall lattice fractured",
                {
                    "singularities": singularities,
                    "nodes": nodes,
                    "capacity_m_s2": capacity_m_s2,
                    "fractured": fractured,
                    "max_utilization": self._siege_state["max_utilization"],
                    "fracture_reason": fracture_reason,
                },
            )
            return self.snapshot()

    # ------------------------------------------------------------------
    # Drakken Egg / specimen incubator
    # ------------------------------------------------------------------
    def hatch_specimen(
        self,
        *,
        profile_id: str,
        row: int,
        col: int,
        phenotype: dict[str, float] | None = None,
    ) -> dict[str, Any]:
        with self._lock:
            if self.runtime.nullifier.inert:
                raise DrakkenLabError("Starsilk runtime is inert; Notebook hatch program cannot execute")
            if self._specimen is not None and self._specimen.get("active"):
                raise DrakkenLabError("an active specimen already occupies the incubation field; terminate it first")
            profile_id = str(profile_id).lower()
            if profile_id not in SPECIMEN_PROFILES:
                raise ValueError(f"unknown specimen profile {profile_id!r}")
            if not (0 <= int(row) < LAB_ROWS and 0 <= int(col) < LAB_COLS):
                raise ValueError("hatch coordinates are outside the planetary grid")
            profile = SPECIMEN_PROFILES[profile_id]
            values = {
                "thermal": profile.thermal,
                "elevation": profile.elevation,
                "stress": profile.stress,
                "pressure": profile.pressure,
                "co2": profile.co2,
            }
            if phenotype is not None:
                if profile_id != "experimental_egg":
                    raise ValueError("archive phenotype models are locked; only Experimental Egg accepts tuning")
                for key in values:
                    if key in phenotype:
                        values[key] = _clamp(_float(phenotype[key]), -1.0, 1.0)

            self._specimen_sequence += 1
            specimen_id = f"DRK-LAB-{self._specimen_sequence:04d}"
            self._specimen = {
                "specimen_id": specimen_id,
                "profile_id": profile.profile_id,
                "name": profile.name,
                "classification": profile.classification,
                "archive_note": profile.archive_note,
                "behavior": profile.behavior,
                "accent": profile.accent,
                "movement": profile.movement,
                "active": True,
                "field_state": "active",
                "status_note": "Notebook Starsilk field active.",
                "origin": {"row": int(row), "col": int(col)},
                "position": {"row": int(row), "col": int(col)},
                "pulses": 0,
                "phenotype": values,
                "trail": [{"row": int(row), "col": int(col), "pulse": 0}],
                "effect_totals": {
                    "thermal_j": 0.0,
                    "elevation_m": 0.0,
                    "stress_pa": 0.0,
                    "pressure_pa": 0.0,
                    "co2_fraction": 0.0,
                },
            }
            record = {
                "event": "hatch",
                "specimen_id": specimen_id,
                "profile_id": profile.profile_id,
                "name": profile.name,
                "row": int(row),
                "col": int(col),
            }
            self._specimen_history.append(record)
            self._record("specimen", "Drakken laboratory specimen hatched", record)
            return self.snapshot()

    def pulse_specimen(self, *, steps: int) -> dict[str, Any]:
        with self._lock:
            if self._specimen is None:
                raise DrakkenLabError("no specimen is loaded in the incubation field")
            if self.runtime.nullifier.inert:
                self._specimen["active"] = False
                self._specimen["field_state"] = "nullified"
                self._specimen["status_note"] = "Notebook Starsilk field nullified by Syrin contact; physical specimen state is not inferred."
                raise DrakkenLabError("Starsilk runtime is inert; specimen Notebook field cannot pulse")
            if not self._specimen.get("active"):
                raise DrakkenLabError("specimen field is not active")
            steps = int(_clamp(float(steps), 1.0, 64.0))
            start_pulse = int(self._specimen["pulses"])
            for _ in range(steps):
                pulse = int(self._specimen["pulses"]) + 1
                row, col = self._next_specimen_cell(self._specimen, pulse)
                emissions, totals = self._specimen_emissions(self._specimen, row, col, pulse)
                self.engine.apply_many(emissions)
                self.engine.step(0.4)
                self._specimen["position"] = {"row": row, "col": col}
                self._specimen["pulses"] = pulse
                trail = self._specimen["trail"]
                trail.append({"row": row, "col": col, "pulse": pulse})
                if len(trail) > 96:
                    del trail[:-96]
                for key, value in totals.items():
                    self._specimen["effect_totals"][key] += value
                self._specimen_history.append(
                    {
                        "event": "pulse",
                        "specimen_id": self._specimen["specimen_id"],
                        "pulse": pulse,
                        "row": row,
                        "col": col,
                        "planet_hash": self.engine.state_hash(),
                    }
                )
            self._record(
                "specimen",
                "Drakken specimen terraforming pulse sequence executed",
                {
                    "specimen_id": self._specimen["specimen_id"],
                    "profile_id": self._specimen["profile_id"],
                    "pulses_executed": steps,
                    "pulse_range": [start_pulse + 1, int(self._specimen["pulses"])],
                    "position": self._specimen["position"],
                },
            )
            return self.snapshot()

    def terminate_specimen(self) -> dict[str, Any]:
        with self._lock:
            if self._specimen is None:
                return self.snapshot()
            was_active = bool(self._specimen.get("active"))
            self._specimen["active"] = False
            if self._specimen.get("field_state") != "nullified":
                self._specimen["field_state"] = "terminated"
                self._specimen["status_note"] = "Laboratory Notebook field terminated."
            record = {
                "event": "terminate",
                "specimen_id": self._specimen["specimen_id"],
                "profile_id": self._specimen["profile_id"],
                "pulses": self._specimen["pulses"],
                "was_active": was_active,
            }
            self._specimen_history.append(record)
            self._record("specimen", "Drakken specimen field terminated", record)
            return self.snapshot()

    def _next_specimen_cell(self, specimen: dict[str, Any], pulse: int) -> tuple[int, int]:
        origin_row = int(specimen["origin"]["row"])
        origin_col = int(specimen["origin"]["col"])
        movement = str(specimen["movement"])
        if movement == "radial":
            arms = ((0, 1), (1, 1), (1, 0), (0, -1), (-1, -1), (-1, 0))
            arm = arms[(pulse - 1) % len(arms)]
            distance = 1 + (pulse - 1) // len(arms)
            row = origin_row + arm[0] * distance
            col = origin_col + arm[1] * distance
        elif movement == "serpentine":
            row = origin_row + (-2, -1, 0, 1, 2, 1, 0, -1)[(pulse - 1) % 8]
            col = origin_col + pulse * 2
        elif movement == "hound":
            row = origin_row + (-1, -2, -1, 1, 2, 1)[(pulse - 1) % 6]
            col = origin_col + pulse * 3
        elif movement == "spiral":
            angle = pulse * 0.78
            radius = 2.0 + pulse * 0.42
            row = origin_row + int(round(math.sin(angle) * radius * 0.55))
            col = origin_col + int(round(math.cos(angle) * radius))
        else:
            angle = pulse * 0.52
            radius = 3.0 + min(8.0, pulse * 0.18)
            row = origin_row + int(round(math.sin(angle) * radius * 0.62))
            col = origin_col + int(round(math.cos(angle) * radius))
        return int(_clamp(float(row), 0.0, LAB_ROWS - 1.0)), int(col % LAB_COLS)

    def _specimen_emissions(
        self,
        specimen: dict[str, Any],
        row: int,
        col: int,
        pulse: int,
    ) -> tuple[list[MacroEmission], dict[str, float]]:
        phenotype = specimen["phenotype"]
        profile_id = specimen["profile_id"]
        if profile_id == "fault_tongue":
            offsets = ((0, 0, 1.0), (0, 1, 0.72), (1, 1, 0.58), (1, 0, 0.72), (0, -1, 0.72), (-1, -1, 0.58), (-1, 0, 0.72))
        elif profile_id == "tremorhound":
            offsets = ((0, 0, 1.0), (0, -1, 0.65), (0, -2, 0.38), (1, -1, 0.28), (-1, -1, 0.28))
        elif profile_id == "vortenbray":
            offsets = ((0, 0, 1.0), (0, 1, 0.52), (0, -1, 0.52), (1, 0, 0.52), (-1, 0, 0.52), (1, 1, 0.28), (-1, -1, 0.28))
        else:
            offsets = ((0, 0, 1.0), (0, 1, 0.48), (0, -1, 0.48), (1, 0, 0.36), (-1, 0, 0.36))

        emissions: list[MacroEmission] = []
        totals = {"thermal_j": 0.0, "elevation_m": 0.0, "stress_pa": 0.0, "pressure_pa": 0.0, "co2_fraction": 0.0}
        sequence = 0
        pulse_mod = 0.88 + 0.12 * math.sin(pulse * 0.83)
        for drow, dcol, weight in offsets:
            target_row = int(_clamp(float(row + drow), 0.0, LAB_ROWS - 1.0))
            target_col = int((col + dcol) % LAB_COLS)
            scale = weight * pulse_mod
            thermal_j = float(phenotype["thermal"]) * 3.0e13 * scale
            elevation_m = float(phenotype["elevation"]) * 165.0 * scale
            stress_pa = float(phenotype["stress"]) * 7.5e7 * scale
            pressure_pa = float(phenotype["pressure"]) * 7_500.0 * scale
            co2_fraction = float(phenotype["co2"]) * 2.5e-4 * scale
            if pressure_pa < 0:
                local_pressure = float(self.engine.atmosphere.pressure_pa[0, target_row, target_col])
                pressure_pa = max(pressure_pa, -0.22 * local_pressure)

            def emit(channel: str, args: tuple[Decimal | str, ...]) -> None:
                nonlocal sequence
                sequence += 1
                emissions.append(MacroEmission(sequence=sequence, channel=channel, args=args))

            if abs(thermal_j) > 1e-12:
                emit("THERMAL_ENERGY", (Decimal(0), Decimal(target_row), Decimal(target_col), Decimal(str(thermal_j))))
                totals["thermal_j"] += thermal_j
            if abs(elevation_m) > 1e-12:
                emit("LITHO_ELEVATION", (Decimal(0), Decimal(target_row), Decimal(target_col), Decimal(str(elevation_m))))
                totals["elevation_m"] += elevation_m
            if abs(stress_pa) > 1e-12:
                emit("LITHO_STRESS", (Decimal(0), Decimal(target_row), Decimal(target_col), Decimal(str(stress_pa))))
                totals["stress_pa"] += stress_pa
            if abs(pressure_pa) > 1e-12:
                emit("ATMOS_PRESSURE", (Decimal(0), Decimal(target_row), Decimal(target_col), Decimal(str(pressure_pa))))
                totals["pressure_pa"] += pressure_pa
            if co2_fraction > 1e-12:
                emit("ATMOS_GAS", ("co2", Decimal(0), Decimal(target_row), Decimal(target_col), Decimal(str(co2_fraction))))
                totals["co2_fraction"] += co2_fraction
        return emissions, totals

    # ------------------------------------------------------------------
    # Telemetry
    # ------------------------------------------------------------------
    def _record(self, kind: str, message: str, data: dict[str, Any]) -> None:
        self._event_sequence += 1
        self._revision += 1
        self._telemetry.append(
            {
                "sequence": self._event_sequence,
                "kind": kind,
                "message": message,
                "data": data,
            }
        )
