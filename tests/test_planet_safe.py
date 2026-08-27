from __future__ import annotations

from http.client import HTTPConnection
from pathlib import Path
from threading import Thread

from labui.server import make_server


def _get(port: int, path: str) -> tuple[int, str, bytes]:
    conn = HTTPConnection("127.0.0.1", port, timeout=3)
    conn.request("GET", path)
    response = conn.getresponse()
    payload = response.read()
    result = (response.status, response.getheader("Content-Type") or "", payload)
    conn.close()
    return result


def _served_html() -> str:
    server = make_server("127.0.0.1", 0)
    port = int(server.server_address[1])
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, content_type, payload = _get(port, "/")
        assert status == 200
        assert "text/html" in content_type
        return payload.decode("utf-8")
    finally:
        server.shutdown(); server.server_close(); thread.join(timeout=2)


def test_v190_background_scene_is_present_before_interaction_canvas() -> None:
    html = _served_html()
    assert 'id="planet-static-scene"' in html
    assert 'src="/static/planet-base.svg"' in html
    assert 'id="planet-render-identity"' in html
    assert 'DRAKKEN SYSTEMS // LOCAL COMPUTATIONAL FACILITY // v1.9.0' in html
    assert 'SCENE 1.9 // SINGLE GLOBE' in html
    assert html.index('id="planet-static-scene"') < html.index('id="planet-canvas"')


def test_v190_served_page_has_one_planet_renderer_owner() -> None:
    html = _served_html()
    # command-center owns the sole visible globe. The three historical Planet
    # renderer experiments must not be loaded at all.
    assert '/static/command-center.css' in html
    assert '/static/command-center.js' in html
    assert '/static/core-surface.css' not in html
    assert '/static/core-surface.js' not in html
    assert '/static/system-view.css' not in html
    assert '/static/system-view.js' not in html
    assert '/static/celestial-interaction.css' not in html
    assert '/static/celestial-interaction.js' not in html


def test_planet_safe_contract_exposes_command_center_globe_and_transparent_hit_surface() -> None:
    root = Path(__file__).parents[1]
    css = (root / "src/labui/static/planet-safe.css").read_text(encoding="utf-8")
    js = (root / "src/labui/static/planet-safe.js").read_text(encoding="utf-8")
    assert '.planet-canvas-wrap>.cc-globe-layer' in css
    assert '.planet-canvas-wrap>.cc-globe-hud' in css
    assert 'planet-canvas-wrap>#planet-canvas' in css
    assert 'opacity:0!important' in css
    assert '.core-planet-surface' in css
    assert 'display:none!important' in css
    assert 'MutationObserver' not in js
    assert 'ResizeObserver' not in js
    assert 'command-center-single-globe' in js
    assert 'SINGLE GLOBE' in js
    assert 'app.state' not in js
    assert 'globalThis.app' not in js


def test_planet_background_contains_depth_system_but_no_second_planet() -> None:
    root = Path(__file__).parents[1]
    svg = (root / "src/labui/static/planet-base.svg").read_text(encoding="utf-8")
    assert 'id="ps-star-volume"' in svg
    assert 'id="ps-distant-system"' in svg
    assert 'id="ps-chamber-frame"' in svg
    assert 'id="ps-projector-deck"' in svg
    assert 'id="ps-projection-rings"' in svg
    # The background may contain distant system bodies, but never a central
    # shared-world sphere. That belongs exclusively to command-center.js.
    assert 'id="ps-planet-clip"' not in svg
    assert 'url(#ps-planet)' not in svg


def test_command_center_globe_is_single_owner_and_concept_scaled() -> None:
    root = Path(__file__).parents[1]
    js = (root / "src/labui/static/command-center.js").read_text(encoding="utf-8")
    css = (root / "src/labui/static/planet-safe.css").read_text(encoding="utf-8")
    safe_js = (root / "src/labui/static/planet-safe.js").read_text(encoding="utf-8")
    assert 'class GlobeRenderer' in js
    assert 'class CanvasGlobeRenderer' in js
    assert 'transform:scale(.87)!important' in css
    assert 'conceptPlanetGeometry' in safe_js


def test_planet_safe_static_routes_are_served() -> None:
    server = make_server("127.0.0.1", 0)
    port = int(server.server_address[1])
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        for path, media, token in [
            ("/static/planet-safe.css", "text/css", b"one visual globe owner"),
            ("/static/planet-safe.js", "text/javascript", b"single-globe guard"),
            ("/static/planet-base.svg", "image/svg+xml", b"ps-distant-system"),
        ]:
            status, content_type, payload = _get(port, path)
            assert status == 200
            assert media in content_type
            assert token in payload
    finally:
        server.shutdown(); server.server_close(); thread.join(timeout=2)


def test_health_exposes_active_ui_build_identity() -> None:
    server = make_server("127.0.0.1", 0)
    port = int(server.server_address[1])
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, content_type, payload = _get(port, "/api/health")
        assert status == 200
        assert "application/json" in content_type
        assert b'"version":"1.9.0"' in payload
        assert b'"ui_build":"1.9.0-concept-single-globe"' in payload
    finally:
        server.shutdown(); server.server_close(); thread.join(timeout=2)


def test_default_launcher_refuses_silent_port_hopping(capsys) -> None:
    from labui.server import launch_laboratory

    occupied = make_server("127.0.0.1", 0)
    port = int(occupied.server_address[1])
    try:
        rc = launch_laboratory(host="127.0.0.1", port=port, open_browser=False)
        assert rc == 2
        out = capsys.readouterr().out
        assert "Refusing to start a second copy on another port" in out
    finally:
        occupied.server_close()


def test_package_data_includes_static_svg() -> None:
    root = Path(__file__).parents[1]
    pyproject = (root / "pyproject.toml").read_text(encoding="utf-8")
    assert '"static/*.svg"' in pyproject
