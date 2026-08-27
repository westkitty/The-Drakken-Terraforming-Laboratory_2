from __future__ import annotations

from http.client import HTTPConnection
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


def test_legacy_system_view_is_retired_from_product_shell() -> None:
    server = make_server("127.0.0.1", 0)
    port = server.server_address[1]
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, content_type, html = _get(port, "/")
        assert status == 200
        assert "text/html" in content_type
        assert b'/static/system-view.css' not in html
        assert b'/static/system-view.js' not in html
        assert b'/static/command-center.js' in html
        assert b'/static/planet-base.svg' in html
    finally:
        server.shutdown(); server.server_close(); thread.join(timeout=2)


def test_retired_system_view_assets_remain_inspectable_but_are_not_runtime_owners() -> None:
    server = make_server("127.0.0.1", 0)
    port = server.server_address[1]
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, content_type, js = _get(port, "/static/system-view.js")
        assert status == 200
        assert "text/javascript" in content_type
        assert b"class CelestialStage" in js
        status, content_type, css = _get(port, "/static/system-view.css")
        assert status == 200
        assert "text/css" in content_type
        assert b"v17-globe-layer" in css
    finally:
        server.shutdown(); server.server_close(); thread.join(timeout=2)
