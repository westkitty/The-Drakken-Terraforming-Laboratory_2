"""Deterministic Drakken specimen models for the local laboratory UI.

The named profiles below are constrained to behavior explicitly attested in the
active Starsilk canon locks. Numerical strengths, movement paths, and pulse
cadence are laboratory parameters rather than claims about exact in-universe
biology. The experimental Egg profile is explicitly non-canon.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Final


@dataclass(frozen=True, slots=True)
class SpecimenProfile:
    profile_id: str
    name: str
    classification: str
    archive_note: str
    behavior: str
    accent: str
    movement: str
    thermal: float
    elevation: float
    stress: float
    pressure: float
    co2: float

    def public(self) -> dict[str, object]:
        return {
            "profile_id": self.profile_id,
            "name": self.name,
            "classification": self.classification,
            "archive_note": self.archive_note,
            "behavior": self.behavior,
            "accent": self.accent,
            "movement": self.movement,
            "phenotype": {
                "thermal": self.thermal,
                "elevation": self.elevation,
                "stress": self.stress,
                "pressure": self.pressure,
                "co2": self.co2,
            },
        }


# Canon names and incident summaries are sourced from the active canon locks.
# Numeric values are deliberately simulation-scale lab coefficients.
SPECIMEN_PROFILES: Final[dict[str, SpecimenProfile]] = {
    "fault_tongue": SpecimenProfile(
        profile_id="fault_tongue",
        name="Fault-Tongue",
        classification="ARCHIVE PHENOTYPE MODEL",
        archive_note="The Singing Crack of Tholus Fort: a Fault-Tongue split the fortress in six directions in one sunrise.",
        behavior="Radial lithospheric stress propagation with six deterministic fracture arms.",
        accent="#ffb35b",
        movement="radial",
        thermal=0.08,
        elevation=0.28,
        stress=1.00,
        pressure=0.00,
        co2=0.00,
    ),
    "obsidian_gul": SpecimenProfile(
        profile_id="obsidian_gul",
        name="Obsidian Gul",
        classification="ARCHIVE PHENOTYPE MODEL",
        archive_note="The Glassfall Incident in Sector Delta-1: three Obsidian Gul strains left fields of razor-sharp volcanic glass.",
        behavior="Migrating thermal and lithic-stress front used as a vitrification proxy in the present solver.",
        accent="#ff6d56",
        movement="serpentine",
        thermal=1.00,
        elevation=0.18,
        stress=0.62,
        pressure=0.00,
        co2=0.00,
    ),
    "tremorhound": SpecimenProfile(
        profile_id="tremorhound",
        name="Tremorhound",
        classification="ARCHIVE PHENOTYPE MODEL",
        archive_note="The Shiverdog Hunts on Gransh IV: Tremorhounds herded resistance fighters into tunnels and collapsed them into magma chambers.",
        behavior="Fast moving subsurface stress pursuit with thermal collapse pulses along its track.",
        accent="#cf8bff",
        movement="hound",
        thermal=0.52,
        elevation=-0.20,
        stress=0.88,
        pressure=0.00,
        co2=0.00,
    ),
    "vortenbray": SpecimenProfile(
        profile_id="vortenbray",
        name="Vortenbray",
        classification="ARCHIVE PHENOTYPE MODEL",
        archive_note="The Airwars of Sector Te: a Vortenbray inverted sky architecture and deleted ships through vacuum blossoms.",
        behavior="Mobile atmospheric pressure extraction producing deterministic vacuum-blossom cells.",
        accent="#68d8ff",
        movement="spiral",
        thermal=-0.08,
        elevation=0.00,
        stress=0.00,
        pressure=-1.00,
        co2=0.00,
    ),
    "experimental_egg": SpecimenProfile(
        profile_id="experimental_egg",
        name="Experimental Egg",
        classification="LAB MODEL — NON-CANON DESIGNATION",
        archive_note="Drakken Eggs are customized through macros by older Drakken. This profile is a laboratory-only programmable phenotype and does not assert a canon strain name.",
        behavior="User-tunable Notebook Program phenotype compiled into deterministic terraforming pulses.",
        accent="#42f5c5",
        movement="orbit",
        thermal=0.35,
        elevation=0.35,
        stress=0.35,
        pressure=0.20,
        co2=0.15,
    ),
}


def profile_catalog() -> list[dict[str, object]]:
    """Return the public specimen catalog in stable display order."""
    order = ("fault_tongue", "obsidian_gul", "tremorhound", "vortenbray", "experimental_egg")
    return [SPECIMEN_PROFILES[item].public() for item in order]
