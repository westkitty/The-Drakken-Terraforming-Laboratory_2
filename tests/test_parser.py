from decimal import Decimal

import pytest

from core.errors import ParseError
from core.starsilk.ast import Emit, Repeat, SetRegister
from core.starsilk.parser import MacroParser


def test_parse_nested_repeat_and_emit() -> None:
    program = MacroParser().parse("""
SET x 1
REPEAT 2 {
  EMIT THERMAL_ENERGY 0 1 1 5e12
  REPEAT 3 {
    ADD x 2
  }
}
""")
    assert isinstance(program.statements[0], SetRegister)
    repeat = program.statements[1]
    assert isinstance(repeat, Repeat)
    assert repeat.count == 2
    assert isinstance(repeat.body[0], Emit)
    assert repeat.body[0].args[-1] == Decimal("5e12")


def test_parser_rejects_unterminated_block() -> None:
    with pytest.raises(ParseError):
        MacroParser().parse("REPEAT 2 {\nSET x 1")


def test_parser_rejects_non_finite_decimal() -> None:
    with pytest.raises(ParseError):
        MacroParser().parse("SET x NaN")
