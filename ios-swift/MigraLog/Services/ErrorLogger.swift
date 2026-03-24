import Foundation
import Sentry

// MARK: - Error Log Entry

struct ErrorLogEntry: Identifiable, Sendable {
    let id: String
    let timestamp: Date
    let message: String
    let errorDescription: String?
    let context: [String: String]

    init(
        id: String = UUID().uuidString,
        timestamp: Date = Date(),
        message: String,
        errorDescription: String? = nil,
        context: [String: String] = [:]
    ) {
        self.id = id
        self.timestamp = timestamp
        self.message = message
        self.errorDescription = errorDescription
        self.context = context
    }
}

// MARK: - Protocol

protocol ErrorLoggerProtocol: Sendable {
    func logError(_ error: Error, context: [String: String])
    func logMessage(_ message: String)
    func getRecentErrors() -> [ErrorLogEntry]
}

// MARK: - Implementation

final class ErrorLogger: ErrorLoggerProtocol, @unchecked Sendable {
    static let shared = ErrorLogger()

    private let maxEntries = 100
    private let queue = DispatchQueue(label: "com.migralog.errorlogger")
    private var entries: [ErrorLogEntry] = []
    private let appLogger = AppLogger.shared

    init() {}

    // MARK: - Log Error

    func logError(_ error: Error, context: [String: String] = [:]) {
        let entry = ErrorLogEntry(
            message: "Error: \(type(of: error))",
            errorDescription: error.localizedDescription,
            context: context
        )

        appendEntry(entry)

        appLogger.error(
            entry.message,
            error: error,
            context: context.isEmpty ? nil : context.mapValues { $0 as Any }
        )

        SentrySDK.capture(error: error) { scope in
            for (key, value) in context {
                scope.setExtra(value: value, key: key)
            }
        }
    }

    // MARK: - Log Message

    func logMessage(_ message: String) {
        let entry = ErrorLogEntry(message: message)

        appendEntry(entry)

        appLogger.info(message)

        SentrySDK.capture(message: message)
    }

    // MARK: - Get Recent Errors

    func getRecentErrors() -> [ErrorLogEntry] {
        queue.sync { entries }
    }

    // MARK: - Clear (for testing)

    func clearEntries() {
        queue.sync { entries.removeAll() }
    }

    // MARK: - Private

    private func appendEntry(_ entry: ErrorLogEntry) {
        queue.sync {
            entries.append(entry)
            if entries.count > maxEntries {
                entries.removeFirst(entries.count - maxEntries)
            }
        }
    }
}
