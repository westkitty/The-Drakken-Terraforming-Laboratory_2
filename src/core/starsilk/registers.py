"""Bounded deterministic Starsilk register file."""
from __future__ import annotations

from decimal import Context, Decimal, DivisionByZero, InvalidOperation, Overflow, localcontext

from core.errors import RegisterDomainError, RegisterOverflowError


class RegisterFile:
    """Decimal registers with a fixed precision and absolute magnitude ceiling."""

    def __init__(self, *, precision: int = 50, max_abs: Decimal = Decimal("1e100")) -> None:
        if precision < 16:
            raise ValueError("precision must be at least 16 digits")
        if max_abs <= 0 or not max_abs.is_finite():
            raise ValueError("max_abs must be finite and positive")
        self._context = Context(prec=precision)
        self.max_abs = max_abs
        self._values: dict[str, Decimal] = {}

    def get(self, name: str) -> Decimal:
        return self._values.get(name, Decimal(0))

    def set(self, name: str, value: Decimal) -> Decimal:
        return self._store(name, value)

    def add(self, name: str, value: Decimal) -> Decimal:
        return self._binary(name, value, lambda a, b: a + b)

    def multiply(self, name: str, value: Decimal) -> Decimal:
        return self._binary(name, value, lambda a, b: a * b)

    def divide(self, name: str, value: Decimal) -> Decimal:
        if value == 0:
            raise RegisterDomainError(f"division by zero in register {name}")
        return self._binary(name, value, lambda a, b: a / b)

    def snapshot(self) -> dict[str, str]:
        return {key: format(value, "f") for key, value in sorted(self._values.items())}

    def _binary(self, name: str, value: Decimal, operation) -> Decimal:
        try:
            with localcontext(self._context):
                result = operation(self.get(name), value)
        except (DivisionByZero, InvalidOperation, Overflow) as exc:
            raise RegisterDomainError(f"invalid arithmetic in register {name}: {exc}") from exc
        return self._store(name, result)

    def _store(self, name: str, value: Decimal) -> Decimal:
        if not value.is_finite() or abs(value) > self.max_abs:
            raise RegisterOverflowError(
                f"register {name} left numeric domain: |{value}| > {self.max_abs} or non-finite"
            )
        self._values[name] = value
        return value
