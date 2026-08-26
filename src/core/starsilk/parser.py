"""Line-oriented parser for the Starsilk Macro language."""
from __future__ import annotations

import re
import shlex
from decimal import Decimal, InvalidOperation

from core.errors import ParseError
from .ast import (
    AddRegister,
    AssertRegister,
    Atom,
    DivideRegister,
    Emit,
    MultiplyRegister,
    Program,
    Repeat,
    SetRegister,
    SourceSpan,
    Statement,
    WithdrawStarsilk,
)

_REGISTER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
_CHANNEL = re.compile(r"^[A-Z][A-Z0-9_]*$")
_OPERATORS = {"==", "!=", "<", "<=", ">", ">="}


class MacroParser:
    """Parse deterministic macro source into a frozen AST.

    Grammar is intentionally small and explicit. Blocks use `REPEAT n {` and `}`.
    Comments begin with `#` outside quoted strings.
    """

    def parse(self, source: str, source_name: str = "<memory>") -> Program:
        lines = source.splitlines()
        statements, next_index = self._parse_block(lines, 0, source_name, top_level=True)
        if next_index != len(lines):
            raise ParseError(f"{source_name}:{next_index + 1}: unexpected trailing block terminator")
        return Program(tuple(statements), source_name=source_name)

    def _parse_block(
        self,
        lines: list[str],
        start: int,
        source_name: str,
        *,
        top_level: bool,
    ) -> tuple[list[Statement], int]:
        out: list[Statement] = []
        index = start
        while index < len(lines):
            raw = lines[index]
            line_number = index + 1
            stripped = self._strip_comment(raw).strip()
            if not stripped:
                index += 1
                continue
            if stripped == "}":
                if top_level:
                    raise ParseError(f"{source_name}:{line_number}: unmatched '}}'")
                return out, index + 1
            tokens = self._tokens(stripped, source_name, line_number)
            keyword = tokens[0].upper()
            span = SourceSpan(line_number)

            if keyword == "REPEAT":
                if len(tokens) != 3 or tokens[2] != "{":
                    raise ParseError(f"{source_name}:{line_number}: expected 'REPEAT <count> {{'")
                try:
                    count = int(tokens[1], 10)
                except ValueError as exc:
                    raise ParseError(f"{source_name}:{line_number}: repeat count must be an integer") from exc
                if count < 0:
                    raise ParseError(f"{source_name}:{line_number}: repeat count cannot be negative")
                body, index = self._parse_block(lines, index + 1, source_name, top_level=False)
                out.append(Repeat(span, count, tuple(body)))
                continue

            out.append(self._parse_statement(tokens, span, source_name))
            index += 1

        if not top_level:
            raise ParseError(f"{source_name}: unterminated REPEAT block")
        return out, index

    def _parse_statement(self, tokens: list[str], span: SourceSpan, source_name: str) -> Statement:
        keyword = tokens[0].upper()
        line = span.line
        if keyword in {"SET", "ADD", "MUL", "DIV"}:
            if len(tokens) != 3:
                raise ParseError(f"{source_name}:{line}: {keyword} expects register and numeric value")
            name = self._register(tokens[1], source_name, line)
            value = self._decimal(tokens[2], source_name, line)
            mapping = {
                "SET": SetRegister,
                "ADD": AddRegister,
                "MUL": MultiplyRegister,
                "DIV": DivideRegister,
            }
            return mapping[keyword](span, name, value)

        if keyword == "EMIT":
            if len(tokens) < 2:
                raise ParseError(f"{source_name}:{line}: EMIT expects a channel")
            channel = tokens[1].upper()
            if not _CHANNEL.match(channel):
                raise ParseError(f"{source_name}:{line}: invalid emission channel {tokens[1]!r}")
            args: list[Atom] = []
            for token in tokens[2:]:
                try:
                    args.append(Decimal(token))
                except InvalidOperation:
                    args.append(token)
            return Emit(span, channel, tuple(args))

        if keyword == "WITHDRAW":
            if len(tokens) != 3:
                raise ParseError(f"{source_name}:{line}: WITHDRAW expects core id and amount")
            return WithdrawStarsilk(span, tokens[1], self._decimal(tokens[2], source_name, line))

        if keyword == "ASSERT":
            if len(tokens) != 4 or tokens[2] not in _OPERATORS:
                raise ParseError(f"{source_name}:{line}: ASSERT expects '<register> <operator> <value>'")
            name = self._register(tokens[1], source_name, line)
            return AssertRegister(span, name, tokens[2], self._decimal(tokens[3], source_name, line))

        raise ParseError(f"{source_name}:{line}: unknown instruction {tokens[0]!r}")

    @staticmethod
    def _strip_comment(line: str) -> str:
        in_single = False
        in_double = False
        escaped = False
        result: list[str] = []
        for ch in line:
            if escaped:
                result.append(ch)
                escaped = False
                continue
            if ch == "\\":
                result.append(ch)
                escaped = True
                continue
            if ch == "'" and not in_double:
                in_single = not in_single
            elif ch == '"' and not in_single:
                in_double = not in_double
            elif ch == "#" and not in_single and not in_double:
                break
            result.append(ch)
        return "".join(result)

    @staticmethod
    def _tokens(text: str, source_name: str, line: int) -> list[str]:
        try:
            lexer = shlex.shlex(text, posix=True, punctuation_chars="{}")
            lexer.whitespace_split = True
            lexer.commenters = ""
            return list(lexer)
        except ValueError as exc:
            raise ParseError(f"{source_name}:{line}: {exc}") from exc

    @staticmethod
    def _register(value: str, source_name: str, line: int) -> str:
        if not _REGISTER.match(value):
            raise ParseError(f"{source_name}:{line}: invalid register name {value!r}")
        return value

    @staticmethod
    def _decimal(value: str, source_name: str, line: int) -> Decimal:
        try:
            parsed = Decimal(value)
        except InvalidOperation as exc:
            raise ParseError(f"{source_name}:{line}: invalid decimal {value!r}") from exc
        if not parsed.is_finite():
            raise ParseError(f"{source_name}:{line}: numeric values must be finite")
        return parsed
