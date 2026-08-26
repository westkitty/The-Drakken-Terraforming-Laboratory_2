"""Canonical historical boundary conditions used by reproducible scenarios."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class BloodEclipseScale:
    """Conservative numerical floor for the locked catastrophe wording.

    Canon describes Tiger's final containment heliocide as costing thousands of
    stars and trillions of lives. Those are qualitative lower-bound plurals, not
    exact counts, so the simulator stores floors rather than fabricating precision.
    """

    minimum_stars_lost: int = 2_000
    minimum_lives_lost: int = 2_000_000_000_000
    aureal_gate_year: int = 170


BLOOD_ECLIPSE_SCALE = BloodEclipseScale()
