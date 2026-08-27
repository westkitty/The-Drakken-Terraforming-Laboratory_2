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


def test_core_surface_js_loads_before_optional_layers_but_css_contract_loads_last() -> None:
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
        assert html.index(b'/static/core-surface.css') > html.index(b'/static/celestial-interaction.css')
    finally:
        server.shutdown(); server.server_close(); thread.join(timeout=2)


def test_core_surface_uses_shared_classic_script_app_binding_not_window_property() -> None:
    root = Path(__file__).parents[1]
    js = (root / "src/labui/static/core-surface.js").read_text(encoding="utf-8")
    # app.js declares `const app`; classic scripts can resolve that lexical binding by
    # identifier, but it is intentionally not exposed as window.app/globalThis.app.
    assert "globalThis.app" not in js
    assert "app?.state" in js
    assert "app.view" in js
    assert "app.planetRotation" in js


def test_core_surface_has_independent_canvas_and_persistent_css_fallback() -> None:
    root = Path(__file__).parents[1]
    js = (root / "src/labui/static/core-surface.js").read_text(encoding="utf-8")
    css = (root / "src/labui/static/core-surface.css").read_text(encoding="utf-8")
    assert 'core-space-surface' in js
    assert 'core-planet-surface' in js
    assert 'new ResizeObserver' in js
    assert 'drawFallbackSphere' in js
    assert 'drawDistantSystem' in js
    assert 'dataset.corePlanetFrame = "painted"' in js
    assert 'core-render-live' not in js
    assert '.planet-canvas-wrap::before' in css
    assert '.planet-canvas-wrap.core-render-live::before' not in css
    # The starfield canvas must sit below the CSS fallback sphere; otherwise a
    # black space layer can cover the only guaranteed visible body during startup.
    assert '.core-space-surface{z-index:1!important' in css
    assert 'z-index:3;left:50%;top:49%' in css
    assert 'opacity:0!important' in css


def test_no_optional_layer_can_reenable_the_opaque_planet_hit_canvas() -> None:
    root = Path(__file__).parents[1] / "src/labui/static"
    core = (root / "core-surface.css").read_text(encoding="utf-8")
    system = (root / "system-view.css").read_text(encoding="utf-8")
    celestial = (root / "celestial-interaction.css").read_text(encoding="utf-8")
    command = (root / "command-center.css").read_text(encoding="utf-8")

    # The original command-center stylesheet may still contain its historical
    # opacity rule, but the final served contract must force the hit canvas fully
    # transparent and later optional layers must not turn it opaque again.
    assert '#planet-canvas' in command
    assert '.planet-canvas-wrap>#planet-canvas{opacity:0!important' in core
    assert '.v17-celestial-ready>#planet-canvas' not in system
    assert '#planet-canvas' not in celestial or 'opacity:1!important' not in celestial


def test_core_surface_layer_contract_keeps_scene_above_space_and_below_input() -> None:
    css = (Path(__file__).parents[1] / "src/labui/static/core-surface.css").read_text(encoding="utf-8")
    assert '.core-space-surface{z-index:1!important' in css
    assert '.planet-canvas-wrap::before{z-index:3!important' in css
    assert '.planet-canvas-wrap>.core-planet-surface{z-index:4!important' in css
    assert '.planet-canvas-wrap>#planet-canvas{opacity:0!important' in css
    assert 'z-index:15!important' in css


def test_inline_render_contract_outranks_all_stylesheet_visibility_rules() -> None:
    js = (Path(__file__).parents[1] / "src/labui/static/core-surface.js").read_text(encoding="utf-8")
    assert 'function enforceRenderContract()' in js
    assert 'base.style.setProperty("opacity", "0", "important")' in js
    assert 'base.style.setProperty("pointer-events", "auto", "important")' in js
    assert 'space.style.setProperty("z-index", "1", "important")' in js
    assert 'planet.style.setProperty("z-index", "4", "important")' in js
    assert 'wrap.dataset.coreRenderContract = "single-owner"' in js
    assert 'setTimeout(()=>{enforceRenderContract();schedule();},ms)' in js


def test_station_01_disables_duplicate_legacy_globe_renderers() -> None:
    css = (Path(__file__).parents[1] / "src/labui/static/core-surface.css").read_text(encoding="utf-8")
    assert '#view-planet .cc-globe-layer' in css
    assert '#view-planet .v17-globe-layer' in css
    assert '#view-planet .v17-space-layer' in css
    assert 'display:none!important' in css
