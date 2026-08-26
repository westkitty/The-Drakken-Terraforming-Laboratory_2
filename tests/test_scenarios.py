from scenarios.siege_wall import run_siege_wall
from scenarios.starbinding import run_starbinding
from scenarios.syrin_cascade import run_syrin_cascade


def test_starbinding_reproducible_and_collapses_every_successful_dive() -> None:
    first = run_starbinding()
    second = run_starbinding()
    assert first == second
    assert first.successful_dives == first.simulated_stars
    assert first.collapsed_stars == first.successful_dives
    assert first.represented_collapses >= 1_000_000_000


def test_siege_wall_reproducible_and_stable() -> None:
    first = run_siege_wall()
    second = run_siege_wall()
    assert first == second
    assert first.horizon_overlaps == 0
    assert first.max_node_utilization < 1.0


def test_syrin_cascade_reproducible_and_inert() -> None:
    first = run_syrin_cascade()
    second = run_syrin_cascade()
    assert first == second
    assert first.status == "inert"
    assert first.emitted_impulses < 20
