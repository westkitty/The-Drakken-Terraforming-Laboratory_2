"""Syrin contamination cascade demonstrating absolute macro nullification."""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass

from core.starsilk.executor import ExecutionStatus, MacroExecutor, MacroRuntime
from core.starsilk.parser import MacroParser


@dataclass(frozen=True, slots=True)
class SyrinCascadeConfig:
    repeat_count: int = 20
    contaminate_at_step: int = 7
    contact_fraction: float = 1e-12

    def __post_init__(self) -> None:
        if self.repeat_count <= 0:
            raise ValueError("repeat_count must be positive")
        if self.contaminate_at_step <= 0:
            raise ValueError("contaminate_at_step must be positive")
        if self.contact_fraction <= 0:
            raise ValueError("contact_fraction must be strictly positive")


@dataclass(frozen=True, slots=True)
class SyrinCascadeReport:
    status: str
    steps_before_inert: int
    emitted_impulses: int
    contact_fraction: float
    state_hash: str


def run_syrin_cascade(config: SyrinCascadeConfig = SyrinCascadeConfig()) -> SyrinCascadeReport:
    source = f"""
SET pulse 1
REPEAT {config.repeat_count} {{
  EMIT THERMAL_ENERGY 0 1 1 5e12
  ADD pulse 1
}}
ASSERT pulse >= 1
"""
    parser = MacroParser()
    runtime = MacroRuntime()
    executor = MacroExecutor(runtime, max_steps=10_000, max_cycles=10_000)

    def hook(step: int, active_runtime: MacroRuntime) -> None:
        if step == config.contaminate_at_step:
            active_runtime.contact_syrin_blood(
                contact_fraction=config.contact_fraction,
                source="scenario Syrin contamination",
            )

    result = executor.execute(parser.parse(source, "syrin-cascade"), step_hook=hook)
    assert result.status is ExecutionStatus.INERT
    payload = {
        "status": result.status.value,
        "steps": result.steps,
        "emissions": [(item.sequence, item.channel, [str(arg) for arg in item.args]) for item in result.emissions],
        "nullification": result.nullification.sequence if result.nullification else None,
    }
    state_hash = hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    return SyrinCascadeReport(
        status=result.status.value,
        steps_before_inert=result.steps,
        emitted_impulses=len(result.emissions),
        contact_fraction=config.contact_fraction,
        state_hash=state_hash,
    )
