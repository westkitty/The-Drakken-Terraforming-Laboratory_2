"""Local-only HTTP server for the interactive laboratory workbench."""
from __future__ import annotations

from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
from threading import Timer
from typing import Any, Callable
from urllib.parse import urlparse
import webbrowser

from core.errors import DrakkenLabError
from .session import LaboratorySession
from .experiments import compare_records, validate_record


STATIC_ROOT = Path(__file__).with_name("static")
MAX_REQUEST_BYTES = 1_000_000
LAB_UI_BUILD = "1.9.0-concept-single-globe"


class LaboratoryHTTPServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, server_address: tuple[str, int], session: LaboratorySession | None = None) -> None:
        self.session = session or LaboratorySession()
        super().__init__(server_address, LaboratoryRequestHandler)


class LaboratoryRequestHandler(BaseHTTPRequestHandler):
    server: LaboratoryHTTPServer
    protocol_version = "HTTP/1.1"

    def log_message(self, format: str, *args: object) -> None:  # noqa: A003 - stdlib hook name
        return

    def do_GET(self) -> None:  # noqa: N802 - stdlib hook name
        path = urlparse(self.path).path
        if path == "/api/health":
            self._json({"ok": True, "product": "The Drakken Terraforming Laboratory", "version": "1.9.0", "ui_build": LAB_UI_BUILD})
            return
        if path == "/api/state":
            self._json(self.server.session.snapshot())
            return
        if path == "/api/export":
            payload = json.dumps(self.server.session.snapshot(), indent=2, sort_keys=True).encode("utf-8")
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Disposition", 'attachment; filename="drakken-lab-state.json"')
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(payload)
            return
        if path == "/api/experiments":
            self._json(self.server.session.experiments.status())
            return
        if path == "/api/experiment/export":
            record = self.server.session.experiments.record_current()
            payload = json.dumps(record, indent=2, sort_keys=True).encode("utf-8")
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Disposition", 'attachment; filename="drakken-experiment.json"')
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(payload)
            return
        if path == "/":
            self._static("index.html")
            return
        if path.startswith("/static/"):
            self._static(path.removeprefix("/static/"))
            return
        self._json({"error": "not found"}, status=HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:  # noqa: N802 - stdlib hook name
        path = urlparse(self.path).path
        try:
            body = self._body_json()
            routes: dict[str, Callable[[dict[str, Any]], Any]] = {
                "/api/reset": lambda _: self.server.session.experiments.apply_action("system.reset", {}, record=False),
                "/api/planet/brush": lambda data: self.server.session.experiments.apply_action("planet.brush", {
                    "tool": str(data.get("tool", "")),
                    "row": int(data.get("row", -1)),
                    "col": int(data.get("col", -1)),
                    "intensity": float(data.get("intensity", 50.0)),
                    "radius": int(data.get("radius", 3)),
                }, record=False),
                "/api/planet/step": lambda data: self.server.session.experiments.apply_action("planet.step", {
                    "seconds": float(data.get("seconds", 1.0))
                }, record=False),
                "/api/syrin/inject": lambda data: self.server.session.experiments.apply_action("syrin.inject", {
                    "contact_fraction": float(data.get("contact_fraction", 1e-12))
                }, record=False),
                "/api/star/withdraw": lambda data: self.server.session.experiments.apply_action("star.withdraw", {
                    "fraction": float(data.get("fraction", 0.1))
                }, record=False),
                "/api/macro/load": lambda data: self.server.session.experiments.apply_action("macro.load", {"source": str(data.get("source", ""))}, record=False),
                "/api/macro/step": lambda _: self.server.session.experiments.apply_action("macro.step", {}, record=False),
                "/api/macro/run": lambda _: self.server.session.experiments.apply_action("macro.run", {}, record=False),
                "/api/starbinding/dive": lambda data: self.server.session.experiments.apply_action("starbinding.dive", {
                    "offset_radii": float(data.get("offset_radii", 0.0)),
                    "angle_deg": float(data.get("angle_deg", 0.0)),
                    "velocity_fraction_c": float(data.get("velocity_fraction_c", 0.2)),
                    "withdrawal_fraction": float(data.get("withdrawal_fraction", 1.0)),
                }, record=False),
                "/api/starbinding/wave": lambda data: self.server.session.experiments.apply_action("starbinding.wave", {
                    "simulated_stars": int(data.get("simulated_stars", 16)),
                    "represented_per_star": int(data.get("represented_per_star", 250_000_000)),
                }, record=False),
                "/api/siege-wall/configure": lambda data: self.server.session.experiments.apply_action("siege.configure", {
                    "singularities": int(data.get("singularities", 8)),
                    "nodes": int(data.get("nodes", 12)),
                    "capacity_m_s2": float(data.get("capacity_m_s2", 0.05)),
                }, record=False),
                "/api/specimen/hatch": lambda data: self.server.session.experiments.apply_action("specimen.hatch", {
                    "profile_id": str(data.get("profile_id", "experimental_egg")),
                    "row": int(data.get("row", 18)),
                    "col": int(data.get("col", 36)),
                    "phenotype": (data.get("phenotype") if isinstance(data.get("phenotype"), dict) else None),
                }, record=False),
                "/api/specimen/pulse": lambda data: self.server.session.experiments.apply_action("specimen.pulse", {
                    "steps": int(data.get("steps", 1)),
                }, record=False),
                "/api/specimen/terminate": lambda _: self.server.session.experiments.apply_action("specimen.terminate", {}, record=False),
                "/api/experiment/run-preset": lambda data: self.server.session.experiments.run_preset(str(data.get("preset_id", ""))),
                "/api/experiment/record": lambda _: self.server.session.experiments.record_current(),
                "/api/experiment/import": lambda data: self.server.session.experiments.load(validate_record(data.get("experiment", {}))),
                "/api/experiment/replay/start": lambda _: self.server.session.experiments.start_replay(),
                "/api/experiment/replay/step": lambda _: self.server.session.experiments.replay_step(),
                "/api/experiment/replay/run": lambda _: self.server.session.experiments.replay_all(),
                "/api/experiment/replay/pause": lambda _: self.server.session.experiments.pause(),
                "/api/experiment/replay/reset": lambda _: self.server.session.experiments.reset_replay(),
                "/api/experiment/replay/jump": lambda data: self.server.session.experiments.jump(str(data.get("label", ""))),
                "/api/experiment/compare": lambda data: compare_records(
                    validate_record(data.get("a", {})),
                    validate_record(data.get("b", {})),
                ),
            }
            action = routes.get(path)
            if action is None:
                self._json({"error": "not found"}, status=HTTPStatus.NOT_FOUND)
                return
            self._json(action(body))
        except (ValueError, TypeError, DrakkenLabError) as exc:
            self._json(
                {"error": str(exc), "error_type": type(exc).__name__},
                status=HTTPStatus.BAD_REQUEST,
            )
        except Exception as exc:  # pragma: no cover - defensive boundary
            self._json(
                {"error": str(exc), "error_type": type(exc).__name__},
                status=HTTPStatus.INTERNAL_SERVER_ERROR,
            )

    def _body_json(self) -> dict[str, Any]:
        raw_length = self.headers.get("Content-Length", "0")
        try:
            length = int(raw_length)
        except ValueError as exc:
            raise ValueError("invalid Content-Length") from exc
        if length < 0 or length > MAX_REQUEST_BYTES:
            raise ValueError("request body exceeds laboratory limit")
        if length == 0:
            return {}
        raw = self.rfile.read(length)
        try:
            value = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError("request body must be UTF-8 JSON") from exc
        if not isinstance(value, dict):
            raise ValueError("request JSON must be an object")
        return value

    def _json(self, value: Any, *, status: HTTPStatus = HTTPStatus.OK) -> None:
        payload = json.dumps(value, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(payload)

    def _static(self, relative: str) -> None:
        candidate = (STATIC_ROOT / relative).resolve()
        root = STATIC_ROOT.resolve()
        if root not in candidate.parents and candidate != root:
            self._json({"error": "invalid static path"}, status=HTTPStatus.BAD_REQUEST)
            return
        if not candidate.is_file():
            self._json({"error": "not found"}, status=HTTPStatus.NOT_FOUND)
            return
        suffix = candidate.suffix.lower()
        content_types = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".svg": "image/svg+xml; charset=utf-8",
        }
        if relative == "index.html":
            text = candidate.read_text(encoding="utf-8")
            text = text.replace(
                '<link rel="stylesheet" href="/static/styles.css">',
                '<link rel="stylesheet" href="/static/styles.css">\n  <link rel="stylesheet" href="/static/incubator.css">\n  <link rel="stylesheet" href="/static/command-center.css">\n  <link rel="stylesheet" href="/static/state-transitions.css">\n  <link rel="stylesheet" href="/static/display-first.css">',
            )
            text = text.replace(
                '<script src="/static/app.js"></script>',
                '<script src="/static/app.js"></script>\n  <script src="/static/incubator.js"></script>\n  <script src="/static/command-center.js"></script>\n  <script src="/static/state-transitions.js"></script>\n  <script src="/static/display-first.js"></script>',
            )
            text = text.replace(
                '<div class="eyebrow">DRAKKEN SYSTEMS // LOCAL COMPUTATIONAL FACILITY</div>',
                '<div class="eyebrow">DRAKKEN SYSTEMS // LOCAL COMPUTATIONAL FACILITY // v1.9.0</div>',
            )
            payload = text.encode("utf-8")
        else:
            payload = candidate.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_types.get(suffix, "application/octet-stream"))
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'")
        self.end_headers()
        self.wfile.write(payload)


