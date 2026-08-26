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
        assert b"/static/incubator.css" in html
        assert b"/static/incubator.js" in html
        assert b"/static/command-center.css" in html
        assert b"/static/command-center.js" in html
        assert b"/static/state-transitions.css" in html
        assert b"/static/state-transitions.js" in html

        status, content_type, plugin = _request(port, "GET", "/static/incubator.js")
        assert status == 200
        assert "text/javascript" in content_type
        assert b"Drakken Egg & Specimen Incubator" in plugin

        status, content_type, command_center = _request(port, "GET", "/static/command-center.js")
        assert status == 200
        assert "text/javascript" in content_type
        assert b"Command-center renderer" in command_center
        assert b"CanvasGlobeRenderer" in command_center

        status, content_type, transition_js = _request(port, "GET", "/static/state-transitions.js")
        assert status == 200
        assert "text/javascript" in content_type
        assert b"State Transition Director" in transition_js
        assert b"ABSOLUTE NULLIFICATION" in transition_js
        assert b"HELIOCIDE" in transition_js
        assert b"CONTAINMENT FRACTURE" in transition_js

        status, content_type, transition_css = _request(port, "GET", "/static/state-transitions.css")
        assert status == 200
        assert "text/css" in content_type
        assert b"cc-fx-heliocide" in transition_css
        assert b"cc-fx-nullification" in transition_css

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


def test_specimen_catalog_exposes_canon_locked_archive_models_and_lab_egg() -> None:
    session = LaboratorySession()
    catalog = session.snapshot()["specimens"]["catalog"]
    ids = [item["profile_id"] for item in catalog]
    assert ids == ["fault_tongue", "obsidian_gul", "tremorhound", "vortenbray", "experimental_egg"]
    assert catalog[-1]["classification"] == "LAB MODEL — NON-CANON DESIGNATION"


def test_fault_tongue_specimen_pulses_mutate_planet_deterministically() -> None:
    first = LaboratorySession()
    second = LaboratorySession()
    before = first.snapshot()["planet"]["state_hash"]
    first.hatch_specimen(profile_id="fault_tongue", row=18, col=36)
    second.hatch_specimen(profile_id="fault_tongue", row=18, col=36)
    state_a = first.pulse_specimen(steps=7)
    state_b = second.pulse_specimen(steps=7)
    assert state_a["planet"]["state_hash"] != before
    assert state_a["planet"]["state_hash"] == state_b["planet"]["state_hash"]
    specimen = state_a["specimens"]["active"]
    assert specimen["pulses"] == 7
    assert specimen["effect_totals"]["stress_pa"] > 0
    assert len(specimen["trail"]) == 8


def test_experimental_egg_accepts_tuned_phenotype_but_archive_profiles_are_locked() -> None:
    session = LaboratorySession()
    tuned = session.hatch_specimen(
        profile_id="experimental_egg",
        row=12,
        col=24,
        phenotype={"thermal": 0.8, "elevation": -0.4, "stress": 0.6, "pressure": 0.1, "co2": 0.0},
    )
    phenotype = tuned["specimens"]["active"]["phenotype"]
    assert phenotype["thermal"] == 0.8
    assert phenotype["elevation"] == -0.4
    session.terminate_specimen()
    with pytest.raises(ValueError, match="archive phenotype models are locked"):
        session.hatch_specimen(
            profile_id="obsidian_gul",
            row=12,
            col=24,
            phenotype={"thermal": 0.1},
        )


def test_syrin_contact_nullifies_active_specimen_notebook_field() -> None:
    session = LaboratorySession()
    session.hatch_specimen(profile_id="vortenbray", row=18, col=36)
    state = session.inject_syrin(contact_fraction=1e-18)
    specimen = state["specimens"]["active"]
    assert specimen["active"] is False
    assert specimen["field_state"] == "nullified"
    assert "physical specimen state is not inferred" in specimen["status_note"]
    with pytest.raises(DrakkenLabError, match="inert"):
        session.pulse_specimen(steps=1)


def test_local_server_specimen_api_hatches_and_pulses_shared_planet() -> None:
    server = make_server("127.0.0.1", 0)
    port = server.server_address[1]
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, _, raw = _request(
            port,
            "POST",
            "/api/specimen/hatch",
            {"profile_id": "tremorhound", "row": 18, "col": 36},
        )
        assert status == 200
        hatched = json.loads(raw)
        before = hatched["planet"]["state_hash"]
        assert hatched["specimens"]["active"]["name"] == "Tremorhound"

        status, _, raw = _request(port, "POST", "/api/specimen/pulse", {"steps": 3})
        assert status == 200
        pulsed = json.loads(raw)
        assert pulsed["specimens"]["active"]["pulses"] == 3
        assert pulsed["planet"]["state_hash"] != before
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


@pytest.mark.parametrize("profile_id", ["fault_tongue", "obsidian_gul", "tremorhound", "vortenbray", "experimental_egg"])
def test_every_specimen_profile_survives_24_deterministic_pulses(profile_id: str) -> None:
    session = LaboratorySession()
    session.hatch_specimen(profile_id=profile_id, row=18, col=36)
    state = session.pulse_specimen(steps=24)
    specimen = state["specimens"]["active"]
    assert specimen["pulses"] == 24
    assert len(specimen["trail"]) == 25
    assert state["planet"]["state_hash"]


def test_command_center_state_exposes_surface_stress_for_real_field_visualization() -> None:
    session = LaboratorySession()
    baseline = session.snapshot()
    assert "stress_pa" in baseline["planet"]["maps"]
    assert baseline["planet"]["stats"]["stress_max_pa"] == 0.0
    mutated = session.apply_brush(tool="fracture", row=18, col=36, intensity=100, radius=2)
    assert mutated["planet"]["stats"]["stress_max_pa"] > 0
    assert max(max(row) for row in mutated["planet"]["maps"]["stress_pa"]) > 0


def test_command_center_specimen_stress_is_visible_in_shared_planet_snapshot() -> None:
    session = LaboratorySession()
    session.hatch_specimen(profile_id="fault_tongue", row=18, col=36)
    state = session.pulse_specimen(steps=3)
    assert state["planet"]["stats"]["stress_max_pa"] > 0
    assert state["specimens"]["active"]["effect_totals"]["stress_pa"] > 0
