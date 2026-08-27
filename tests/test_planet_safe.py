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


def test_v186_static_scene_is_in_served_html_before_browser_scripts_run() -> None:
    server = make_server("127.0.0.1", 0)
    port = int(server.server_address[1])
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, content_type, payload = _get(port, "/")
        assert status == 200
        assert "text/html" in content_type
        html = payload.decode("utf-8")
        assert 'id="planet-static-scene"' in html
        assert 'src="/static/planet-base.svg"' in html
        assert 'id="planet-render-identity"' in html
        assert 'DRAKKEN SYSTEMS // LOCAL COMPUTATIONAL FACILITY // v1.8.6' in html
        assert html.index('id="planet-static-scene"') < html.index('id="planet-canvas"')
    finally:
        server.shutdown(); server.server_close(); thread.join(timeout=2)


def test_planet_safe_assets_load_after_every_server_injected_presentation_layer() -> None:
    server = make_server("127.0.0.1", 0)
    port = int(server.server_address[1])
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, content_type, payload = _get(port, "/")
        assert status == 200
        assert "text/html" in content_type
        html = payload.decode("utf-8")
        assert html.index('/static/core-surface.css') < html.index('/static/planet-safe.css')
        assert html.index('/static/celestial-interaction.css') < html.index('/static/planet-safe.css')
        assert html.index('/static/celestial-interaction.js') < html.index('/static/planet-safe.js')
        assert html.index('/static/core-surface.js') < html.index('/static/planet-safe.js')
    finally:
        server.shutdown(); server.server_close(); thread.join(timeout=2)


def test_planet_safe_contract_has_non_canvas_visible_body_and_transparent_hit_surface() -> None:
    root = Path(__file__).parents[1]
    css = (root / "src/labui/static/planet-safe.css").read_text(encoding="utf-8")
    js = (root / "src/labui/static/planet-safe.js").read_text(encoding="utf-8")
    assert '#planet-static-scene' in css
    assert 'opacity:1!important' in css
    assert 'planet-canvas-wrap>#planet-canvas' in css
    assert 'opacity:0!important' in css
    assert '.v17-globe-layer' in css
    assert '.v18-lighting-overlay' in css
    assert 'MutationObserver' in js
    assert 'sceneOwner' in js
    assert '__drakkenSceneDiagnostics' in js
    # Visibility protection is DOM/CSS based and must not depend on simulation state.
    assert 'app.state' not in js
    assert 'globalThis.app' not in js


def test_planet_safe_static_routes_are_served() -> None:
    server = make_server("127.0.0.1", 0)
    port = int(server.server_address[1])
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        for path, media, token in [
            ("/static/planet-safe.css", "text/css", b"hard visibility contract"),
            ("/static/planet-safe.js", "text/javascript", b"visibility watchdog"),
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
        assert b'"version":"1.8.6"' in payload
        assert b'"ui_build":"1.8.6-svg-base"' in payload
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
