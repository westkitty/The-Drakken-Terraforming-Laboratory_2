"""Deterministic experiment recording, replay, comparison, and invariant proof."""
from __future__ import annotations

from copy import deepcopy
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import json
import math
from pathlib import Path
from typing import Any, Callable

from core.errors import DrakkenLabError

FORMAT_VERSION = 1
EXPERIMENT_CLASSIFICATIONS = {"CANONICAL", "EXPERIMENTAL / NON-CANON"}


def _canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)


def deterministic_hash(value: Any) -> str:
    return hashlib.sha256(_canonical_json(value).encode("utf-8")).hexdigest()


def deterministic_projection(snapshot: dict[str, Any]) -> dict[str, Any]:
    """Strip presentation-only data while retaining deterministic laboratory state."""
    star = snapshot["star"]
    macro = snapshot["macro"]
    return {
        "planet": {
            "steps": snapshot["planet"]["steps"],
            "state_hash": snapshot["planet"]["state_hash"],
        },
        "star": {
            "core_id": star["core_id"],
            "state": star["state"],
            "starsilk_remaining": star["starsilk_remaining"],
            "heliocide_event": star["heliocide_event"],
        },
        "inert": snapshot["inert"],
        "nullification": snapshot["nullification"],
        "macro": {
            "source_hash": macro["source_hash"],
            "cursor": macro["cursor"],
            "total": macro["total"],
            "complete": macro["complete"],
            "registers": macro["registers"],
        },
        "starbinding": snapshot["starbinding"]["history"],
        "siege_wall": snapshot["siege_wall"],
        "specimen": snapshot["specimens"]["active"],
    }


def snapshot_state_hash(snapshot: dict[str, Any]) -> str:
    return deterministic_hash(deterministic_projection(snapshot))


def _finite_walk(value: Any) -> bool:
    if isinstance(value, bool) or value is None or isinstance(value, (str, int)):
        return True
    if isinstance(value, float):
        return math.isfinite(value)
    if isinstance(value, Decimal):
        return value.is_finite()
    if isinstance(value, dict):
        return all(_finite_walk(v) for v in value.values())
    if isinstance(value, (list, tuple)):
        return all(_finite_walk(v) for v in value)
    return True


def _check(check_id: str, label: str, passed: bool, evidence: str) -> dict[str, Any]:
    return {"id": check_id, "label": label, "passed": bool(passed), "evidence": evidence}


def invariant_results(
    snapshot: dict[str, Any],
    *,
    events: list[dict[str, Any]],
    actions: list[dict[str, Any]],
    expected_hash: str | None = None,
    expected_event_count: int | None = None,
) -> list[dict[str, Any]]:
    star = snapshot["star"]
    event = star.get("heliocide_event")
    remaining = Decimal(str(star["starsilk_remaining"]))
    heliocide_consistent = (remaining == 0 and star["state"] == "collapsed" and event is not None) or (
        remaining > 0 and star["state"] == "active" and event is None
    )
    inert = bool(snapshot["inert"])
    nullification = snapshot["nullification"]
    syrin_consistent = (not inert and nullification is None) or (inert and nullification is not None)
    post_null_actions = []
    seen_null = False
    for item in events:
        if item.get("kind") == "syrin":
            seen_null = True
            continue
        if seen_null and item.get("kind") in {"macro", "stellar"} and item.get("mutation", False):
            post_null_actions.append(item.get("index"))
    siege = snapshot.get("siege_wall")
    lattice_consistent = True
    lattice_evidence = "no lattice configured"
    if siege:
        fractured = bool(siege.get("fractured"))
        if fractured:
            lattice_consistent = bool(siege.get("fracture_reason"))
            lattice_evidence = str(siege.get("fracture_reason") or "fracture lacked reason")
        else:
            utilizations = [n.get("utilization") for n in siege.get("nodes", []) if n.get("utilization") is not None]
            lattice_consistent = all(float(v) <= 1.0 for v in utilizations)
            lattice_evidence = f"{len(utilizations)} solved node utilizations"
    current_hash = snapshot_state_hash(snapshot)
    replay_match = expected_hash is None or current_hash == expected_hash
    event_count_match = expected_event_count is None or len(events) == expected_event_count
    return [
        _check("finite-state", "All numeric deterministic state is finite", _finite_walk(deterministic_projection(snapshot)), "recursive finite-value scan"),
        _check("starsilk-depletion", "Starsilk depletion / heliocide invariant", heliocide_consistent, f"state={star['state']} remaining={star['starsilk_remaining']} event={bool(event)}"),
        _check("syrin-nullification", "Syrin nullification invariant", syrin_consistent, f"inert={inert} record={bool(nullification)}"),
        _check("no-post-null-macro", "No post-nullification Macro/stellar mutation", not post_null_actions, f"violating event indexes={post_null_actions}"),
        _check("heliocide-event", "HeliocideEvent consistency", heliocide_consistent, "collapse and event evidence agree"),
        _check("lattice", "Siege Wall lattice consistency", lattice_consistent, lattice_evidence),
        _check("replay-hash", "Deterministic replay state hash", replay_match, f"actual={current_hash}" + (f" expected={expected_hash}" if expected_hash else "")),
        _check("replay-event-count", "Replay event-count consistency", event_count_match, f"actual={len(events)}" + (f" expected={expected_event_count}" if expected_event_count is not None else "")),
        _check("bounded-actions", "Experiment action sequence is bounded", len(actions) <= 10_000, f"actions={len(actions)}"),
    ]


