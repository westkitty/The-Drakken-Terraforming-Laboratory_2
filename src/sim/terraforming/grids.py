"""Deterministic finite-difference planetary grids."""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from core.errors import PhysicsDomainError


def _shape(layers: int, rows: int, cols: int) -> tuple[int, int, int]:
    if min(layers, rows, cols) <= 0:
        raise ValueError("grid dimensions must be positive")
    return layers, rows, cols


def _laplacian_neumann(field: np.ndarray) -> np.ndarray:
    padded = np.pad(field, ((1, 1), (1, 1), (1, 1)), mode="edge")
    center = padded[1:-1, 1:-1, 1:-1]
    return (
        padded[:-2, 1:-1, 1:-1]
        + padded[2:, 1:-1, 1:-1]
        + padded[1:-1, :-2, 1:-1]
        + padded[1:-1, 2:, 1:-1]
        + padded[1:-1, 1:-1, :-2]
        + padded[1:-1, 1:-1, 2:]
        - 6.0 * center
    )


def _require_finite(name: str, array: np.ndarray) -> None:
    if not np.all(np.isfinite(array)):
        raise PhysicsDomainError(f"{name} became non-finite")


@dataclass(slots=True)
class AtmosphericGrid:
    layers: int
    rows: int
    cols: int
    base_pressure_pa: float = 101_325.0
    base_temperature_k: float = 288.15
    pressure_pa: np.ndarray = field(init=False, repr=False)
    temperature_k: np.ndarray = field(init=False, repr=False)
    species_fraction: dict[str, np.ndarray] = field(init=False, repr=False)

    def __post_init__(self) -> None:
        shape = _shape(self.layers, self.rows, self.cols)
        if self.base_pressure_pa <= 0 or self.base_temperature_k <= 0:
            raise PhysicsDomainError("atmospheric baseline must be positive")
        self.pressure_pa = np.full(shape, self.base_pressure_pa, dtype=np.float64)
        self.temperature_k = np.full(shape, self.base_temperature_k, dtype=np.float64)
        self.species_fraction = {
            "n2": np.full(shape, 0.78084, dtype=np.float64),
            "o2": np.full(shape, 0.20946, dtype=np.float64),
            "ar": np.full(shape, 0.00934, dtype=np.float64),
            "co2": np.full(shape, 0.00036, dtype=np.float64),
        }

    def apply_pressure_delta(self, layer: int, row: int, col: int, delta_pa: float) -> None:
        self._index(layer, row, col)
        value = self.pressure_pa[layer, row, col] + delta_pa
        if value <= 0 or not np.isfinite(value):
            raise PhysicsDomainError("atmospheric pressure must remain finite and positive")
        self.pressure_pa[layer, row, col] = value

    def apply_gas_fraction_delta(self, species: str, layer: int, row: int, col: int, delta: float) -> None:
        self._index(layer, row, col)
        species = species.lower()
        if species not in self.species_fraction:
            self.species_fraction[species] = np.zeros_like(self.pressure_pa)
        current = self.species_fraction[species][layer, row, col]
        if current + delta < 0:
            raise PhysicsDomainError(f"gas fraction for {species} cannot become negative")
        self.species_fraction[species][layer, row, col] = current + delta
        total = sum(values[layer, row, col] for values in self.species_fraction.values())
        if total <= 0 or not np.isfinite(total):
            raise PhysicsDomainError("atmospheric gas fractions became invalid")
        for values in self.species_fraction.values():
            values[layer, row, col] /= total

    def step(self, dt_s: float, *, diffusion_rate: float = 1e-5, thermal_rate: float = 5e-6) -> None:
        if dt_s < 0:
            raise ValueError("dt_s cannot be negative")
        self.pressure_pa += diffusion_rate * dt_s * _laplacian_neumann(self.pressure_pa)
        self.temperature_k += thermal_rate * dt_s * _laplacian_neumann(self.temperature_k)
        for key in sorted(self.species_fraction):
            field = self.species_fraction[key]
            field += diffusion_rate * dt_s * _laplacian_neumann(field)
            np.maximum(field, 0.0, out=field)
        total = np.zeros_like(self.pressure_pa)
        for field in self.species_fraction.values():
            total += field
        if np.any(total <= 0):
            raise PhysicsDomainError("gas fraction normalization reached zero")
        for field in self.species_fraction.values():
            field /= total
        if np.any(self.pressure_pa <= 0) or np.any(self.temperature_k <= 0):
            raise PhysicsDomainError("atmospheric state left positive physical domain")
        _require_finite("atmosphere", self.pressure_pa)

    def _index(self, layer: int, row: int, col: int) -> None:
        if not (0 <= layer < self.layers and 0 <= row < self.rows and 0 <= col < self.cols):
            raise IndexError(f"atmospheric cell {(layer, row, col)} outside grid")


