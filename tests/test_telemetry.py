import json

import pytest

from cli.telemetry import TelemetryLogger


def test_telemetry_hash_chain_resumes_deterministically(tmp_path) -> None:
    path = tmp_path / "run.jsonl"
    first = TelemetryLogger(path)
    a = first.log("macro", {"value": 1})
    b = first.log("macro", {"value": 2})
    resumed = TelemetryLogger(path)
    c = resumed.log("macro", {"value": 3})
    assert a["sequence"] == 1
    assert b["previous_hash"] == a["hash"]
    assert c["sequence"] == 3
    assert c["previous_hash"] == b["hash"]


def test_telemetry_detects_tampering(tmp_path) -> None:
    path = tmp_path / "run.jsonl"
    logger = TelemetryLogger(path)
    logger.log("macro", {"value": 1})
    records = [json.loads(line) for line in path.read_text().splitlines()]
    records[0]["payload"]["value"] = 999
    path.write_text("\n".join(json.dumps(item) for item in records) + "\n")
    with pytest.raises(ValueError, match="hash mismatch"):
        TelemetryLogger(path)