def validate_record(record: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(record, dict):
        raise ValueError("experiment JSON must be an object")
    required = {
        "format_version", "experiment_id", "experiment_type", "classification",
        "initial_configuration", "actions", "events", "checkpoints",
        "final_state_hash", "invariants", "telemetry_summary",
    }
    missing = sorted(required - set(record))
    if missing:
        raise ValueError(f"experiment record missing fields: {', '.join(missing)}")
    if record["format_version"] != FORMAT_VERSION:
        raise ValueError(f"unsupported experiment format version {record['format_version']!r}; expected {FORMAT_VERSION}")
    if record["classification"] not in EXPERIMENT_CLASSIFICATIONS:
        raise ValueError("classification must be CANONICAL or EXPERIMENTAL / NON-CANON")
    if not isinstance(record["experiment_id"], str) or not record["experiment_id"].strip():
        raise ValueError("experiment_id must be a non-empty string")
    if not isinstance(record["experiment_type"], str) or not record["experiment_type"].strip():
        raise ValueError("experiment_type must be a non-empty string")
    for field in ("initial_configuration", "telemetry_summary"):
        if not isinstance(record[field], dict):
            raise ValueError(f"{field} must be an object")
    for field in ("actions", "events", "checkpoints", "invariants"):
        if not isinstance(record[field], list):
            raise ValueError(f"{field} must be an array")
    if not isinstance(record["final_state_hash"], str) or len(record["final_state_hash"]) != 64:
        raise ValueError("final_state_hash must be a SHA-256 hex digest")
    if not _finite_walk(record):
        raise ValueError("experiment contains non-finite numeric values")
    for idx, action in enumerate(record["actions"]):
        if not isinstance(action, dict) or not isinstance(action.get("op"), str):
            raise ValueError(f"action {idx} is malformed")
        if not isinstance(action.get("args", {}), dict):
            raise ValueError(f"action {idx}.args must be an object")
    return record


def export_record(record: dict[str, Any], path: Path, *, overwrite: bool = False) -> None:
    validate_record(record)
    if path.exists() and not overwrite:
        raise FileExistsError(f"refusing to overwrite existing experiment file: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(record, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def import_record(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"cannot read experiment JSON: {exc}") from exc
    return validate_record(value)


PRESETS: dict[str, dict[str, Any]] = {
    "partial-total-withdrawal": {
        "title": "Partial vs Total Stellar Withdrawal",
        "classification": "CANONICAL",
        "type": "stellar-withdrawal",
        "actions": [
            {"op": "star.withdraw", "args": {"fraction": 0.5}, "checkpoint": "partial-withdrawal"},
            {"op": "star.withdraw", "args": {"fraction": 0.5}, "checkpoint": "total-withdrawal-heliocide"},
        ],
    },
    "syrin-interruption-boundary": {
        "title": "Syrin Interruption Boundary",
        "classification": "CANONICAL",
        "type": "syrin-boundary",
        "actions": [
            {"op": "macro.load", "args": {"source": "SET pulse 0\nADD pulse 1\nEMIT THERMAL_ENERGY 0 18 36 5e12\nADD pulse 1\nEMIT LITHO_STRESS 0 18 36 1e8\n"}},
            {"op": "macro.step", "args": {}},
            {"op": "macro.step", "args": {}},
            {"op": "syrin.inject", "args": {"contact_fraction": 1e-18}, "checkpoint": "contact-boundary"},
            {"op": "macro.step", "args": {}, "checkpoint": "prevented-instruction"},
        ],
    },
    "terraforming-macro-cascade": {
        "title": "Terraforming Macro Cascade",
        "classification": "CANONICAL",
        "type": "terraforming-cascade",
        "actions": [
            {"op": "macro.load", "args": {"source": "SET pulse 0\nREPEAT 2 {\n ADD pulse 1\n EMIT THERMAL_ENERGY 0 18 36 2.5e13\n EMIT LITHO_ELEVATION 0 18 36 95\n EMIT LITHO_STRESS 0 18 36 5e7\n EMIT ATMOS_PRESSURE 0 18 36 1200\n EMIT ATMOS_GAS co2 0 18 36 0.002\n}\nASSERT pulse == 2\n"}},
            {"op": "macro.run", "args": {}, "checkpoint": "macro-complete"},
        ],
    },
    "starbinding-geometry": {
        "title": "Starbinding Hit / Miss / Partial / Heliocide",
        "classification": "CANONICAL",
        "type": "starbinding-geometry",
        "actions": [
            {"op": "starbinding.dive", "args": {"offset_radii": 6.0, "angle_deg": 0, "velocity_fraction_c": 0.2, "withdrawal_fraction": 1.0}},
            {"op": "starbinding.dive", "args": {"offset_radii": 0.0, "angle_deg": 0, "velocity_fraction_c": 0.2, "withdrawal_fraction": 0.4}},
            {"op": "starbinding.dive", "args": {"offset_radii": 0.0, "angle_deg": 0, "velocity_fraction_c": 0.2, "withdrawal_fraction": 1.0}, "checkpoint": "geometry-outcomes"},
        ],
    },
    "siege-wall-stability-fracture": {
        "title": "Siege Wall Stability / Fracture",
        "classification": "CANONICAL",
        "type": "siege-wall",
        "actions": [
            {"op": "siege.configure", "args": {"singularities": 8, "nodes": 12, "capacity_m_s2": 0.05}, "checkpoint": "stable"},
            {"op": "siege.configure", "args": {"singularities": 8, "nodes": 12, "capacity_m_s2": 0.0001}, "checkpoint": "fractured"},
        ],
    },
    "cross-station-heliocide-wall": {
        "title": "Cross-Station Heliocide → Siege Wall",
        "classification": "CANONICAL",
        "type": "cross-station",
        "actions": [
            {"op": "star.withdraw", "args": {"fraction": 1.0}, "checkpoint": "heliocide"},
            {"op": "siege.from-heliocide", "args": {"nodes": 12, "capacity_m_s2": 0.05}, "checkpoint": "wall-consequence"},
        ],
    },
}


def preset_catalog() -> list[dict[str, Any]]:
    return [
        {"id": key, "title": value["title"], "classification": value["classification"], "experiment_type": value["type"]}
        for key, value in PRESETS.items()
    ]


def compare_records(left: dict[str, Any], right: dict[str, Any]) -> dict[str, Any]:
    validate_record(left)
    validate_record(right)
    fields = [
        "experiment_type", "classification", "initial_configuration",
        "final_state_hash", "telemetry_summary", "invariants",
    ]
    differences = []
    for field in fields:
        if left.get(field) != right.get(field):
            differences.append({"field": field, "a": left.get(field), "b": right.get(field)})
    if left["actions"] != right["actions"]:
        differences.append({"field": "actions", "a": left["actions"], "b": right["actions"]})
    return {
        "compatible": left["format_version"] == right["format_version"],
        "identical": not differences,
        "differences": differences,
        "a": {"experiment_id": left["experiment_id"], "final_state_hash": left["final_state_hash"]},
        "b": {"experiment_id": right["experiment_id"], "final_state_hash": right["final_state_hash"]},
    }


class ExperimentController:
    """Coordinates real LaboratorySession actions and replay without owning physics."""

    def __init__(self, session: Any) -> None:
        self.session = session
        self.current: dict[str, Any] | None = None
        self.loaded: dict[str, Any] | None = None
        self.replay_source: dict[str, Any] | None = None
        self.replay_cursor = 0
        self.replay_paused = True
        self.replay_mismatch: dict[str, Any] | None = None
        self._recording = False
        self._actions: list[dict[str, Any]] = []
        self._events: list[dict[str, Any]] = []
        self._checkpoints: list[dict[str, Any]] = []
        self._initial: dict[str, Any] = {}
        self._ambient_actions: list[dict[str, Any]] = []
        self._ambient_events: list[dict[str, Any]] = []
        self._ambient_initial: dict[str, Any] | None = None

    def status(self) -> dict[str, Any]:
        return {
            "presets": preset_catalog(),
            "current": self.current,
            "loaded": self.loaded,
            "loaded_experiment_id": self.loaded.get("experiment_id") if self.loaded else None,
            "replay": {
                "active": self.replay_source is not None,
                "cursor": self.replay_cursor,
                "total": len(self.replay_source["actions"]) if self.replay_source else 0,
                "paused": self.replay_paused,
                "mismatch": self.replay_mismatch,
            },
        }

    def begin(self, experiment_id: str, experiment_type: str, classification: str) -> None:
        if classification not in EXPERIMENT_CLASSIFICATIONS:
            raise ValueError("invalid experiment classification")
        self._recording = True
        self._actions = []
        self._events = []
        self._checkpoints = []
        self._initial = deterministic_projection(self.session.snapshot())
        self.current = {
            "format_version": FORMAT_VERSION,
            "experiment_id": experiment_id,
            "experiment_type": experiment_type,
            "classification": classification,
        }

    def note_action(self, op: str, args: dict[str, Any], *, checkpoint: str | None = None) -> None:
        if not self._recording:
            return
        action = {"op": op, "args": deepcopy(args)}
        self._actions.append(action)
        if checkpoint:
            self._checkpoints.append({"label": checkpoint, "action_index": len(self._actions), "state_hash": snapshot_state_hash(self.session.snapshot())})

    def note_event(self, kind: str, message: str, data: dict[str, Any]) -> None:
        mutating_kind = kind in {"macro", "stellar", "planet", "starbinding", "siege_wall", "specimen"}
        prevented_macro = kind == "macro" and str(data.get("status", "")).lower() == "inert"
        target = self._events if self._recording else (self._ambient_events if self.replay_source is None else None)
        if target is None:
            return
        target.append({
            "index": len(target) + 1,
            "step_index": len(self._actions) if self._recording else len(self._ambient_actions),
            "kind": kind,
            "message": message,
            "data": deepcopy(data),
            "mutation": mutating_kind and not prevented_macro,
        })

    def finish(self) -> dict[str, Any]:
        if not self._recording or self.current is None:
            raise DrakkenLabError("no experiment is being recorded")
        snapshot = self.session.snapshot()
        state_hash = snapshot_state_hash(snapshot)
        invariants = invariant_results(snapshot, events=self._events, actions=self._actions)
        self.current = {
            **self.current,
            "initial_configuration": self._initial,
            "actions": deepcopy(self._actions),
            "events": deepcopy(self._events),
            "checkpoints": deepcopy(self._checkpoints),
            "final_state_hash": state_hash,
            "invariants": invariants,
            "telemetry_summary": {
                "event_count": len(self._events),
                "action_count": len(self._actions),
                "heliocide_events": sum(1 for e in self._events if e["kind"] == "stellar" and e["data"].get("heliocide")),
                "syrin_events": sum(1 for e in self._events if e["kind"] == "syrin"),
                "lattice_events": sum(1 for e in self._events if e["kind"] == "siege_wall"),
            },
            "metadata": {"exported_at": datetime.now(timezone.utc).isoformat(), "excluded_from_deterministic_hash": ["metadata.exported_at"]},
        }
        self._recording = False
        return validate_record(self.current)

    def record_current(self) -> dict[str, Any]:
        if self.current and self._recording:
            return self.finish()
        if self.current:
            return validate_record(self.current)
        snapshot = self.session.snapshot()
        actions = deepcopy(self._ambient_actions)
        events = deepcopy(self._ambient_events)
        initial = deepcopy(self._ambient_initial) if self._ambient_initial is not None else deterministic_projection(snapshot)
        record = {
            "format_version": FORMAT_VERSION,
            "experiment_id": "manual-session",
            "experiment_type": "manual-session",
            "classification": "EXPERIMENTAL / NON-CANON",
            "initial_configuration": initial,
            "actions": actions,
            "events": events,
            "checkpoints": [],
            "final_state_hash": snapshot_state_hash(snapshot),
            "invariants": invariant_results(snapshot, events=events, actions=actions),
            "telemetry_summary": {
                "event_count": len(events),
                "action_count": len(actions),
                "heliocide_events": sum(1 for e in events if e["kind"] == "stellar" and e["data"].get("heliocide")),
                "syrin_events": sum(1 for e in events if e["kind"] == "syrin"),
                "lattice_events": sum(1 for e in events if e["kind"] == "siege_wall"),
            },
            "metadata": {"exported_at": datetime.now(timezone.utc).isoformat(), "excluded_from_deterministic_hash": ["metadata.exported_at"]},
        }
        self.current = validate_record(record)
        return self.current

    def clear_manual_history(self) -> None:
        self._ambient_actions = []
        self._ambient_events = []
        self._ambient_initial = None
        if not self._recording:
            self.current = None

    def run_preset(self, preset_id: str) -> dict[str, Any]:
        try:
            preset = PRESETS[preset_id]
        except KeyError as exc:
            raise ValueError(f"unknown experiment preset {preset_id!r}") from exc
        self.session.reset()
        self.begin(preset_id, preset["type"], preset["classification"])
        for action in preset["actions"]:
            self.apply_action(action["op"], action.get("args", {}), record=True)
            if action.get("checkpoint"):
                self._checkpoints.append({
                    "label": action["checkpoint"],
                    "action_index": len(self._actions),
                    "state_hash": snapshot_state_hash(self.session.snapshot()),
                })
        return self.finish()

    def load(self, record: dict[str, Any]) -> dict[str, Any]:
        self.loaded = deepcopy(validate_record(record))
        return self.loaded

    def start_replay(self, record: dict[str, Any] | None = None) -> dict[str, Any]:
        source = record or self.loaded or self.current
        if source is None:
            raise DrakkenLabError("no experiment is available for replay")
        self.replay_source = deepcopy(validate_record(source))
        self.replay_cursor = 0
        self.replay_paused = True
        self.replay_mismatch = None
        self.session.reset()
        return self.status()

    def replay_step(self) -> dict[str, Any]:
        if self.replay_source is None:
            raise DrakkenLabError("replay has not been started")
        if self.replay_cursor >= len(self.replay_source["actions"]):
            return self._verify_replay()
        action = self.replay_source["actions"][self.replay_cursor]
        self.apply_action(action["op"], action.get("args", {}), record=False)
        self.replay_cursor += 1
        if self.replay_cursor >= len(self.replay_source["actions"]):
            self._verify_replay()
        return self.status()

    def replay_all(self) -> dict[str, Any]:
        if self.replay_source is None:
            self.start_replay()
        self.replay_paused = False
        assert self.replay_source is not None
        while self.replay_cursor < len(self.replay_source["actions"]) and not self.replay_paused:
            self.replay_step()
        if self.replay_cursor >= len(self.replay_source["actions"]):
            self.replay_paused = True
        return self.status()

    def pause(self) -> dict[str, Any]:
        self.replay_paused = True
        return self.status()

    def reset_replay(self) -> dict[str, Any]:
        if self.replay_source is None:
            raise DrakkenLabError("replay has not been started")
        source = deepcopy(self.replay_source)
        self.start_replay(source)
        return self.status()

    def jump(self, label: str) -> dict[str, Any]:
        if self.replay_source is None:
            raise DrakkenLabError("replay has not been started")
        checkpoint = next((c for c in self.replay_source["checkpoints"] if c["label"] == label), None)
        if checkpoint is None:
            raise ValueError(f"unknown replay checkpoint {label!r}")
        self.reset_replay()
        target = int(checkpoint["action_index"])
        while self.replay_cursor < target:
            self.replay_step()
        return self.status()

    def _verify_replay(self) -> dict[str, Any]:
        assert self.replay_source is not None
        actual = snapshot_state_hash(self.session.snapshot())
        expected = self.replay_source["final_state_hash"]
        self.replay_mismatch = None if actual == expected else {"expected": expected, "actual": actual}
        return self.status()

    def apply_action(self, op: str, args: dict[str, Any], *, record: bool) -> Any:
        operations: dict[str, Callable[..., Any]] = {
            "system.reset": self.session.reset,
            "planet.brush": self.session.apply_brush,
            "planet.step": self.session.step_planet,
            "syrin.inject": self.session.inject_syrin,
            "star.withdraw": self.session.withdraw_star,
            "macro.load": self.session.load_macro,
            "macro.step": self.session.macro_step,
            "macro.run": self.session.macro_run,
            "starbinding.dive": self.session.starbinding_dive,
            "starbinding.wave": self.session.starbinding_wave,
            "siege.configure": self.session.configure_siege_wall,
            "siege.from-heliocide": self.session.configure_siege_from_heliocide,
            "specimen.hatch": self.session.hatch_specimen,
            "specimen.pulse": self.session.pulse_specimen,
            "specimen.terminate": self.session.terminate_specimen,
        }
        try:
            fn = operations[op]
        except KeyError as exc:
            raise ValueError(f"unsupported experiment action {op!r}") from exc
        ambient = not record and not self._recording and self.replay_source is None
        if ambient and self._ambient_initial is None:
            self._ambient_initial = deterministic_projection(self.session.snapshot())
        result = fn(**args)
        if record:
            self.note_action(op, args)
        elif ambient:
            self._ambient_actions.append({"op": op, "args": deepcopy(args)})
        return result
