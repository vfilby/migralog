import XCTest
@testable import MigraLog

final class ErrorLoggerTests: XCTestCase {
    private var errorLogger: ErrorLogger!

    override func setUp() {
        errorLogger = ErrorLogger()
    }

    override func tearDown() {
        errorLogger.clearEntries()
        errorLogger = nil
    }

    // MARK: - Log Error

    func testLogError() {
        let error = NSError(domain: "TestDomain", code: 42, userInfo: [
            NSLocalizedDescriptionKey: "Something failed"
        ])

        errorLogger.logError(error, context: [:])

        let entries = errorLogger.getRecentErrors()
        XCTAssertEqual(entries.count, 1)
        XCTAssertEqual(entries[0].errorDescription, "Something failed")
        XCTAssertTrue(entries[0].message.contains("NSError"))
    }

    // MARK: - Log Error With Context

    func testLogErrorWithContext() {
        let error = NSError(domain: "Test", code: 1)
        let context = ["screen": "DashboardScreen", "action": "loadEpisodes"]

        errorLogger.logError(error, context: context)

        let entries = errorLogger.getRecentErrors()
        XCTAssertEqual(entries.count, 1)
        XCTAssertEqual(entries[0].context["screen"], "DashboardScreen")
        XCTAssertEqual(entries[0].context["action"], "loadEpisodes")
    }

    // MARK: - Log Message

    func testLogMessage() {
        errorLogger.logMessage("User tapped export button")

        let entries = errorLogger.getRecentErrors()
        XCTAssertEqual(entries.count, 1)
        XCTAssertEqual(entries[0].message, "User tapped export button")
        XCTAssertNil(entries[0].errorDescription)
    }

    // MARK: - Entry Properties

    func testEntryHasIdAndTimestamp() {
        errorLogger.logMessage("Test")

        let entries = errorLogger.getRecentErrors()
        XCTAssertEqual(entries.count, 1)
        XCTAssertFalse(entries[0].id.isEmpty)
        XCTAssertTrue(entries[0].timestamp.timeIntervalSince1970 > 0)
    }

    // MARK: - Multiple Entries

    func testMultipleEntries() {
        errorLogger.logMessage("First")
        errorLogger.logMessage("Second")
        errorLogger.logMessage("Third")

        let entries = errorLogger.getRecentErrors()
        XCTAssertEqual(entries.count, 3)
        XCTAssertEqual(entries[0].message, "First")
        XCTAssertEqual(entries[1].message, "Second")
        XCTAssertEqual(entries[2].message, "Third")
    }

    // MARK: - Max Entries Limit

    func testMaxEntriesLimit() {
        for i in 0..<150 {
            errorLogger.logMessage("Entry \(i)")
        }

        let entries = errorLogger.getRecentErrors()
        XCTAssertEqual(entries.count, 100, "Should cap at 100 entries")

        // Oldest entries should have been dropped
        XCTAssertEqual(entries[0].message, "Entry 50")
        XCTAssertEqual(entries[99].message, "Entry 149")
    }

    // MARK: - Clear Entries

    func testClearEntries() {
        errorLogger.logMessage("Entry 1")
        errorLogger.logMessage("Entry 2")

        XCTAssertEqual(errorLogger.getRecentErrors().count, 2)

        errorLogger.clearEntries()

        XCTAssertEqual(errorLogger.getRecentErrors().count, 0)
    }

    // MARK: - Error Log Entry

    func testErrorLogEntryDefaults() {
        let entry = ErrorLogEntry(message: "Test message")

        XCTAssertFalse(entry.id.isEmpty)
        XCTAssertEqual(entry.message, "Test message")
        XCTAssertNil(entry.errorDescription)
        XCTAssertTrue(entry.context.isEmpty)
    }

    func testErrorLogEntryWithAllFields() {
        let date = Date()
        let entry = ErrorLogEntry(
            id: "custom-id",
            timestamp: date,
            message: "Custom error",
            errorDescription: "Detailed description",
            context: ["key": "value"]
        )

        XCTAssertEqual(entry.id, "custom-id")
        XCTAssertEqual(entry.timestamp, date)
        XCTAssertEqual(entry.message, "Custom error")
        XCTAssertEqual(entry.errorDescription, "Detailed description")
        XCTAssertEqual(entry.context["key"], "value")
    }

    // MARK: - Thread Safety

    func testConcurrentAccess() {
        let expectation = self.expectation(description: "Concurrent access")
        expectation.expectedFulfillmentCount = 10

        for i in 0..<10 {
            DispatchQueue.global().async {
                self.errorLogger.logMessage("Concurrent \(i)")
                _ = self.errorLogger.getRecentErrors()
                expectation.fulfill()
            }
        }

        wait(for: [expectation], timeout: 5.0)

        let entries = errorLogger.getRecentErrors()
        XCTAssertEqual(entries.count, 10)
    }
}
