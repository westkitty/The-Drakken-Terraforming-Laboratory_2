"""Siege Wall containment lattice coordinator."""
from __future__ import annotations

from dataclasses import dataclass, field

from core.errors import LatticeFractureError
from .anchoring import AnchorSolution, HeliocideAnchorMatrix
from .horizons import EventHorizonTracker
from .models import BlackHoleRecord, OrbitalNode


@dataclass(slots=True)
class SiegeWallLattice:
    nodes: tuple[OrbitalNode, ...]
    tracker: EventHorizonTracker = field(default_factory=EventHorizonTracker)
    last_solution: AnchorSolution | None = None

    def anchor(self, hole: BlackHoleRecord) -> None:
        self.tracker.add(hole)

    def stabilize(self) -> AnchorSolution:
        for node in self.nodes:
            incursions = self.tracker.contains(node.position_m)
            if incursions:
                raise LatticeFractureError(
                    f"node {node.node_id} crossed event horizon(s): {', '.join(incursions)}"
                )
        holes = tuple(sorted(self.tracker.holes.values(), key=lambda hole: hole.hole_id))
        self.last_solution = HeliocideAnchorMatrix.solve(self.nodes, holes)
        return self.last_solution

    def max_utilization(self) -> float:
        if self.last_solution is None or self.last_solution.utilization.size == 0:
            return 0.0
        return float(self.last_solution.utilization.max())
