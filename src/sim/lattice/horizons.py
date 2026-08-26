"""Black-hole event horizon tracking."""
from __future__ import annotations

from dataclasses import dataclass, field

from .models import BlackHoleRecord, Vector3, distance


@dataclass(slots=True)
class EventHorizonTracker:
    holes: dict[str, BlackHoleRecord] = field(default_factory=dict)

    def add(self, hole: BlackHoleRecord) -> None:
        if hole.hole_id in self.holes:
            raise ValueError(f"duplicate black hole id {hole.hole_id}")
        self.holes[hole.hole_id] = hole

    def contains(self, point_m: Vector3) -> tuple[str, ...]:
        return tuple(
            hole.hole_id
            for hole in sorted(self.holes.values(), key=lambda item: item.hole_id)
            if distance(point_m, hole.position_m) <= hole.horizon_radius_m
        )

    def overlaps(self) -> tuple[tuple[str, str], ...]:
        holes = sorted(self.holes.values(), key=lambda item: item.hole_id)
        overlaps: list[tuple[str, str]] = []
        for index, left in enumerate(holes):
            for right in holes[index + 1 :]:
                if distance(left.position_m, right.position_m) <= left.horizon_radius_m + right.horizon_radius_m:
                    overlaps.append((left.hole_id, right.hole_id))
        return tuple(overlaps)
