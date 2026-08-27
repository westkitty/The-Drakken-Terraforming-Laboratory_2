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


def test_v18_celestial_interaction_stack_is_retired_from_product_shell() -> None:
    server = make_server("127.0.0.1", 0)
    port = server.server_address[1]
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, content_type, html = _get(port, "/")
        assert status == 200
        assert "text/html" in content_type
        assert b'/static/celestial-interaction.css' not in html
        assert b'/static/celestial-interaction.js' not in html
        assert b'/static/display-first.js' in html
    finally:
        server.shutdown(); server.server_close(); thread.join(timeout=2)


def test_retired_celestial_interaction_assets_remain_inspectable() -> None:
    server = make_server("127.0.0.1", 0)
    port = server.server_address[1]
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, content_type, js = _get(port, "/static/celestial-interaction.js")
        assert status == 200
        assert "text/javascript" in content_type
        assert b"FOCUS LOCK" in js
        status, content_type, css = _get(port, "/static/celestial-interaction.css")
        assert status == 200
        assert "text/css" in content_type
        assert b"v18-system-inspector" in css
    finally:
        server.shutdown(); server.server_close(); thread.join(timeout=2)


def test_single_globe_guard_keeps_hit_canvas_transparent() -> None:
    root = Path(__file__).parents[1] / "src/labui/static"
    safe = (root / "planet-safe.css").read_text(encoding="utf-8")
    assert '.planet-canvas-wrap>#planet-canvas' in safe
    assert 'opacity:0!important' in safe
    assert '.planet-canvas-wrap>.cc-globe-layer' in safe
    assert 'display:block!important' in safe
