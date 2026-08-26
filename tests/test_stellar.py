from decimal import Decimal

import pytest

from core.errors import PhysicsDomainError
from core.stellar.models import StarCore, StarCoreState, StarRegistry
from core.stellar.monitor import StellarStabilityMonitor


def test_partial_withdrawal_does_not_collapse_star() -> None:
    registry = StarRegistry()
    core = StarCore("A", starsilk_capacity=Decimal("1"))
    registry.add(core)
    event = registry.withdraw("A", Decimal("0.999999"), step=1)
    assert event is None
    assert core.state is StarCoreState.ACTIVE
    assert core.starsilk_remaining == Decimal("0.000001")


def test_exact_total_depletion_immediately_collapses_star() -> None:
    registry = StarRegistry()
    core = StarCore("A", starsilk_capacity=Decimal("1"))
    registry.add(core)
    event = registry.withdraw("A", Decimal("1"), step=1)
    assert event is not None
    assert core.state is StarCoreState.COLLAPSED
    assert core.starsilk_remaining == 0
    assert event.schwarzschild_radius_m > 0


def test_overdraw_still_removes_all_available_starsilk_and_collapses() -> None:
    registry = StarRegistry()
    core = StarCore("A", starsilk_capacity=Decimal("1"))
    registry.add(core)
    event = registry.withdraw("A", Decimal("2"), step=1)
    assert event is not None
    assert event.actual_withdrawal == Decimal("1")
    assert core.state is StarCoreState.COLLAPSED


def test_monitor_calculations_are_finite() -> None:
    snapshot = StellarStabilityMonitor().snapshot(StarCore("A"))
    assert snapshot.surface_flux_w_m2 > 0
    assert snapshot.luminosity_w > 0
    assert snapshot.escape_velocity_m_s > 0
    assert snapshot.starsilk_bond_index == "1"


def test_invalid_star_is_rejected() -> None:
    with pytest.raises(PhysicsDomainError):
        StarCore("bad", mass_solar=-1)
