"""Append-only deterministic JSONL telemetry with hash chaining."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any


class TelemetryLogger:
    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.sequence = 0
        self.previous_hash = "0" * 64
        if self.path.exists():
            self._resume()

    def log(self, topic: str, payload: dict[str, Any]) -> dict[str, Any]:
        if not topic:
            raise ValueError("telemetry topic cannot be empty")
        self.sequence += 1
        record = {
            "sequence": self.sequence,
            "topic": topic,
            "payload": payload,
            "previous_hash": self.previous_hash,
        }
        canonical = json.dumps(record, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        record_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        record["hash"] = record_hash
        with self.path.open("a", encoding="utf-8", newline="\n") as handle:
            handle.write(json.dumps(record, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n")
        self.previous_hash = record_hash
        return record

    def _resume(self) -> None:
        previous = "0" * 64
        sequence = 0
        with self.path.open("r", encoding="utf-8") as handle:
            for raw in handle:
                raw = raw.strip()
                if not raw:
                    continue
                record = json.loads(raw)
                if record.get("sequence") != sequence + 1 or record.get("previous_hash") != previous:
                    raise ValueError("telemetry chain is not contiguous")
                supplied_hash = record.get("hash")
                body = {key: value for key, value in record.items() if key != "hash"}
                canonical = json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
                computed = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
                if supplied_hash != computed:
                    raise ValueError("telemetry chain hash mismatch")
                sequence = record["sequence"]
                previous = supplied_hash
        self.sequence = sequence
        self.previous_hash = previous
