"""Absolute Syrin-blood nullification interrupt."""
from __future__ import annotations

from dataclasses import dataclass
import math


@dataclass(frozen=True, slots=True)
class NullificationRecord:
    sequence: int
    source: str
    contact_fraction: float


class SyrinNullifier:
    """Tracks the absolute Starsilk-nullification condition.

    Any strictly positive Syrin blood contact is sufficient. There is no threshold,
    resistance roll, cooldown, recovery, or probabilistic exception.
    """

    def __init__(self) -> None:
        self._record: NullificationRecord | None = None
        self._sequence = 0

    @property
    def inert(self) -> bool:
        return self._record is not None

    @property
    def record(self) -> NullificationRecord | None:
        return self._record

    def contact(self, *, contact_fraction: float, source: str = "Syrin blood") -> NullificationRecord | None:
        if not math.isfinite(contact_fraction):
            raise ValueError("contact_fraction must be finite")
        if contact_fraction < 0:
            raise ValueError("contact_fraction cannot be negative")
        if contact_fraction == 0:
            return self._record
        if self._record is None:
            self._sequence += 1
            self._record = NullificationRecord(self._sequence, source, contact_fraction)
        return self._record
