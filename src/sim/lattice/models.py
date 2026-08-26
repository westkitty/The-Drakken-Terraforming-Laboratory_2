"""Data models for Siege Wall nodes and anchored singularities."""
from __future__ import annotations

from dataclasses import dataclass
from math import sqrt

from core.stellar.models import HeliocideEvent

Vector3 = tuple[float, float, float]


def distance(a: Vector3, b: Vector3) -> float:
    return sqrt(sum((x - y) ** 2 for x, y in zip(a, b, strict=True)))


@dataclass(frozen=True, slots=True)
class BlackHoleRecord:
    hole_id: str
    position_m: Vector3
    mass_kg: float
    horizon_radius_m: float
    source_event_id: str

    @classmethod
    def from_heliocide(cls, event: HeliocideEvent, position_m: Vector3) -> "BlackHoleRecord":
        return cls(
            hole_id=f"BH-{event.event_id}",
            position_m=position_m,
            mass_kg=event.stellar_mass_kg,
            horizon_radius_m=event.schwarzschild_radius_m,
            source_event_id=event.event_id,
        )


@dataclass(frozen=True, slots=True)
class OrbitalNode:
    node_id: str
    position_m: Vector3
    capacity_m_s2: float

    def __post_init__(self) -> None:
        if not self.node_id:
            raise ValueError("node_id cannot be empty")
        if self.capacity_m_s2 <= 0:
            raise ValueError("node capacity must be positive")
