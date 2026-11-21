import Capacitor
import Darwin
import UIKit

final class MarginBridgeViewController: CAPBridgeViewController {
    private let files = MarginFilesPlugin()

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(files)
    }
}

@objc(MarginFilesPlugin)
final class MarginFilesPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "MarginFilesPlugin"
    let jsName = "MarginFiles"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "rename", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "beginBackgroundFlush", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finishBackgroundFlush", returnType: CAPPluginReturnPromise)
    ]
    private var backgroundTask: UIBackgroundTaskIdentifier = .invalid

    @objc func beginBackgroundFlush(_ call: CAPPluginCall) {
        endBackgroundFlush()
        backgroundTask = UIApplication.shared.beginBackgroundTask(withName: "Margin study flush") { [weak self] in
            self?.endBackgroundFlush()
        }
        call.resolve()
    }

    @objc func finishBackgroundFlush(_ call: CAPPluginCall) {
        endBackgroundFlush()
        call.resolve()
    }

    private func endBackgroundFlush() {
        guard backgroundTask != .invalid else { return }
        UIApplication.shared.endBackgroundTask(backgroundTask)
        backgroundTask = .invalid
    }

    @objc func rename(_ call: CAPPluginCall) {
        guard let from = call.getString("from").flatMap(URL.init(string:)),
              let to = call.getString("to").flatMap(URL.init(string:)),
              from.isFileURL, to.isFileURL else {
            call.reject("Invalid file URL", "EINVAL")
            return
        }
        let source = from.standardizedFileURL.resolvingSymlinksInPath()
        let destination = to.standardizedFileURL.resolvingSymlinksInPath()
        let home = URL(fileURLWithPath: NSHomeDirectory()).resolvingSymlinksInPath().path
        let roots = ["Documents", "Library"].map { home + "/" + $0 + "/" }
        guard roots.contains(where: { source.path.hasPrefix($0) && destination.path.hasPrefix($0) }),
              source.deletingLastPathComponent() == destination.deletingLastPathComponent(),
              source.pathExtension == "tmp" else {
            call.reject("File replacement is not permitted", "EACCES")
            return
        }
        guard Darwin.rename(source.path, destination.path) == 0 else {
            let failure = errno
            let code: String
            switch failure {
            case ENOENT: code = "ENOENT"
            case EACCES: code = "EACCES"
            case EPERM: code = "EPERM"
            case EROFS: code = "EROFS"
            case ENOSPC: code = "ENOSPC"
            default: code = "EIO"
            }
            call.reject(String(cString: strerror(failure)), code)
            return
        }
        call.resolve()
    }
}
