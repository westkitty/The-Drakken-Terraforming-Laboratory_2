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


STATIC_ROOT = Path(__file__).with_name("static")
MAX_REQUEST_BYTES = 1_000_000


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
            self._json({"ok": True, "product": "The Drakken Terraforming Laboratory"})
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
                "/api/reset": lambda _: self.server.session.reset(),
                "/api/planet/brush": lambda data: self.server.session.apply_brush(
                    tool=str(data.get("tool", "")),
                    row=int(data.get("row", -1)),
                    col=int(data.get("col", -1)),
                    intensity=float(data.get("intensity", 50.0)),
                    radius=int(data.get("radius", 3)),
                ),
                "/api/planet/step": lambda data: self.server.session.step_planet(
                    seconds=float(data.get("seconds", 1.0))
                ),
                "/api/syrin/inject": lambda data: self.server.session.inject_syrin(
                    contact_fraction=float(data.get("contact_fraction", 1e-12))
                ),
                "/api/star/withdraw": lambda data: self.server.session.withdraw_star(
                    fraction=float(data.get("fraction", 0.1))
                ),
                "/api/macro/load": lambda data: self.server.session.load_macro(source=str(data.get("source", ""))),
                "/api/macro/step": lambda _: self.server.session.macro_step(),
                "/api/macro/run": lambda _: self.server.session.macro_run(),
                "/api/starbinding/dive": lambda data: self.server.session.starbinding_dive(
                    offset_radii=float(data.get("offset_radii", 0.0)),
                    angle_deg=float(data.get("angle_deg", 0.0)),
                    velocity_fraction_c=float(data.get("velocity_fraction_c", 0.2)),
                    withdrawal_fraction=float(data.get("withdrawal_fraction", 1.0)),
                ),
                "/api/starbinding/wave": lambda data: self.server.session.starbinding_wave(
                    simulated_stars=int(data.get("simulated_stars", 16)),
                    represented_per_star=int(data.get("represented_per_star", 250_000_000)),
                ),
                "/api/siege-wall/configure": lambda data: self.server.session.configure_siege_wall(
                    singularities=int(data.get("singularities", 8)),
                    nodes=int(data.get("nodes", 12)),
                    capacity_m_s2=float(data.get("capacity_m_s2", 0.05)),
                ),
                "/api/specimen/hatch": lambda data: self.server.session.hatch_specimen(
                    profile_id=str(data.get("profile_id", "experimental_egg")),
                    row=int(data.get("row", 18)),
                    col=int(data.get("col", 36)),
                    phenotype=(data.get("phenotype") if isinstance(data.get("phenotype"), dict) else None),
                ),
                "/api/specimen/pulse": lambda data: self.server.session.pulse_specimen(
                    steps=int(data.get("steps", 1)),
                ),
                "/api/specimen/terminate": lambda _: self.server.session.terminate_specimen(),
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
                '<link rel="stylesheet" href="/static/styles.css">\n  <link rel="stylesheet" href="/static/incubator.css">\n  <link rel="stylesheet" href="/static/command-center.css">',
            )
            text = text.replace(
                '<script src="/static/app.js"></script>',
                '<script src="/static/app.js"></script>\n  <script src="/static/incubator.js"></script>\n  <script src="/static/command-center.js"></script>',
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

    The default bind address is loopback-only. If the requested port is occupied,
    the launcher searches the next ten ports rather than killing an unrelated
    process.
    """
    server: LaboratoryHTTPServer | None = None
    last_error: OSError | None = None
    for candidate in range(port, port + 11):
        try:
            server = make_server(host, candidate)
            break
        except OSError as exc:
            last_error = exc
    if server is None:
        assert last_error is not None
        raise last_error

    actual_port = int(server.server_address[1])
    url = f"http://{host}:{actual_port}/"
    print(f"The Drakken Terraforming Laboratory: {url}")
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
