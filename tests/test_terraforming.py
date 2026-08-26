from decimal import Decimal

from core.starsilk.executor import MacroEmission
from sim.terraforming.engine import TerraformingEngine
from sim.terraforming.grids import AtmosphericGrid, LithosphereGrid, ThermalGrid


def make_engine() -> TerraformingEngine:
    return TerraformingEngine(
        AtmosphericGrid(2, 4, 4),
        LithosphereGrid(2, 4, 4),
        ThermalGrid(2, 4, 4),
    )


def test_macro_emissions_drive_all_planetary_layers() -> None:
    engine = make_engine()
    engine.apply_many([
        MacroEmission(1, "ATMOS_PRESSURE", (Decimal(0), Decimal(1), Decimal(1), Decimal("1000"))),
        MacroEmission(2, "ATMOS_GAS", ("co2", Decimal(0), Decimal(1), Decimal(1), Decimal("0.01"))),
        MacroEmission(3, "LITHO_ELEVATION", (Decimal(0), Decimal(1), Decimal(1), Decimal("50"))),
        MacroEmission(4, "LITHO_STRESS", (Decimal(0), Decimal(1), Decimal(1), Decimal("1e8"))),
        MacroEmission(5, "THERMAL_ENERGY", (Decimal(0), Decimal(1), Decimal(1), Decimal("5e12"))),
    ])
    assert engine.atmosphere.pressure_pa[0, 1, 1] == 102325.0
    assert engine.atmosphere.species_fraction["co2"][0, 1, 1] > 0.00036
    assert engine.lithosphere.elevation_m[0, 1, 1] == 50.0
    assert engine.lithosphere.stress_pa[0, 1, 1] == 1e8
    assert engine.thermal.temperature_k[0, 1, 1] == 289.15


def test_terraforming_state_hash_is_reproducible() -> None:
    left = make_engine()
    right = make_engine()
    emission = MacroEmission(1, "THERMAL_ENERGY", (Decimal(0), Decimal(2), Decimal(2), Decimal("5e12")))
    left.apply_emission(emission)
    right.apply_emission(emission)
    for _ in range(3):
        left.step(0.25)
        right.step(0.25)
    assert left.state_hash() == right.state_hash()
