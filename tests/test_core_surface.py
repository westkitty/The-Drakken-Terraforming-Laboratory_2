from __future__ import annotations

from http.client import HTTPConnection
from pathlib import Path
from threading import Thread

from labui.server import make_server


def _get(port: int, path: str) -> tuple[int, str, bytes]:
    conn = HTTPConnection("127.0.0.1", port, timeout=3)
    conn.request("GET", path)
    response = conn.getresponse()
    body = response.read()
    result = (response.status, response.getheader("Content-Type") or "", body)
    conn.close()
    return result


def test_core_surface_is_loaded_before_optional_celestial_layers() -> None:
    server = make_server("127.0.0.1", 0)
    port = server.server_address[1]
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, _, html = _get(port, "/")
        assert status == 200
        assert b'/static/core-surface.css' in html
        assert b'/static/core-surface.js' in html
        assert html.index(b'/static/core-surface.js') < html.index(b'/static/system-view.js')
        assert html.index(b'/static/core-surface.css') < html.index(b'/static/system-view.css')
    finally:
        server.shutdown(); server.server_close(); thread.join(timeout=2)


def test_core_surface_has_independent_canvas_and_css_fallback() -> None:
    root = Path(__file__).parents[1]
    js = (root / "src/labui/static/core-surface.js").read_text(encoding="utf-8")
    css = (root / "src/labui/static/core-surface.css").read_text(encoding="utf-8")
    assert 'core-space-surface' in js
    assert 'core-planet-surface' in js
    assert 'new ResizeObserver' in js
    assert 'drawFallbackSphere' in js
    assert 'drawDistantSystem' in js
    assert 'core-render-live' in js
    assert '.planet-canvas-wrap::before' in css
    assert '.planet-canvas-wrap.core-render-live::before' in css
    assert 'opacity:.001!important' in css
