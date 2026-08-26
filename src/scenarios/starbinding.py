"""Starbinding star-dive vector scenario."""
from __future__ import annotations

import hashlib
import json
import math
from dataclasses import asdict, dataclass
from decimal import Decimal

from core.starsilk.executor import MacroExecutor, MacroRuntime
from core.starsilk.parser import MacroParser
from core.stellar.models import StarCore
from .constants import BLOOD_ECLIPSE_SCALE

Vector3 = tuple[float, float, float]


def _dot(a: Vector3, b: Vector3) -> float:
    return sum(x * y for x, y in zip(a, b, strict=True))


def _sub(a: Vector3, b: Vector3) -> Vector3:
    return tuple(x - y for x, y in zip(a, b, strict=True))  # type: ignore[return-value]


def _norm(v: Vector3) -> float:
    return math.sqrt(_dot(v, v))


def _normalize(v: Vector3) -> Vector3:
    n = _norm(v)
    if n == 0:
        raise ValueError("dive direction cannot be zero")
    return tuple(x / n for x in v)  # type: ignore[return-value]


def intersects_core(start: Vector3, direction: Vector3, center: Vector3, radius_m: float) -> bool:
    """Return whether a forward ray intersects the modeled stellar core sphere."""
    direction = _normalize(direction)
    oc = _sub(start, center)
    b = 2.0 * _dot(oc, direction)
    c = _dot(oc, oc) - radius_m * radius_m
    discriminant = b * b - 4.0 * c
    if discriminant < 0:
        return False
    root = math.sqrt(discriminant)
    t1 = (-b - root) / 2.0
    t2 = (-b + root) / 2.0
    return t1 >= 0 or t2 >= 0


@dataclass(frozen=True, slots=True)
class DiveVector:
    start_m: Vector3
    direction: Vector3
    velocity_fraction_c: float


@dataclass(frozen=True, slots=True)
class StarbindingConfig:
    simulated_stars: int = 16
    represented_stars_per_simulated: int = 250_000_000
    core_radius_m: float = 1.0e8
    start_distance_m: float = 5.0e9
    velocity_fraction_c: float = 0.2
    withdrawal_fraction: Decimal = Decimal("1")

    def __post_init__(self) -> None:
        if self.simulated_stars <= 0 or self.represented_stars_per_simulated <= 0:
            raise ValueError("Starbinding scale must be positive")
        if self.core_radius_m <= 0 or self.start_distance_m <= self.core_radius_m:
            raise ValueError("Starbinding geometry is invalid")
        if not (0 < self.velocity_fraction_c < 1):
            raise ValueError("dive velocity must be a subluminal fraction of c")
        if not (Decimal(0) < self.withdrawal_fraction <= Decimal(1)):
            raise ValueError("withdrawal_fraction must be within (0, 1]")


@dataclass(frozen=True, slots=True)
class StarbindingReport:
    simulated_stars: int
    successful_dives: int
    collapsed_stars: int
    represented_collapses: int
    blood_eclipse_minimum_stars_lost: int
    state_hash: str


def _vector_for(index: int, config: StarbindingConfig) -> DiveVector:
    angle = (2.0 * math.pi * index) / config.simulated_stars
    start = (
        config.start_distance_m * math.cos(angle),
        config.start_distance_m * math.sin(angle),
        0.0,
    )
    direction = _normalize(tuple(-value for value in start))  # type: ignore[arg-type]
    return DiveVector(start, direction, config.velocity_fraction_c)


def run_starbinding(config: StarbindingConfig = StarbindingConfig()) -> StarbindingReport:
    parser = MacroParser()
    runtime = MacroRuntime()
    executor = MacroExecutor(runtime, max_steps=config.simulated_stars * 4, max_cycles=10)
    successful = 0

    for index in range(config.simulated_stars):
        core_id = f"SB-{index:05d}"
        runtime.star_registry.add(StarCore(core_id=core_id, starsilk_capacity=Decimal("1")))
        dive = _vector_for(index, config)
        if intersects_core(dive.start_m, dive.direction, (0.0, 0.0, 0.0), config.core_radius_m):
            successful += 1
            amount = config.withdrawal_fraction
            program = parser.parse(f"WITHDRAW {core_id} {amount}", source_name=f"starbinding:{core_id}")
            executor.execute(program, thread_id=f"dive-{index}")

    collapsed = len(runtime.star_registry.events)
    payload = {
        "config": {**asdict(config), "withdrawal_fraction": str(config.withdrawal_fraction)},
        "successful": successful,
        "collapsed": collapsed,
        "events": [event.event_id + ":" + event.core_id for event in runtime.star_registry.events],
    }
    state_hash = hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return StarbindingReport(
        simulated_stars=config.simulated_stars,
        successful_dives=successful,
        collapsed_stars=collapsed,
        represented_collapses=collapsed * config.represented_stars_per_simulated,
        blood_eclipse_minimum_stars_lost=BLOOD_ECLIPSE_SCALE.minimum_stars_lost,
        state_hash=state_hash,
    )
