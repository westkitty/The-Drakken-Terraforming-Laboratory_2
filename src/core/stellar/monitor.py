"""Star-core stability monitoring and observables."""
from __future__ import annotations

from dataclasses import dataclass

from .models import StarCore, StarCoreState
from .physics import escape_velocity_m_s, luminosity_w, radiative_surface_flux_w_m2


@dataclass(frozen=True, slots=True)
class StellarSnapshot:
    core_id: str
    state: str
    starsilk_bond_index: str
    surface_flux_w_m2: float
    luminosity_w: float
    escape_velocity_m_s: float


class StellarStabilityMonitor:
    def snapshot(self, core: StarCore) -> StellarSnapshot:
        return StellarSnapshot(
            core_id=core.core_id,
            state=core.state.value,
            starsilk_bond_index=format(core.bond_index, "f"),
            surface_flux_w_m2=radiative_surface_flux_w_m2(core.temperature_k),
            luminosity_w=luminosity_w(core.radius_m, core.temperature_k),
            escape_velocity_m_s=escape_velocity_m_s(core.mass_kg, core.radius_m),
        )

    @staticmethod
    def requires_heliocide(core: StarCore) -> bool:
        return core.state is StarCoreState.COLLAPSED
