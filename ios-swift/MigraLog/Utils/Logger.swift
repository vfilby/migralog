import Foundation
import os.log

enum LogLevel: Int, Comparable {
    case debug = 0
    case info = 1
    case warn = 2
    case error = 3

    static func < (lhs: LogLevel, rhs: LogLevel) -> Bool {
        lhs.rawValue < rhs.rawValue
    }
}

final class AppLogger {
    static let shared = AppLogger()

    var minLevel: LogLevel = .debug
    private let osLog = os.Logger(subsystem: "com.migralog.app", category: "general")

    func debug(_ message: String, context: [String: Any]? = nil) {
        log(.debug, message: message, context: context)
    }

    func info(_ message: String, context: [String: Any]? = nil) {
        log(.info, message: message, context: context)
    }

    func warn(_ message: String, context: [String: Any]? = nil) {
        log(.warn, message: message, context: context)
    }

    func error(_ message: String, error: Error? = nil, context: [String: Any]? = nil) {
        var ctx = context ?? [:]
        if let error = error {
            ctx["error"] = error.localizedDescription
        }
        log(.error, message: message, context: ctx)
    }

    private func log(_ level: LogLevel, message: String, context: [String: Any]?) {
        guard level >= minLevel else { return }
        let contextStr = context.map { " | \($0)" } ?? ""
        let logMessage = "[\(level)] \(message)\(contextStr)"

        switch level {
        case .debug: osLog.debug("\(logMessage)")
        case .info: osLog.info("\(logMessage)")
        case .warn: osLog.warning("\(logMessage)")
        case .error: osLog.error("\(logMessage)")
        }
    }
}
