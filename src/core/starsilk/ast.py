"""Abstract syntax tree for deterministic Starsilk Macros."""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import TypeAlias

Atom: TypeAlias = Decimal | str


@dataclass(frozen=True, slots=True)
class SourceSpan:
    line: int
    column: int = 1


@dataclass(frozen=True, slots=True)
class Statement:
    span: SourceSpan


@dataclass(frozen=True, slots=True)
class SetRegister(Statement):
    name: str
    value: Decimal


@dataclass(frozen=True, slots=True)
class AddRegister(Statement):
    name: str
    value: Decimal


@dataclass(frozen=True, slots=True)
class MultiplyRegister(Statement):
    name: str
    value: Decimal


@dataclass(frozen=True, slots=True)
class DivideRegister(Statement):
    name: str
    value: Decimal


@dataclass(frozen=True, slots=True)
class Repeat(Statement):
    count: int
    body: tuple[Statement, ...]


@dataclass(frozen=True, slots=True)
class Emit(Statement):
    channel: str
    args: tuple[Atom, ...]


@dataclass(frozen=True, slots=True)
class WithdrawStarsilk(Statement):
    core_id: str
    amount: Decimal


@dataclass(frozen=True, slots=True)
class AssertRegister(Statement):
    name: str
    operator: str
    value: Decimal


@dataclass(frozen=True, slots=True)
class Program:
    statements: tuple[Statement, ...]
    source_name: str = "<memory>"