def make_server(host: str = "127.0.0.1", port: int = 8765, *, session: LaboratorySession | None = None) -> LaboratoryHTTPServer:
    return LaboratoryHTTPServer((host, port), session=session)


def launch_laboratory(*, host: str = "127.0.0.1", port: int = 8765, open_browser: bool = True) -> int:
    """Start the local workbench and serve until interrupted.

    The requested port is exact. The launcher deliberately refuses to hop to a
    different port when one is occupied because multiple simultaneous laboratory
    servers can leave an existing browser tab attached to an older build.
    """
    try:
        server = make_server(host, port)
    except OSError as exc:
        print(f"Cannot start The Drakken Terraforming Laboratory on {host}:{port}: {exc}")
        print("Refusing to start a second copy on another port; an older laboratory process may still be running.")
        print("Stop the previous dashboard process (Ctrl-C in its terminal) or choose a different --port explicitly.")
        return 2

    actual_port = int(server.server_address[1])
    url = f"http://{host}:{actual_port}/?build={LAB_UI_BUILD}"
    print(f"The Drakken Terraforming Laboratory: {url}")
    print(f"UI build: {LAB_UI_BUILD}")
    print(f"Static root: {STATIC_ROOT}")
    print("Press Ctrl-C in this terminal to stop the local laboratory server.")
    if open_browser:
        Timer(0.35, lambda: webbrowser.open(url, new=2)).start()
    try:
        server.serve_forever(poll_interval=0.2)
    except KeyboardInterrupt:
        print("\nLaboratory server stopped.")
    finally:
        server.server_close()
    return 0
