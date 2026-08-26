"""Numerically guarded stellar physics helpers."""
from __future__ import annotations

import math

from core.errors import PhysicsDomainError

G = 6.67430e-11
C = 299_792_458.0
SIGMA = 5.670374419e-8
SOLAR_MASS_KG = 1.98847e30
SOLAR_RADIUS_M = 6.957e8


def _finite_positive(name: str, value: float) -> float:
    if not math.isfinite(value) or value <= 0:
        raise PhysicsDomainError(f"{name} must be finite and positive, got {value!r}")
    return value


def schwarzschild_radius_m(mass_kg: float) -> float:
    mass_kg = _finite_positive("mass_kg", mass_kg)
    value = (2.0 * G * mass_kg) / (C * C)
    if not math.isfinite(value):
        raise PhysicsDomainError("Schwarzschild radius overflow")
    return value


def radiative_surface_flux_w_m2(temperature_k: float) -> float:
    temperature_k = _finite_positive("temperature_k", temperature_k)
    try:
        value = SIGMA * temperature_k**4
    except OverflowError as exc:
        raise PhysicsDomainError("radiative flux overflow") from exc
    if not math.isfinite(value):
        raise PhysicsDomainError("radiative flux overflow")
    return value


def luminosity_w(radius_m: float, temperature_k: float) -> float:
    radius_m = _finite_positive("radius_m", radius_m)
    flux = radiative_surface_flux_w_m2(temperature_k)
    try:
        value = 4.0 * math.pi * radius_m * radius_m * flux
    except OverflowError as exc:
        raise PhysicsDomainError("luminosity overflow") from exc
    if not math.isfinite(value):
        raise PhysicsDomainError("luminosity overflow")
    return value


def escape_velocity_m_s(mass_kg: float, radius_m: float) -> float:
    mass_kg = _finite_positive("mass_kg", mass_kg)
    radius_m = _finite_positive("radius_m", radius_m)
    value = math.sqrt((2.0 * G * mass_kg) / radius_m)
    if not math.isfinite(value):
        raise PhysicsDomainError("escape velocity overflow")
    return value
