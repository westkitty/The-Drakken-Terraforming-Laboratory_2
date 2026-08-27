from pathlib import Path


def test_display_first_visual_stage_is_not_assigned_to_zero_height_grid_row() -> None:
    root = Path(__file__).parents[1]
    css = (root / "src/labui/static/display-first.css").read_text(encoding="utf-8")
    assert "grid-template-rows:0 minmax(0,1fr)!important" not in css
    assert "grid-template-rows:minmax(0,1fr)!important" in css
    assert ".planet-stage-card>.canvas-wrap" in css
    assert "grid-row:1!important" in css


def test_planet_stage_keeps_full_height_canvas_wrapper_under_display_first_shell() -> None:
    root = Path(__file__).parents[1]
    css = (root / "src/labui/static/display-first.css").read_text(encoding="utf-8")
    assert ".display-first .planet-layout" in css
    assert ".display-first .planet-stage-card" in css
    assert ".display-first .canvas-wrap{height:100%" in css
