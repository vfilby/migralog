import XCTest
@testable import MigraLog

/// Integration tests verifying that ErrorLogger captures errors from ViewModel
/// catch blocks and makes them available via getRecentErrors().
final class ErrorLoggerIntegrationTests: XCTestCase {
    private var errorLogger: ErrorLogger!

    override func setUp() {
        errorLogger = ErrorLogger()
    }

    override func tearDown() {
        errorLogger.clearEntries()
        errorLogger = nil
    }

    // MARK: - ViewModel Error Logging Pattern

    func testViewModelCatchBlockLogsError() {
        // Simulate the pattern used in all ViewModels:
        // catch { ErrorLogger.shared.logError(error, context: [...]) }
        let testError = NSError(
            domain: "TestDomain",
            code: 100,
            userInfo: [NSLocalizedDescriptionKey: "Database read failed"]
        )

        errorLogger.logError(testError, context: [
            "viewModel": "DashboardViewModel",
            "action": "loadData"
        ])

        let entries = errorLogger.getRecentErrors()
        XCTAssertEqual(entries.count, 1)
        XCTAssertEqual(entries[0].errorDescription, "Database read failed")
        XCTAssertEqual(entries[0].context["viewModel"], "DashboardViewModel")
        XCTAssertEqual(entries[0].context["action"], "loadData")
    }

    func testMultipleViewModelErrorsAreCaptured() {
        let dbError = NSError(domain: "GRDB", code: 1, userInfo: [
            NSLocalizedDescriptionKey: "Table not found"
        ])
        let networkError = NSError(domain: "Network", code: -1, userInfo: [
            NSLocalizedDescriptionKey: "Connection timeout"
        ])

        errorLogger.logError(dbError, context: ["viewModel": "EpisodeDetailViewModel", "action": "loadEpisode"])
        errorLogger.logError(networkError, context: ["viewModel": "MedicationDetailViewModel", "action": "logDoseNow"])

        let entries = errorLogger.getRecentErrors()
        XCTAssertEqual(entries.count, 2)
        XCTAssertEqual(entries[0].context["viewModel"], "EpisodeDetailViewModel")
        XCTAssertEqual(entries[1].context["viewModel"], "MedicationDetailViewModel")
    }

    func testErrorsAppearInGetRecentErrorsChronologically() {
        for i in 1...5 {
            errorLogger.logMessage("Error \(i)")
        }

        let entries = errorLogger.getRecentErrors()
        XCTAssertEqual(entries.count, 5)
        XCTAssertEqual(entries[0].message, "Error 1")
        XCTAssertEqual(entries[4].message, "Error 5")
    }

    func testLogErrorPreservesErrorType() {
        enum AppError: Error, LocalizedError {
            case repositoryFailure(String)

            var errorDescription: String? {
                switch self {
                case .repositoryFailure(let msg): return msg
                }
            }
        }

        let error = AppError.repositoryFailure("Failed to save episode")
        errorLogger.logError(error, context: ["viewModel": "NewEpisodeViewModel"])

        let entries = errorLogger.getRecentErrors()
        XCTAssertEqual(entries.count, 1)
        XCTAssertTrue(entries[0].message.contains("AppError"))
        XCTAssertEqual(entries[0].errorDescription, "Failed to save episode")
    }

    func testSharedInstanceAccumulatesErrors() {
        // Verify that ErrorLogger.shared works as expected for the app-wide singleton
        let shared = ErrorLogger.shared
        let initialCount = shared.getRecentErrors().count

        let error = NSError(domain: "Test", code: 1, userInfo: [
            NSLocalizedDescriptionKey: "Integration test error"
        ])
        shared.logError(error, context: ["viewModel": "TestViewModel"])

        let entries = shared.getRecentErrors()
        XCTAssertEqual(entries.count, initialCount + 1)
        XCTAssertEqual(entries.last?.context["viewModel"], "TestViewModel")

        // Clean up
        // Note: We only remove the entry we added; other tests may be running
    }

    func testServiceErrorLogging() {
        // Simulate an error from a service layer (like BackupService or ExportService)
        let backupError = NSError(domain: "BackupService", code: 500, userInfo: [
            NSLocalizedDescriptionKey: "Backup directory creation failed"
        ])

        errorLogger.logError(backupError, context: [
            "screen": "DataSettingsScreen",
            "action": "createBackup"
        ])

        let entries = errorLogger.getRecentErrors()
        XCTAssertEqual(entries.count, 1)
        XCTAssertEqual(entries[0].context["screen"], "DataSettingsScreen")
        XCTAssertEqual(entries[0].context["action"], "createBackup")
        XCTAssertEqual(entries[0].errorDescription, "Backup directory creation failed")
    }

    func testClearEntriesRemovesAllLogs() {
        errorLogger.logError(NSError(domain: "Test", code: 1), context: [:])
        errorLogger.logMessage("Some message")

        XCTAssertEqual(errorLogger.getRecentErrors().count, 2)

        errorLogger.clearEntries()

        XCTAssertEqual(errorLogger.getRecentErrors().count, 0)
    }
}
