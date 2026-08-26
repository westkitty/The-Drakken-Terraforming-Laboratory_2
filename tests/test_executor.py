from decimal import Decimal

import pytest

from core.errors import MacroCycleLimitExceeded
from core.starsilk.executor import ExecutionStatus, MacroExecutor, MacroRuntime
from core.starsilk.parser import MacroParser
from core.stellar.models import StarCore


def test_loop_executor_and_emissions() -> None:
    program = MacroParser().parse("""
SET x 0
REPEAT 4 {
 ADD x 2
 EMIT THERMAL_ENERGY 0 0 0 5e12
}
ASSERT x == 8
""")
    result = MacroExecutor(max_steps=50, max_cycles=20).execute(program)
    assert result.status is ExecutionStatus.COMPLETED
    assert result.registers["x"] == "8"
    assert len(result.emissions) == 4


def test_cycle_limit_is_hard() -> None:
    program = MacroParser().parse("REPEAT 5 {\nSET x 1\n}")
    with pytest.raises(MacroCycleLimitExceeded):
        MacroExecutor(max_cycles=3).execute(program)


def test_syrin_contact_makes_active_macro_inert_before_contacted_step_executes() -> None:
    runtime = MacroRuntime()
    program = MacroParser().parse("REPEAT 10 {\nEMIT THERMAL_ENERGY 0 0 0 1\n}")

    def hook(step: int, active: MacroRuntime) -> None:
        if step == 4:
            active.contact_syrin_blood(contact_fraction=1e-30)

    result = MacroExecutor(runtime).execute(program, step_hook=hook)
    assert result.status is ExecutionStatus.INERT
    assert result.nullification is not None
    assert result.steps == 4
    assert len(result.emissions) == 2


def test_withdrawal_can_trigger_heliocide_inside_macro() -> None:
    runtime = MacroRuntime()
    runtime.star_registry.add(StarCore("SUN", starsilk_capacity=Decimal("1")))
    result = MacroExecutor(runtime).execute(MacroParser().parse("WITHDRAW SUN 1"))
    assert len(result.stellar_events) == 1
    assert result.stellar_events[0].core_id == "SUN"


def test_syrin_contact_requires_finite_fraction() -> None:
    runtime = MacroRuntime()
    with pytest.raises(ValueError, match="finite"):
        runtime.contact_syrin_blood(contact_fraction=float("nan"))
