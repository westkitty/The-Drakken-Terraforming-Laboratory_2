from decimal import Decimal

from core.starsilk.executor import MacroExecutor, MacroRuntime
from core.starsilk.parser import MacroParser
from core.stellar.models import StarCore, StarCoreState
from sim.terraforming.engine import TerraformingEngine
from sim.terraforming.grids import AtmosphericGrid, LithosphereGrid, ThermalGrid


def test_macro_to_planet_and_heliocide_integration() -> None:
    source = """
SET cycles 0
REPEAT 3 {
  ADD cycles 1
  EMIT ATMOS_PRESSURE 0 1 1 100
  EMIT THERMAL_ENERGY 0 1 1 5e12
}
WITHDRAW TARGET 1
ASSERT cycles == 3
"""
    runtime = MacroRuntime()
    runtime.star_registry.add(StarCore("TARGET", starsilk_capacity=Decimal("1")))
    result = MacroExecutor(runtime).execute(MacroParser().parse(source, "integration"))
    engine = TerraformingEngine(
        AtmosphericGrid(2, 3, 3),
        LithosphereGrid(2, 3, 3),
        ThermalGrid(2, 3, 3),
    )
    engine.apply_many(result.emissions)
    engine.step(0.1)
    assert runtime.star_registry.get("TARGET").state is StarCoreState.COLLAPSED
    assert len(result.stellar_events) == 1
    assert result.registers["cycles"] == "3"
    assert engine.atmosphere.pressure_pa[0, 1, 1] > 101325.0
    assert engine.thermal.temperature_k[0, 1, 1] > 288.15
