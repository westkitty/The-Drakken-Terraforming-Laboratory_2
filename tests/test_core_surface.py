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


def test_core_surface_experiment_is_not_loaded_by_v190_shell() -> None:
    server = make_server("127.0.0.1", 0)
    port = server.server_address[1]
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        status, _, html = _get(port, "/")
        assert status == 200
        assert b'/static/core-surface.css' not in html
        assert b'/static/core-surface.js' not in html
        assert b'/static/command-center.js' in html
        assert b'/static/planet-safe.js' in html
    finally:
        server.shutdown(); server.server_close(); thread.join(timeout=2)


def test_core_surface_assets_are_retained_only_as_historical_implementation() -> None:
    root = Path(__file__).parents[1]
    js = (root / "src/labui/static/core-surface.js").read_text(encoding="utf-8")
    css = (root / "src/labui/static/core-surface.css").read_text(encoding="utf-8")
    assert 'core-space-surface' in js
    assert 'core-planet-surface' in js
    assert '.core-space-surface' in css


def test_single_owner_contract_is_last_and_blocks_historical_globes() -> None:
    root = Path(__file__).parents[1] / "src/labui/static"
    safe = (root / "planet-safe.css").read_text(encoding="utf-8")
    assert '.planet-canvas-wrap>.cc-globe-layer' in safe
    assert '.planet-canvas-wrap>.core-planet-surface' in safe
    assert '.planet-canvas-wrap>.v17-globe-layer' in safe
    assert 'display:none!important' in safe
    assert '.planet-canvas-wrap>#planet-canvas' in safe
    assert 'opacity:0!important' in safe
