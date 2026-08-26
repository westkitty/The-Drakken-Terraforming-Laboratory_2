"""Reproducible Siege Wall heliocide lattice scenario."""
from __future__ import annotations

import hashlib
import json
import math
from dataclasses import dataclass
from decimal import Decimal

from core.stellar.models import StarCore, StarRegistry
from sim.lattice.models import BlackHoleRecord, OrbitalNode
from sim.lattice.wall import SiegeWallLattice


@dataclass(frozen=True, slots=True)
class SiegeWallConfig:
    singularities: int = 8
    orbital_nodes: int = 12
    heliocide_ring_radius_m: float = 2.0e10
    node_ring_radius_m: float = 8.0e10
    node_capacity_m_s2: float = 0.05

    def __post_init__(self) -> None:
        if self.singularities <= 0 or self.orbital_nodes <= 0:
            raise ValueError("Siege Wall counts must be positive")
        if self.heliocide_ring_radius_m <= 0 or self.node_ring_radius_m <= self.heliocide_ring_radius_m:
            raise ValueError("node ring must lie outside the heliocide ring")
        if self.node_capacity_m_s2 <= 0:
            raise ValueError("node capacity must be positive")


@dataclass(frozen=True, slots=True)
class SiegeWallReport:
    singularities: int
    nodes: int
    horizon_overlaps: int
    max_node_utilization: float
    state_hash: str


def run_siege_wall(config: SiegeWallConfig = SiegeWallConfig()) -> SiegeWallReport:
    registry = StarRegistry()
    holes: list[BlackHoleRecord] = []
    for index in range(config.singularities):
        core = StarCore(core_id=f"AUREAL-{index:04d}", starsilk_capacity=Decimal("1"))
        registry.add(core)
        event = registry.withdraw(core.core_id, Decimal("1"), step=index + 1)
        assert event is not None
        angle = (2.0 * math.pi * index) / config.singularities
        position = (
            config.heliocide_ring_radius_m * math.cos(angle),
            config.heliocide_ring_radius_m * math.sin(angle),
            0.0,
        )
        holes.append(BlackHoleRecord.from_heliocide(event, position))

    nodes = tuple(
        OrbitalNode(
            node_id=f"NODE-{index:04d}",
            position_m=(
                config.node_ring_radius_m * math.cos((2.0 * math.pi * index) / config.orbital_nodes),
                config.node_ring_radius_m * math.sin((2.0 * math.pi * index) / config.orbital_nodes),
                0.0,
            ),
            capacity_m_s2=config.node_capacity_m_s2,
        )
        for index in range(config.orbital_nodes)
    )
    wall = SiegeWallLattice(nodes)
    for hole in holes:
        wall.anchor(hole)
    solution = wall.stabilize()
    overlaps = wall.tracker.overlaps()
    payload = {
        "holes": [(hole.hole_id, hole.position_m, hole.horizon_radius_m) for hole in holes],
        "nodes": [(node.node_id, node.position_m, node.capacity_m_s2) for node in nodes],
        "loads": solution.node_loads_m_s2.tolist(),
    }
    state_hash = hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return SiegeWallReport(
        singularities=len(holes),
        nodes=len(nodes),
        horizon_overlaps=len(overlaps),
        max_node_utilization=wall.max_utilization(),
        state_hash=state_hash,
    )
