"""Deterministic Starsilk Macro runtime and loop executor."""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from enum import Enum
from typing import Callable

from core.errors import MacroCycleLimitExceeded, MacroStepLimitExceeded, RegisterDomainError
from core.stellar.models import HeliocideEvent, StarRegistry
from .ast import (
    AddRegister,
    AssertRegister,
    DivideRegister,
    Emit,
    MultiplyRegister,
    Program,
    Repeat,
    SetRegister,
    Statement,
    WithdrawStarsilk,
)
from .nullification import NullificationRecord, SyrinNullifier
from .registers import RegisterFile


class ExecutionStatus(str, Enum):
    ACTIVE = "active"
    COMPLETED = "completed"
    INERT = "inert"
    FAULTED = "faulted"


@dataclass(frozen=True, slots=True)
class MacroEmission:
    sequence: int
    channel: str
    args: tuple[Decimal | str, ...]


@dataclass(slots=True)
class MacroThread:
    thread_id: str
    status: ExecutionStatus = ExecutionStatus.ACTIVE
    steps: int = 0


@dataclass(slots=True)
class MacroRuntime:
    registers: RegisterFile = field(default_factory=RegisterFile)
    star_registry: StarRegistry = field(default_factory=StarRegistry)
    nullifier: SyrinNullifier = field(default_factory=SyrinNullifier)
    threads: dict[str, MacroThread] = field(default_factory=dict)

    def begin_thread(self, thread_id: str) -> MacroThread:
        existing = self.threads.get(thread_id)
        if existing is not None and existing.status is ExecutionStatus.ACTIVE:
            raise RegisterDomainError(f"thread {thread_id!r} is already active")
        thread = MacroThread(thread_id=thread_id, status=ExecutionStatus.ACTIVE)
        self.threads[thread_id] = thread
        return thread

    def contact_syrin_blood(self, *, contact_fraction: float, source: str = "Syrin blood") -> NullificationRecord | None:
        record = self.nullifier.contact(contact_fraction=contact_fraction, source=source)
        if record is not None:
            for thread in self.threads.values():
                if thread.status is ExecutionStatus.ACTIVE:
                    thread.status = ExecutionStatus.INERT
        return record


@dataclass(frozen=True, slots=True)
class ExecutionResult:
    status: ExecutionStatus
    steps: int
    cycles: int
    registers: dict[str, str]
    emissions: tuple[MacroEmission, ...]
    stellar_events: tuple[HeliocideEvent, ...]
    nullification: NullificationRecord | None
    fault: str | None = None


StepHook = Callable[[int, MacroRuntime], None]


class _Nullified(Exception):
    """Internal control-flow signal for an absolute Syrin nullification interrupt."""


class MacroExecutor:
    """Execute a Starsilk AST using strict step/cycle budgets.

    No wall clock, random input, threading, or ambient environment state enters the
    result. External interruption is explicit through `step_hook` or the runtime's
    Syrin contact API.
    """

    def __init__(
        self,
        runtime: MacroRuntime | None = None,
        *,
        max_steps: int = 100_000,
        max_cycles: int = 10_000,
    ) -> None:
        if max_steps <= 0 or max_cycles <= 0:
            raise ValueError("execution budgets must be positive")
        self.runtime = runtime or MacroRuntime()
        self.max_steps = max_steps
        self.max_cycles = max_cycles

    def execute(
        self,
        program: Program,
        *,
        thread_id: str = "main",
        step_hook: StepHook | None = None,
    ) -> ExecutionResult:
        thread = self.runtime.begin_thread(thread_id)
        emissions: list[MacroEmission] = []
        event_start = len(self.runtime.star_registry.events)
        state = {"steps": 0, "cycles": 0}

        if self.runtime.nullifier.inert:
            thread.status = ExecutionStatus.INERT
            return self._result(thread, state, emissions, event_start)

        try:
            self._execute_block(program.statements, thread, state, emissions, step_hook)
            if thread.status is not ExecutionStatus.INERT:
                thread.status = ExecutionStatus.COMPLETED
            return self._result(thread, state, emissions, event_start)
        except _Nullified:
            thread.status = ExecutionStatus.INERT
            return self._result(thread, state, emissions, event_start)
        except Exception as exc:
            thread.status = ExecutionStatus.FAULTED
            result = self._result(thread, state, emissions, event_start, fault=str(exc))
            exc.execution_result = result  # type: ignore[attr-defined]
            raise

    def _execute_block(
        self,
        statements: tuple[Statement, ...],
        thread: MacroThread,
        state: dict[str, int],
        emissions: list[MacroEmission],
        step_hook: StepHook | None,
    ) -> None:
        for statement in statements:
            self._tick(thread, state, step_hook)
            if isinstance(statement, SetRegister):
                self.runtime.registers.set(statement.name, statement.value)
            elif isinstance(statement, AddRegister):
                self.runtime.registers.add(statement.name, statement.value)
            elif isinstance(statement, MultiplyRegister):
                self.runtime.registers.multiply(statement.name, statement.value)
            elif isinstance(statement, DivideRegister):
                self.runtime.registers.divide(statement.name, statement.value)
            elif isinstance(statement, Emit):
                emissions.append(MacroEmission(len(emissions) + 1, statement.channel, statement.args))
            elif isinstance(statement, WithdrawStarsilk):
                self.runtime.star_registry.withdraw(statement.core_id, statement.amount, step=state["steps"])
            elif isinstance(statement, AssertRegister):
                actual = self.runtime.registers.get(statement.name)
                if not self._compare(actual, statement.operator, statement.value):
                    raise RegisterDomainError(
                        f"assertion failed at line {statement.span.line}: "
                        f"{statement.name}={actual} {statement.operator} {statement.value}"
                    )
            elif isinstance(statement, Repeat):
                for _ in range(statement.count):
                    state["cycles"] += 1
                    if state["cycles"] > self.max_cycles:
                        raise MacroCycleLimitExceeded(
                            f"macro exceeded cycle limit {self.max_cycles} at line {statement.span.line}"
                        )
                    self._execute_block(statement.body, thread, state, emissions, step_hook)
            else:
                raise RegisterDomainError(f"unsupported AST statement {type(statement).__name__}")

    def _tick(self, thread: MacroThread, state: dict[str, int], step_hook: StepHook | None) -> None:
        if self.runtime.nullifier.inert:
            thread.status = ExecutionStatus.INERT
            raise _Nullified
        state["steps"] += 1
        thread.steps = state["steps"]
        if state["steps"] > self.max_steps:
            raise MacroStepLimitExceeded(f"macro exceeded step limit {self.max_steps}")
        if step_hook is not None:
            step_hook(state["steps"], self.runtime)
            if self.runtime.nullifier.inert:
                thread.status = ExecutionStatus.INERT
                raise _Nullified

    def _result(
        self,
        thread: MacroThread,
        state: dict[str, int],
        emissions: list[MacroEmission],
        event_start: int,
        fault: str | None = None,
    ) -> ExecutionResult:
        return ExecutionResult(
            status=thread.status,
            steps=state["steps"],
            cycles=state["cycles"],
            registers=self.runtime.registers.snapshot(),
            emissions=tuple(emissions),
            stellar_events=tuple(self.runtime.star_registry.events[event_start:]),
            nullification=self.runtime.nullifier.record,
            fault=fault,
        )

    @staticmethod
    def _compare(left: Decimal, operator: str, right: Decimal) -> bool:
        return {
            "==": left == right,
            "!=": left != right,
            "<": left < right,
            "<=": left <= right,
            ">": left > right,
            ">=": left >= right,
        }[operator]
