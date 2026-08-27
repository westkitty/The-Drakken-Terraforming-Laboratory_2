from __future__ import annotations

from pathlib import Path

from http.client import HTTPConnection
from threading import Thread

from labui.server import make_server


def _get(port: int, path: str) -> tuple[int, str, bytes]:
    conn = HTTPConnection("127.0.0.1", port, timeout=3)
    conn.request("GET", path)
    response = conn.getresponse()
    payload = response.read()
    content_type = response.getheader("Content-Type") or ""
    status = response.status
    conn.close()
    return status, content_type, payload


def test_v18_celestial_interaction_assets_are_loaded_by_product_shell() -> None:
    server = make_server("127.0.0.1", 0)
    port = server.server_address[1]
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, content_type, html = _get(port, "/")
        assert status == 200
        assert "text/html" in content_type
        assert b'/static/celestial-interaction.css' in html
        assert b'/static/celestial-interaction.js' in html
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def test_v18_orbital_scene_is_interactive_and_state_bound() -> None:
    server = make_server("127.0.0.1", 0)
    port = server.server_address[1]
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, content_type, js = _get(port, "/static/celestial-interaction.js")
        assert status == 200
        assert "text/javascript" in content_type
        assert b"FOCUS LOCK" in js
        assert b"hitAt" in js
        assert b"RELAY-01" in js
        assert b"ORBITAL-03-M1" in js
        assert b"drawBlackHole" in js
        assert b"app.state.star?.state" in js
        assert b"app.state.star?.bond_index" in js

        status, content_type, css = _get(port, "/static/celestial-interaction.css")
        assert status == 200
        assert "text/css" in content_type
        assert b"v18-system-inspector" in css
        assert b"v18-focus-button" in css
        assert b"v18-lighting-overlay" in css
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def test_planet_hit_canvas_is_not_promoted_back_to_opaque_by_celestial_layers() -> None:
    root = Path(__file__).parents[1] / "src/labui/static"
    system = (root / "system-view.css").read_text(encoding="utf-8")
    celestial = (root / "celestial-interaction.css").read_text(encoding="utf-8")
    core = (root / "core-surface.css").read_text(encoding="utf-8")
    assert ".v17-celestial-ready>#planet-canvas" not in system
    assert ".command-center #planet-canvas" not in celestial
    assert ".planet-canvas-wrap>#planet-canvas{opacity:0!important" in core
    assert ".v17-celestial-ready>.cc-globe-layer" in system
