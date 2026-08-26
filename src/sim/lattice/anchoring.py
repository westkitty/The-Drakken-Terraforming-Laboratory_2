"""Deterministic heliocide anchoring matrix."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from core.errors import LatticeFractureError, PhysicsDomainError
from core.stellar.physics import G
from .models import BlackHoleRecord, OrbitalNode, distance


@dataclass(frozen=True, slots=True)
class AnchorSolution:
    coupling: np.ndarray
    node_loads_m_s2: np.ndarray
    utilization: np.ndarray


class HeliocideAnchorMatrix:
    """Compute singularity-to-node coupling from inverse-square gravimetric influence.

    Each singularity column is normalized to 1.0, making the matrix a deterministic
    allocation of that singularity's anchor demand among available nodes. Node load
    is then evaluated as weighted local gravitational acceleration.
    """

    @staticmethod
    def solve(nodes: tuple[OrbitalNode, ...], holes: tuple[BlackHoleRecord, ...]) -> AnchorSolution:
        if not nodes:
            raise LatticeFractureError("Siege Wall requires at least one orbital node")
        if not holes:
            empty = np.zeros((len(nodes), 0), dtype=np.float64)
            return AnchorSolution(empty, np.zeros(len(nodes)), np.zeros(len(nodes)))

        influence = np.zeros((len(nodes), len(holes)), dtype=np.float64)
        local_accel = np.zeros_like(influence)
        for i, node in enumerate(nodes):
            for j, hole in enumerate(holes):
                d = distance(node.position_m, hole.position_m)
                if d <= hole.horizon_radius_m:
                    raise LatticeFractureError(
                        f"orbital node {node.node_id} lies inside event horizon {hole.hole_id}"
                    )
                d = max(d, hole.horizon_radius_m * 1.000001)
                influence[i, j] = 1.0 / (d * d)
                local_accel[i, j] = G * hole.mass_kg / (d * d)

        column_sums = influence.sum(axis=0)
        if np.any(column_sums <= 0) or not np.all(np.isfinite(column_sums)):
            raise PhysicsDomainError("heliocide anchoring matrix became singular or non-finite")
        coupling = influence / column_sums
        loads = np.sum(coupling * local_accel, axis=1)
        capacities = np.array([node.capacity_m_s2 for node in nodes], dtype=np.float64)
        utilization = loads / capacities
        if not np.all(np.isfinite(utilization)):
            raise PhysicsDomainError("lattice utilization became non-finite")
        overloaded = np.where(utilization > 1.0)[0]
        if overloaded.size:
            details = ", ".join(
                f"{nodes[index].node_id}={utilization[index]:.6f}x" for index in overloaded.tolist()
            )
            raise LatticeFractureError(f"Siege Wall lattice fracture: capacity exceeded at {details}")
        return AnchorSolution(coupling, loads, utilization)
