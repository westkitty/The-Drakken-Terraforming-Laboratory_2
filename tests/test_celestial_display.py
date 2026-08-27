from __future__ import annotations

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


def test_celestial_display_assets_are_loaded_by_product_shell() -> None:
    server = make_server("127.0.0.1", 0)
    port = server.server_address[1]
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, content_type, html = _get(port, "/")
        assert status == 200
        assert "text/html" in content_type
        assert b'/static/system-view.css' in html
        assert b'/static/system-view.js' in html
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def test_celestial_renderer_keeps_globe_and_orbital_context_independent_of_webgl() -> None:
    server = make_server("127.0.0.1", 0)
    port = server.server_address[1]
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, content_type, js = _get(port, "/static/system-view.js")
        assert status == 200
        assert "text/javascript" in content_type
        assert b"Canvas2D" in js
        assert b"class CelestialStage" in js
        assert b"drawDistantSystem" in js
        assert b"makeStars" in js

        status, content_type, css = _get(port, "/static/system-view.css")
        assert status == 200
        assert "text/css" in content_type
        assert b"v17-space-layer" in css
        assert b"v17-globe-layer" in css
        assert b"v17-celestial-ready" in css
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
