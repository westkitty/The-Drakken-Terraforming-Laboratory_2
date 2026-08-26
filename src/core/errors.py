"""Domain-specific exceptions for the laboratory."""

class DrakkenLabError(Exception):
    """Base exception for all laboratory failures."""


class ParseError(DrakkenLabError):
    """Raised when a Starsilk macro cannot be parsed."""


class MacroCycleLimitExceeded(DrakkenLabError):
    """Raised when a macro exceeds its deterministic cycle budget."""


class MacroStepLimitExceeded(DrakkenLabError):
    """Raised when a macro exceeds its deterministic instruction budget."""


class RegisterOverflowError(DrakkenLabError):
    """Raised when register arithmetic leaves the configured numeric domain."""


class RegisterDomainError(DrakkenLabError):
    """Raised for invalid register operations such as division by zero."""


class PhysicsDomainError(DrakkenLabError):
    """Raised when a physical model receives impossible or non-finite input."""


class TerraformingCommandError(DrakkenLabError):
    """Raised when a macro emission cannot be applied to planetary grids."""


class LatticeFractureError(DrakkenLabError):
    """Raised when a Siege Wall anchoring solution violates node limits."""
