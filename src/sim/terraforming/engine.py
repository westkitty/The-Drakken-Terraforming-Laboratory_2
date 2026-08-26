"""Apply Starsilk macro emissions to coupled planetary grids."""
from __future__ import annotations

import hashlib
from decimal import Decimal

import numpy as np

from core.errors import TerraformingCommandError
from core.starsilk.executor import MacroEmission
from .grids import AtmosphericGrid, LithosphereGrid, ThermalGrid


class TerraformingEngine:
    CHANNELS = {
        "ATMOS_PRESSURE",
        "ATMOS_GAS",
        "LITHO_ELEVATION",
        "LITHO_STRESS",
        "THERMAL_ENERGY",
    }

    def __init__(
        self,
        atmosphere: AtmosphericGrid,
        lithosphere: LithosphereGrid,
        thermal: ThermalGrid,
    ) -> None:
        if (atmosphere.rows, atmosphere.cols) != (lithosphere.rows, lithosphere.cols):
            raise ValueError("atmosphere and lithosphere horizontal dimensions must match")
        if (atmosphere.rows, atmosphere.cols) != (thermal.rows, thermal.cols):
            raise ValueError("atmosphere and thermal horizontal dimensions must match")
        self.atmosphere = atmosphere
        self.lithosphere = lithosphere
        self.thermal = thermal
        self.steps = 0

    def apply_emission(self, emission: MacroEmission) -> None:
        channel = emission.channel.upper()
        if channel not in self.CHANNELS:
            raise TerraformingCommandError(f"unknown terraforming channel {channel!r}")
        try:
            if channel == "ATMOS_PRESSURE":
                layer, row, col, delta = self._numbers(emission.args, 4)
                self.atmosphere.apply_pressure_delta(int(layer), int(row), int(col), float(delta))
            elif channel == "ATMOS_GAS":
                if len(emission.args) != 5 or not isinstance(emission.args[0], str):
                    raise TerraformingCommandError("ATMOS_GAS expects species layer row col delta_fraction")
                species = emission.args[0]
                layer, row, col, delta = self._numbers(emission.args[1:], 4)
                self.atmosphere.apply_gas_fraction_delta(species, int(layer), int(row), int(col), float(delta))
            elif channel == "LITHO_ELEVATION":
                layer, row, col, delta = self._numbers(emission.args, 4)
                self.lithosphere.apply_elevation_delta(int(layer), int(row), int(col), float(delta))
            elif channel == "LITHO_STRESS":
                layer, row, col, delta = self._numbers(emission.args, 4)
                self.lithosphere.apply_stress_delta(int(layer), int(row), int(col), float(delta))
            elif channel == "THERMAL_ENERGY":
                layer, row, col, energy = self._numbers(emission.args, 4)
                self.thermal.apply_energy(int(layer), int(row), int(col), float(energy))
        except (IndexError, ValueError) as exc:
            raise TerraformingCommandError(f"invalid {channel} emission: {exc}") from exc

    def apply_many(self, emissions: tuple[MacroEmission, ...] | list[MacroEmission]) -> None:
        for emission in emissions:
            self.apply_emission(emission)

    def step(self, dt_s: float) -> None:
        self.atmosphere.step(dt_s)
        self.lithosphere.step(dt_s)
        self.thermal.step(dt_s)
        self.steps += 1

    def state_hash(self) -> str:
        digest = hashlib.sha256()
        digest.update(str(self.steps).encode())
        arrays = [
            self.atmosphere.pressure_pa,
            self.atmosphere.temperature_k,
            self.lithosphere.elevation_m,
            self.lithosphere.stress_pa,
            self.thermal.temperature_k,
        ]
        for key in sorted(self.atmosphere.species_fraction):
            digest.update(key.encode())
            arrays.append(self.atmosphere.species_fraction[key])
        for array in arrays:
            normalized = np.ascontiguousarray(array, dtype="<f8")
            digest.update(normalized.tobytes(order="C"))
        return digest.hexdigest()

    @staticmethod
    def _numbers(args: tuple[Decimal | str, ...], expected: int) -> tuple[Decimal, ...]:
        if len(args) != expected or any(not isinstance(item, Decimal) for item in args):
            raise TerraformingCommandError(f"expected {expected} numeric arguments")
        return tuple(args)  # type: ignore[return-value]
