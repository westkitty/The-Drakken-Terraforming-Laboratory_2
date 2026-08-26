from decimal import Decimal

import pytest

from core.errors import RegisterDomainError, RegisterOverflowError
from core.starsilk.registers import RegisterFile


def test_register_arithmetic_is_decimal_and_deterministic() -> None:
    registers = RegisterFile()
    registers.set("x", Decimal("0.1"))
    registers.add("x", Decimal("0.2"))
    assert registers.get("x") == Decimal("0.3")
    registers.multiply("x", Decimal("10"))
    assert registers.get("x") == Decimal("3.0")


def test_register_overflow_is_rejected() -> None:
    registers = RegisterFile(max_abs=Decimal("10"))
    registers.set("x", Decimal("10"))
    with pytest.raises(RegisterOverflowError):
        registers.add("x", Decimal("1"))


def test_division_by_zero_is_rejected() -> None:
    registers = RegisterFile()
    with pytest.raises(RegisterDomainError):
        registers.divide("x", Decimal("0"))
