from pathlib import Path
import plistlib


ROOT = Path(__file__).parents[1]
MACOS = ROOT / "macos"


def test_wrapper_plist_is_local_only_and_identified() -> None:
    with (MACOS / "Info.plist").open("rb") as handle:
        plist = plistlib.load(handle)

    assert plist["CFBundleIdentifier"] == "com.stinkyweasel.drakken-terraforming-laboratory"
    assert plist["CFBundleDisplayName"] == "Drakken Terraforming Laboratory"
    assert plist["CFBundleShortVersionString"] == "1.9.0"
    assert plist["LSMinimumSystemVersion"] == "13.0"

    ats = plist["NSAppTransportSecurity"]
    assert ats["NSAllowsLocalNetworking"] is True
    assert "NSAllowsArbitraryLoads" not in ats
    assert "NSAllowsArbitraryLoadsInWebContent" not in ats


def test_wrapper_uses_native_webkit_and_exact_local_backend_identity() -> None:
    source = (MACOS / "DrakkenLabWrapper.swift").read_text(encoding="utf-8")

    assert 'http://127.0.0.1:8765/' in source
    assert 'http://127.0.0.1:8765/api/health' in source
    assert 'expectedVersion = "1.9.0"' in source
    assert 'expectedUIBuild = "1.9.0-concept-single-globe"' in source
    assert 'configuration.websiteDataStore = .default()' in source
    assert 'process.arguments = [' in source
    assert '"--host", "127.0.0.1"' in source
    assert '"--port", "8765"' in source
    assert '"--no-open"' in source
    assert 'DRAKKEN_LAB_REPO' in source
    assert '".venv/bin/python"' in source


def test_wrapper_preserves_export_import_and_external_navigation_boundaries() -> None:
    source = (MACOS / "DrakkenLabWrapper.swift").read_text(encoding="utf-8")

    assert 'url.path == "/api/export"' in source
    assert 'url.path == "/api/experiment/export"' in source
    assert "runOpenPanelWith parameters: WKOpenPanelParameters" in source
    assert 'url.host == "127.0.0.1" && url.port == 8765' in source
    assert "NSWorkspace.shared.open(url)" in source
    assert "uniqueDownloadURL" in source


def test_wrapper_build_script_is_reproducible_and_keeps_build_output_untracked() -> None:
    script = (MACOS / "build_macos_wrapper.sh").read_text(encoding="utf-8")
    ignore = (ROOT / ".gitignore").read_text(encoding="utf-8")

    assert "git rev-parse --show-toplevel" in script
    assert "xcrun --sdk macosx --show-sdk-path" in script
    assert "-framework AppKit" in script
    assert "-framework WebKit" in script
    assert "--install" in script
    assert "--open" in script
    assert "previous.app" in script
    assert "codesign --force --deep --sign -" in script
    assert "codesign --verify --deep --strict" in script
    assert "macos/build/" in ignore


def test_wrapper_window_lifecycle_does_not_kill_backend_on_close() -> None:
    source = (MACOS / "DrakkenLabWrapper.swift").read_text(encoding="utf-8")

    assert "WKUIDelegate, NSWindowDelegate" in source
    assert "applicationShouldTerminateAfterLastWindowClosed" in source
    assert "return false" in source
    assert "applicationShouldHandleReopen" in source
    assert "windowShouldClose" in source
    assert "sender.orderOut(nil)" in source
    assert "window.delegate = self" in source