@dataclass(slots=True)
class LithosphereGrid:
    layers: int
    rows: int
    cols: int
    base_density_kg_m3: float = 2800.0
    elevation_m: np.ndarray = field(init=False, repr=False)
    stress_pa: np.ndarray = field(init=False, repr=False)
    density_kg_m3: np.ndarray = field(init=False, repr=False)

    def __post_init__(self) -> None:
        shape = _shape(self.layers, self.rows, self.cols)
        if self.base_density_kg_m3 <= 0:
            raise PhysicsDomainError("lithosphere density must be positive")
        self.elevation_m = np.zeros(shape, dtype=np.float64)
        self.stress_pa = np.zeros(shape, dtype=np.float64)
        self.density_kg_m3 = np.full(shape, self.base_density_kg_m3, dtype=np.float64)

    def apply_elevation_delta(self, layer: int, row: int, col: int, delta_m: float) -> None:
        self._index(layer, row, col)
        value = self.elevation_m[layer, row, col] + delta_m
        if not np.isfinite(value):
            raise PhysicsDomainError("lithosphere elevation overflow")
        self.elevation_m[layer, row, col] = value

    def apply_stress_delta(self, layer: int, row: int, col: int, delta_pa: float) -> None:
        self._index(layer, row, col)
        value = self.stress_pa[layer, row, col] + delta_pa
        if not np.isfinite(value):
            raise PhysicsDomainError("lithosphere stress overflow")
        self.stress_pa[layer, row, col] = value

    def step(self, dt_s: float, *, stress_relaxation_per_s: float = 1e-8, creep_rate: float = 1e-12) -> None:
        if dt_s < 0:
            raise ValueError("dt_s cannot be negative")
        relaxation = max(0.0, 1.0 - stress_relaxation_per_s * dt_s)
        self.stress_pa *= relaxation
        self.elevation_m += creep_rate * dt_s * _laplacian_neumann(self.stress_pa)
        _require_finite("lithosphere", self.elevation_m)
        _require_finite("lithosphere stress", self.stress_pa)

    def _index(self, layer: int, row: int, col: int) -> None:
        if not (0 <= layer < self.layers and 0 <= row < self.rows and 0 <= col < self.cols):
            raise IndexError(f"lithosphere cell {(layer, row, col)} outside grid")


@dataclass(slots=True)
class ThermalGrid:
    layers: int
    rows: int
    cols: int
    base_temperature_k: float = 288.15
    heat_capacity_j_per_k: float = 5e12
    temperature_k: np.ndarray = field(init=False, repr=False)

    def __post_init__(self) -> None:
        shape = _shape(self.layers, self.rows, self.cols)
        if self.base_temperature_k <= 0 or self.heat_capacity_j_per_k <= 0:
            raise PhysicsDomainError("thermal baseline and heat capacity must be positive")
        self.temperature_k = np.full(shape, self.base_temperature_k, dtype=np.float64)

    def apply_energy(self, layer: int, row: int, col: int, energy_j: float) -> None:
        self._index(layer, row, col)
        new_temp = self.temperature_k[layer, row, col] + energy_j / self.heat_capacity_j_per_k
        if new_temp <= 0 or not np.isfinite(new_temp):
            raise PhysicsDomainError("thermal impulse left positive finite temperature domain")
        self.temperature_k[layer, row, col] = new_temp

    def step(self, dt_s: float, *, conductivity_rate: float = 2e-5) -> None:
        if dt_s < 0:
            raise ValueError("dt_s cannot be negative")
        self.temperature_k += conductivity_rate * dt_s * _laplacian_neumann(self.temperature_k)
        if np.any(self.temperature_k <= 0):
            raise PhysicsDomainError("thermal grid reached non-positive temperature")
        _require_finite("thermal grid", self.temperature_k)

    def _index(self, layer: int, row: int, col: int) -> None:
        if not (0 <= layer < self.layers and 0 <= row < self.rows and 0 <= col < self.cols):
            raise IndexError(f"thermal cell {(layer, row, col)} outside grid")
