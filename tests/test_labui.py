from __future__ import annotations

from http.client import HTTPConnection
import json
from threading import Thread

import pytest

from core.errors import DrakkenLabError
from labui.server import make_server
from labui.session import LaboratorySession


def test_planet_brush_mutates_deterministic_world() -> None:
    session = LaboratorySession()
    before = session.snapshot()["planet"]["state_hash"]
    after = session.apply_brush(tool="uplift", row=18, col=36, intensity=40, radius=2)
    assert after["planet"]["state_hash"] != before
    assert after["planet"]["stats"]["elevation_max_m"] > session.engine.lithosphere.elevation_m[0].min()


def test_syrin_contact_nullifies_ui_starsilk_actions_until_reset() -> None:
    session = LaboratorySession()
    state = session.inject_syrin(contact_fraction=1e-18)
    assert state["inert"] is True
    with pytest.raises(DrakkenLabError, match="inert"):
        session.apply_brush(tool="heat", row=18, col=36, intensity=20, radius=1)
    reset = session.reset()
    assert reset["inert"] is False


def test_total_stellar_withdrawal_is_immediate_heliocide() -> None:
    session = LaboratorySession()
    state = session.withdraw_star(fraction=1.0)
    assert state["star"]["state"] == "collapsed"
    assert state["star"]["bond_index"] == 0.0
    assert state["star"]["heliocide_event"]["reason"] == "total Starsilk depletion"


def test_macro_stepper_applies_emission_to_live_planet() -> None:
    session = LaboratorySession()
    source = "SET n 0\nADD n 1\nEMIT LITHO_ELEVATION 0 18 36 250\nASSERT n == 1"
    loaded = session.load_macro(source=source)
    assert loaded["macro"]["total"] == 4
    before = loaded["planet"]["state_hash"]
    session.macro_step()
    session.macro_step()
    state = session.macro_step()
    assert state["macro"]["cursor"] == 3
    assert state["planet"]["state_hash"] != before
    final = session.macro_step()
    assert final["macro"]["complete"] is True
    assert final["macro"]["registers"]["n"] == "1"


def test_starbinding_vector_geometry_controls_hit_and_collapse() -> None:
    session = LaboratorySession()
    miss = session.starbinding_dive(
        offset_radii=6.0,
        angle_deg=0,
        velocity_fraction_c=0.2,
        withdrawal_fraction=1.0,
    )["starbinding"]["history"][-1]
    assert miss["hit"] is False
    hit = session.starbinding_dive(
        offset_radii=0.0,
        angle_deg=0,
        velocity_fraction_c=0.2,
        withdrawal_fraction=1.0,
    )["starbinding"]["history"][-1]
    assert hit["hit"] is True
    assert hit["collapsed"] is True


def test_siege_wall_reports_stable_and_fractured_configurations() -> None:
    session = LaboratorySession()
    stable = session.configure_siege_wall(singularities=8, nodes=12, capacity_m_s2=0.05)["siege_wall"]
    assert stable["fractured"] is False
    fractured = session.configure_siege_wall(singularities=8, nodes=12, capacity_m_s2=0.0001)["siege_wall"]
    assert fractured["fractured"] is True
    assert "capacity exceeded" in fractured["fracture_reason"]


def _request(port: int, method: str, path: str, body: dict | None = None):
    conn = HTTPConnection("127.0.0.1", port, timeout=3)
    payload = None if body is None else json.dumps(body).encode()
    headers = {} if payload is None else {"Content-Type": "application/json", "Content-Length": str(len(payload))}
    conn.request(method, path, body=payload, headers=headers)
    response = conn.getresponse()
    data = response.read()
    content_type = response.getheader("Content-Type") or ""
    conn.close()
    return response.status, content_type, data


def test_local_server_serves_product_ui_and_state_api() -> None:
    server = make_server("127.0.0.1", 0)
    port = server.server_address[1]
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, content_type, html = _request(port, "GET", "/")
        assert status == 200
        assert "text/html" in content_type
        assert b"Planetary Transformation Workbench" in html

        status, content_type, raw = _request(port, "GET", "/api/state")
        assert status == 200
        assert "application/json" in content_type
        state = json.loads(raw)
        assert state["star"]["state"] == "active"

        status, _, raw = _request(
            port,
            "POST",
            "/api/planet/brush",
            {"tool": "heat", "row": 18, "col": 36, "intensity": 30, "radius": 1},
        )
        assert status == 200
        mutated = json.loads(raw)
        assert mutated["planet"]["steps"] == 1
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
