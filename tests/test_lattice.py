from decimal import Decimal

import pytest

from core.errors import LatticeFractureError
from core.stellar.models import StarCore, StarRegistry
from sim.lattice.models import BlackHoleRecord, OrbitalNode
from sim.lattice.wall import SiegeWallLattice


def make_hole() -> BlackHoleRecord:
    registry = StarRegistry()
    registry.add(StarCore("H", starsilk_capacity=Decimal("1")))
    event = registry.withdraw("H", Decimal("1"), step=1)
    assert event is not None
    return BlackHoleRecord.from_heliocide(event, (0.0, 0.0, 0.0))


def test_lattice_tracks_event_horizon_and_stabilizes() -> None:
    hole = make_hole()
    nodes = (
        OrbitalNode("N1", (1e11, 0.0, 0.0), 1.0),
        OrbitalNode("N2", (-1e11, 0.0, 0.0), 1.0),
        OrbitalNode("N3", (0.0, 1e11, 0.0), 1.0),
    )
    wall = SiegeWallLattice(nodes)
    wall.anchor(hole)
    solution = wall.stabilize()
    assert solution.coupling.shape == (3, 1)
    assert wall.tracker.contains((0.0, 0.0, 0.0)) == (hole.hole_id,)
    assert wall.max_utilization() < 1.0


def test_lattice_fractures_when_node_is_inside_horizon() -> None:
    hole = make_hole()
    wall = SiegeWallLattice((OrbitalNode("N1", (0.0, 0.0, 0.0), 1.0),))
    wall.anchor(hole)
    with pytest.raises(LatticeFractureError):
        wall.stabilize()


def test_lattice_fractures_on_capacity_overload() -> None:
    hole = make_hole()
    wall = SiegeWallLattice((OrbitalNode("N1", (1e10, 0.0, 0.0), 1e-12),))
    wall.anchor(hole)
    with pytest.raises(LatticeFractureError):
        wall.stabilize()
