import json
from pathlib import Path

import pytest

from labui.experiments import (
    FORMAT_VERSION,
    PRESETS,
    compare_records,
    export_record,
    import_record,
    validate_record,
)
from labui.session import LaboratorySession


@pytest.mark.parametrize("preset_id", sorted(PRESETS))
def test_every_preset_replays_to_identical_final_hash(preset_id: str) -> None:
    session = LaboratorySession()
    record = session.experiments.run_preset(preset_id)
    assert record["format_version"] == FORMAT_VERSION
    assert all(item["passed"] for item in record["invariants"])
    session.experiments.load(record)
    session.experiments.start_replay()
    replay = session.experiments.replay_all()["replay"]
    assert replay["cursor"] == replay["total"]
    assert replay["mismatch"] is None


def test_experiment_round_trip_and_safe_overwrite(tmp_path: Path) -> None:
    record = LaboratorySession().experiments.run_preset("terraforming-macro-cascade")
    path = tmp_path / "run.json"
    export_record(record, path)
    assert import_record(path) == record
    with pytest.raises(FileExistsError):
        export_record(record, path)


def test_invalid_version_and_non_finite_data_fail_closed() -> None:
    record = LaboratorySession().experiments.run_preset("partial-total-withdrawal")
    wrong = dict(record)
    wrong["format_version"] = 999
    with pytest.raises(ValueError, match="unsupported experiment format"):
        validate_record(wrong)

    invalid = json.loads(json.dumps(record))
    invalid["telemetry_summary"]["bad"] = float("inf")
    with pytest.raises(ValueError, match="non-finite"):
        validate_record(invalid)


def test_comparison_reports_differences_without_quality_score() -> None:
    left = LaboratorySession().experiments.run_preset("partial-total-withdrawal")
    right = LaboratorySession().experiments.run_preset("starbinding-geometry")
    comparison = compare_records(left, right)
    assert comparison["identical"] is False
    assert comparison["differences"]
    assert "score" not in comparison
    assert "winner" not in comparison


def test_identical_runs_compare_as_identical() -> None:
    left = LaboratorySession().experiments.run_preset("terraforming-macro-cascade")
    right = LaboratorySession().experiments.run_preset("terraforming-macro-cascade")
    comparison = compare_records(left, right)
    assert comparison["identical"] is True


def test_syrin_boundary_prevents_later_macro_mutation() -> None:
    record = LaboratorySession().experiments.run_preset("syrin-interruption-boundary")
    labels = {item["id"]: item for item in record["invariants"]}
    assert labels["syrin-nullification"]["passed"] is True
    assert labels["no-post-null-macro"]["passed"] is True


def test_cross_station_preset_consumes_current_session_heliocide_event() -> None:
    session = LaboratorySession()
    record = session.experiments.run_preset("cross-station-heliocide-wall")
    state = session.snapshot()
    assert state["star"]["heliocide_event"] is not None
    assert state["siege_wall"]["source_heliocide_event_id"] == state["star"]["heliocide_event"]["event_id"]
    assert record["telemetry_summary"]["heliocide_events"] == 1


def test_replay_mismatch_detection_is_explicit() -> None:
    session = LaboratorySession()
    record = session.experiments.run_preset("partial-total-withdrawal")
    broken = json.loads(json.dumps(record))
    broken["final_state_hash"] = "0" * 64
    session.experiments.load(broken)
    session.experiments.start_replay()
    replay = session.experiments.replay_all()["replay"]
    assert replay["mismatch"]["expected"] == "0" * 64
    assert len(replay["mismatch"]["actual"]) == 64


def test_checkpoint_jump_replays_real_actions() -> None:
    session = LaboratorySession()
    record = session.experiments.run_preset("partial-total-withdrawal")
    session.experiments.load(record)
    session.experiments.start_replay()
    status = session.experiments.jump("partial-withdrawal")
    assert status["replay"]["cursor"] == 1
    assert session.snapshot()["star"]["state"] == "active"
    assert session.snapshot()["star"]["starsilk_remaining"] == "0.5"


def test_manual_station_actions_can_be_recorded_and_replayed() -> None:
    session = LaboratorySession()
    session.experiments.apply_action("star.withdraw", {"fraction": 0.25}, record=False)
    session.experiments.apply_action("planet.step", {"seconds": 0.5}, record=False)
    record = session.experiments.record_current()
    assert [item["op"] for item in record["actions"]] == ["star.withdraw", "planet.step"]
    session.experiments.load(record)
    session.experiments.start_replay()
    replay = session.experiments.replay_all()["replay"]
    assert replay["mismatch"] is None


def test_experiment_ui_controls_and_real_replay_routes_are_wired() -> None:
    root = Path(__file__).parents[1]
    html = (root / "src/labui/static/index.html").read_text(encoding="utf-8")
    js = (root / "src/labui/static/app.js").read_text(encoding="utf-8")
    server = (root / "src/labui/server.py").read_text(encoding="utf-8")
    assert 'id="experiment-timeline"' in html
    assert 'id="invariant-list"' in html
    assert 'id="experiment-import"' in html
    assert 'id="experiment-compare"' in html
    assert "/api/experiment/replay/step" in js
    assert "/api/experiment/replay/run" in js
    assert "/api/experiment/import" in server
    assert "/api/experiment/compare" in server
