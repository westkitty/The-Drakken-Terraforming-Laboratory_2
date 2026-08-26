"""Canonical star-core state and non-negotiable heliocide transition."""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from enum import Enum

from core.errors import PhysicsDomainError
from .physics import SOLAR_MASS_KG, SOLAR_RADIUS_M, schwarzschild_radius_m


class StarCoreState(str, Enum):
    ACTIVE = "active"
    COLLAPSED = "collapsed"


@dataclass(slots=True)
class StarCore:
    core_id: str
    mass_solar: float = 1.0
    radius_solar: float = 1.0
    temperature_k: float = 5772.0
    starsilk_capacity: Decimal = Decimal("1")
    starsilk_remaining: Decimal | None = None
    state: StarCoreState = StarCoreState.ACTIVE

    def __post_init__(self) -> None:
        if not self.core_id:
            raise ValueError("core_id cannot be empty")
        if self.mass_solar <= 0 or self.radius_solar <= 0 or self.temperature_k <= 0:
            raise PhysicsDomainError("stellar mass, radius, and temperature must be positive")
        if self.starsilk_capacity <= 0 or not self.starsilk_capacity.is_finite():
            raise PhysicsDomainError("Starsilk capacity must be finite and positive")
        if self.starsilk_remaining is None:
            self.starsilk_remaining = self.starsilk_capacity
        if self.starsilk_remaining <= 0 or self.starsilk_remaining > self.starsilk_capacity:
            raise PhysicsDomainError("active core must contain Starsilk within (0, capacity]")

    @property
    def mass_kg(self) -> float:
        return self.mass_solar * SOLAR_MASS_KG

    @property
    def radius_m(self) -> float:
        return self.radius_solar * SOLAR_RADIUS_M

    @property
    def bond_index(self) -> Decimal:
        if self.state is StarCoreState.COLLAPSED:
            return Decimal(0)
        assert self.starsilk_remaining is not None
        return self.starsilk_remaining / self.starsilk_capacity


@dataclass(frozen=True, slots=True)
class HeliocideEvent:
    event_id: str
    core_id: str
    step: int
    requested_withdrawal: Decimal
    actual_withdrawal: Decimal
    stellar_mass_kg: float
    schwarzschild_radius_m: float
    reason: str = "total Starsilk depletion"


@dataclass(slots=True)
class StarRegistry:
    cores: dict[str, StarCore] = field(default_factory=dict)
    events: list[HeliocideEvent] = field(default_factory=list)

    def add(self, core: StarCore) -> None:
        if core.core_id in self.cores:
            raise PhysicsDomainError(f"duplicate core id {core.core_id}")
        self.cores[core.core_id] = core

    def get(self, core_id: str) -> StarCore:
        try:
            return self.cores[core_id]
        except KeyError as exc:
            raise PhysicsDomainError(f"unknown stellar core {core_id!r}") from exc

    def withdraw(self, core_id: str, amount: Decimal, *, step: int) -> HeliocideEvent | None:
        if amount <= 0 or not amount.is_finite():
            raise PhysicsDomainError("Starsilk withdrawal must be finite and positive")
        core = self.get(core_id)
        if core.state is StarCoreState.COLLAPSED:
            raise PhysicsDomainError(f"stellar core {core_id} has already collapsed")
        assert core.starsilk_remaining is not None
        actual = min(amount, core.starsilk_remaining)
        core.starsilk_remaining -= actual

        # Canon invariant: reaching exactly zero is an immediate, unconditional collapse.
        if core.starsilk_remaining == 0:
            core.state = StarCoreState.COLLAPSED
            event = HeliocideEvent(
                event_id=f"HELIO-{len(self.events) + 1:06d}",
                core_id=core_id,
                step=step,
                requested_withdrawal=amount,
                actual_withdrawal=actual,
                stellar_mass_kg=core.mass_kg,
                schwarzschild_radius_m=schwarzschild_radius_m(core.mass_kg),
            )
            self.events.append(event)
            return event
        return None
