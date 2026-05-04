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

    var label: String {
        switch self {
        case .debug: return "DEBUG"
        case .info: return "INFO"
        case .warn: return "WARN"
        case .error: return "ERROR"
        }
    }
}

struct AppLogEntry: Identifiable, Sendable {
    let id: UUID
    let timestamp: Date
    let level: LogLevel
    let message: String
    let context: String?

    init(timestamp: Date = Date(), level: LogLevel, message: String, context: String?) {
        self.id = UUID()
        self.timestamp = timestamp
        self.level = level
        self.message = message
        self.context = context
    }
}

final class AppLogger: @unchecked Sendable {
    static let shared = AppLogger()

    var minLevel: LogLevel = .debug
    private let osLog = os.Logger(subsystem: "com.migralog.app", category: "general")

    private let bufferCapacity = 1000
    private let queue = DispatchQueue(label: "com.migralog.applogger")
    private var buffer: [AppLogEntry] = []

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

    /// Recent in-memory log entries, newest last. Bounded by `bufferCapacity`.
    func recentEntries() -> [AppLogEntry] {
        queue.sync { buffer }
    }

    /// Clears the in-memory buffer. The os.Logger sink is unaffected.
    func clearBuffer() {
        queue.sync { buffer.removeAll() }
    }

    private func log(_ level: LogLevel, message: String, context: [String: Any]?) {
        guard level >= minLevel else { return }
        let contextStr: String? = context.map { "\($0)" }
        let logMessage = "[\(level.label)] \(message)\(contextStr.map { " | " + $0 } ?? "")"

        switch level {
        case .debug: osLog.debug("\(logMessage)")
        case .info: osLog.info("\(logMessage)")
        case .warn: osLog.warning("\(logMessage)")
        case .error: osLog.error("\(logMessage)")
        }

        let entry = AppLogEntry(level: level, message: message, context: contextStr)
        queue.sync {
            buffer.append(entry)
            if buffer.count > bufferCapacity {
                buffer.removeFirst(buffer.count - bufferCapacity)
            }
        }
    }
}
