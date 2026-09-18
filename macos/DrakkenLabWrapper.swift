import AppKit
import Foundation
import WebKit

private let laboratoryURL = URL(string: "http://127.0.0.1:8765/")!
private let healthURL = URL(string: "http://127.0.0.1:8765/api/health")!
private let expectedProduct = "The Drakken Terraforming Laboratory"
private let expectedVersion = "1.9.0"
private let expectedUIBuild = "1.9.0-concept-single-globe"

@main
struct DrakkenLabWrapperMain {
    private static let appDelegate = AppDelegate()

    static func main() {
        let app = NSApplication.shared
        app.delegate = appDelegate
        app.setActivationPolicy(.regular)
        app.run()
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var statusLabel: NSTextField!
    private var spinner: NSProgressIndicator!
    private var backendProcess: Process?
    private var ownsBackend = false
    private var repositoryURL: URL?

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildMenu()
        buildWindow()
        repositoryURL = locateRepository()
        startOrAttachBackend()
        NSApplication.shared.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    func applicationWillTerminate(_ notification: Notification) {
        guard ownsBackend, let backendProcess, backendProcess.isRunning else { return }
        backendProcess.terminate()
    }

    @objc private func reloadPage() {
        webView.reload()
    }

    private func buildMenu() {
        let mainMenu = NSMenu()

        let appItem = NSMenuItem()
        mainMenu.addItem(appItem)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About Drakken Terraforming Laboratory", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Hide Drakken Terraforming Laboratory", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit Drakken Terraforming Laboratory", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu

        let editItem = NSMenuItem()
        mainMenu.addItem(editItem)
        let editMenu = NSMenu(title: "Edit")
        editMenu.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        editMenu.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        editMenu.addItem(.separator())
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = editMenu

        let viewItem = NSMenuItem()
        mainMenu.addItem(viewItem)
        let viewMenu = NSMenu(title: "View")
        let reload = NSMenuItem(title: "Reload Laboratory", action: #selector(reloadPage), keyEquivalent: "r")
        reload.target = self
        viewMenu.addItem(reload)
        viewMenu.addItem(.separator())
        viewMenu.addItem(withTitle: "Enter Full Screen", action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f")
        viewItem.submenu = viewMenu

        NSApplication.shared.mainMenu = mainMenu
    }

    private func buildWindow() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.isHidden = true

        spinner = NSProgressIndicator()
        spinner.style = .spinning
        spinner.controlSize = .regular
        spinner.translatesAutoresizingMaskIntoConstraints = false
        spinner.startAnimation(nil)

        statusLabel = NSTextField(labelWithString: "Starting local laboratory…")
        statusLabel.textColor = .secondaryLabelColor
        statusLabel.font = .systemFont(ofSize: 13, weight: .medium)
        statusLabel.translatesAutoresizingMaskIntoConstraints = false

        let loadingView = NSView()
        loadingView.translatesAutoresizingMaskIntoConstraints = false
        loadingView.identifier = NSUserInterfaceItemIdentifier("loadingView")
        loadingView.addSubview(spinner)
        loadingView.addSubview(statusLabel)

        let contentView = NSView()
        contentView.addSubview(webView)
        contentView.addSubview(loadingView)

        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: contentView.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: contentView.trailingAnchor),
            webView.topAnchor.constraint(equalTo: contentView.topAnchor),
            webView.bottomAnchor.constraint(equalTo: contentView.bottomAnchor),
            loadingView.centerXAnchor.constraint(equalTo: contentView.centerXAnchor),
            loadingView.centerYAnchor.constraint(equalTo: contentView.centerYAnchor),
            spinner.centerXAnchor.constraint(equalTo: loadingView.centerXAnchor),
            spinner.topAnchor.constraint(equalTo: loadingView.topAnchor),
            statusLabel.topAnchor.constraint(equalTo: spinner.bottomAnchor, constant: 12),
            statusLabel.leadingAnchor.constraint(equalTo: loadingView.leadingAnchor),
            statusLabel.trailingAnchor.constraint(equalTo: loadingView.trailingAnchor),
            statusLabel.bottomAnchor.constraint(equalTo: loadingView.bottomAnchor)
        ])

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1440, height: 900),
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.title = expectedProduct
        window.minSize = NSSize(width: 960, height: 640)
        window.center()
        window.contentView = contentView
        window.titlebarAppearsTransparent = true
        window.makeKeyAndOrderFront(nil)
    }

    private func locateRepository() -> URL? {
        let fm = FileManager.default
        if let override = ProcessInfo.processInfo.environment["DRAKKEN_LAB_REPO"], !override.isEmpty {
            let url = URL(fileURLWithPath: override, isDirectory: true)
            if isRepository(url) { return url }
        }

        var cursor = Bundle.main.bundleURL.deletingLastPathComponent()
        for _ in 0..<8 {
            if isRepository(cursor) { return cursor }
            let parent = cursor.deletingLastPathComponent()
            if parent == cursor { break }
            cursor = parent
        }

        let home = fm.homeDirectoryForCurrentUser
        let candidates = [
            home.appendingPathComponent("The-Drakken-Terraforming-Laboratory_2", isDirectory: true),
            home.appendingPathComponent("Projects/The-Drakken-Terraforming-Laboratory_2", isDirectory: true),
            home.appendingPathComponent("GitHub/The-Drakken-Terraforming-Laboratory_2", isDirectory: true)
        ]
        return candidates.first(where: isRepository)
    }

    private func isRepository(_ url: URL) -> Bool {
        let manifest = url.appendingPathComponent("pyproject.toml")
        guard let text = try? String(contentsOf: manifest, encoding: .utf8) else { return false }
        return text.contains("drakken-terraforming-laboratory")
    }

    private func startOrAttachBackend() {
        checkHealth { [weak self] healthy in
            guard let self else { return }
            if healthy {
                self.loadLaboratory()
                return
            }
            self.launchBackend()
        }
    }

    private func launchBackend() {
        guard let repositoryURL else {
            showBlockingError(
                title: "Laboratory repository not found",
                message: "Set DRAKKEN_LAB_REPO or place The-Drakken-Terraforming-Laboratory_2 in your home, Projects, or GitHub folder."
            )
            return
        }

        let venvPython = repositoryURL.appendingPathComponent(".venv/bin/python")
        guard FileManager.default.isExecutableFile(atPath: venvPython.path) else {
            showBlockingError(
                title: "Laboratory Python environment not found",
                message: "Expected an executable at \(venvPython.path). Build the project virtual environment before launching this wrapper."
            )
            return
        }

        let logDirectory = FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent("Library/Logs/DrakkenLabWrapper", isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: logDirectory, withIntermediateDirectories: true)
        } catch {
            showBlockingError(title: "Cannot create wrapper log directory", message: error.localizedDescription)
            return
        }

        let logURL = logDirectory.appendingPathComponent("backend.log")
        FileManager.default.createFile(atPath: logURL.path, contents: nil)
        guard let logHandle = try? FileHandle(forWritingTo: logURL) else {
            showBlockingError(title: "Cannot open backend log", message: logURL.path)
            return
        }
        try? logHandle.truncate(atOffset: 0)

        let process = Process()
        process.executableURL = venvPython
        process.arguments = [
            "-m", "cli.main", "dashboard",
            "--host", "127.0.0.1",
            "--port", "8765",
            "--no-open"
        ]
        process.currentDirectoryURL = repositoryURL
        var environment = ProcessInfo.processInfo.environment
        environment["PYTHONPATH"] = repositoryURL.appendingPathComponent("src").path
        environment["PYTHONUNBUFFERED"] = "1"
        process.environment = environment
        process.standardOutput = logHandle
        process.standardError = logHandle

        process.terminationHandler = { [weak self] task in
            try? logHandle.close()
            guard let self, self.ownsBackend, task.terminationStatus != 0 else { return }
            DispatchQueue.main.async {
                self.statusLabel.stringValue = "Backend stopped. See ~/Library/Logs/DrakkenLabWrapper/backend.log"
            }
        }

        do {
            try process.run()
            backendProcess = process
            ownsBackend = true
            waitForBackend(attempt: 0)
        } catch {
            try? logHandle.close()
            showBlockingError(title: "Could not start the laboratory backend", message: error.localizedDescription)
        }
    }

    private func waitForBackend(attempt: Int) {
        guard attempt < 60 else {
            showBlockingError(
                title: "Laboratory backend did not become ready",
                message: "Check ~/Library/Logs/DrakkenLabWrapper/backend.log. Port 8765 may already be occupied."
            )
            return
        }

        checkHealth { [weak self] healthy in
            guard let self else { return }
            if healthy {
                self.loadLaboratory()
            } else {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                    self.waitForBackend(attempt: attempt + 1)
                }
            }
        }
    }

    private func checkHealth(completion: @escaping (Bool) -> Void) {
        var request = URLRequest(url: healthURL)
        request.timeoutInterval = 0.5
        URLSession.shared.dataTask(with: request) { data, response, _ in
            guard
                let http = response as? HTTPURLResponse,
                http.statusCode == 200,
                let data,
                let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                object["ok"] as? Bool == true,
                object["product"] as? String == expectedProduct,
                object["version"] as? String == expectedVersion,
                object["ui_build"] as? String == expectedUIBuild
            else {
                DispatchQueue.main.async { completion(false) }
                return
            }
            DispatchQueue.main.async { completion(true) }
        }.resume()
    }

    private func loadLaboratory() {
        spinner.stopAnimation(nil)
        statusLabel.superview?.isHidden = true
        webView.isHidden = false
        var request = URLRequest(url: laboratoryURL)
        request.cachePolicy = .reloadIgnoringLocalCacheData
        webView.load(request)
    }

    private func showBlockingError(title: String, message: String) {
        spinner.stopAnimation(nil)
        statusLabel.stringValue = message
        let alert = NSAlert()
        alert.alertStyle = .critical
        alert.messageText = title
        alert.informativeText = message
        alert.addButton(withTitle: "Quit")
        alert.beginSheetModal(for: window) { _ in
            NSApplication.shared.terminate(nil)
        }
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }

        if url.host == "127.0.0.1" && url.port == 8765 {
            decisionHandler(.allow)
            return
        }

        if ["http", "https"].contains(url.scheme?.lowercased() ?? "") {
            NSWorkspace.shared.open(url)
        }
        decisionHandler(.cancel)
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationResponse: WKNavigationResponse,
        decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void
    ) {
        guard let url = navigationResponse.response.url else {
            decisionHandler(.allow)
            return
        }

        if url.path == "/api/export" || url.path == "/api/experiment/export" {
            downloadExport(from: url, suggestedFilename: navigationResponse.response.suggestedFilename)
            decisionHandler(.cancel)
            return
        }

        decisionHandler(.allow)
    }

    private func downloadExport(from url: URL, suggestedFilename: String?) {
        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            guard let self else { return }
            guard let data, error == nil else {
                DispatchQueue.main.async {
                    self.showNonBlockingAlert(title: "Export failed", message: error?.localizedDescription ?? "No export data returned.")
                }
                return
            }

            let filename = suggestedFilename
                ?? response?.suggestedFilename
                ?? (url.path.contains("experiment") ? "drakken-experiment.json" : "drakken-lab-state.json")
            do {
                let destination = try self.uniqueDownloadURL(filename: filename)
                try data.write(to: destination, options: .atomic)
                DispatchQueue.main.async {
                    self.showNonBlockingAlert(title: "Export saved", message: destination.path)
                }
            } catch {
                DispatchQueue.main.async {
                    self.showNonBlockingAlert(title: "Export failed", message: error.localizedDescription)
                }
            }
        }.resume()
    }

    private func uniqueDownloadURL(filename: String) throws -> URL {
        let downloads = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Downloads", isDirectory: true)
        try FileManager.default.createDirectory(at: downloads, withIntermediateDirectories: true)

        let source = URL(fileURLWithPath: filename)
        let stem = source.deletingPathExtension().lastPathComponent
        let ext = source.pathExtension
        var candidate = downloads.appendingPathComponent(filename)
        var suffix = 2
        while FileManager.default.fileExists(atPath: candidate.path) {
            let next = ext.isEmpty ? "\(stem)-\(suffix)" : "\(stem)-\(suffix).\(ext)"
            candidate = downloads.appendingPathComponent(next)
            suffix += 1
        }
        return candidate
    }

    private func showNonBlockingAlert(title: String, message: String) {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = message
        alert.addButton(withTitle: "OK")
        alert.beginSheetModal(for: window)
    }

    func webView(
        _ webView: WKWebView,
        runOpenPanelWith parameters: WKOpenPanelParameters,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping ([URL]?) -> Void
    ) {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.beginSheetModal(for: window) { response in
            completionHandler(response == .OK ? panel.urls : nil)
        }
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }
}
