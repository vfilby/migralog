import XCTest
@testable import MigraLog

@MainActor
final class AutoBackupServiceTests: XCTestCase {
    /// Records calls without touching the filesystem.
    private class FakeBackupService: BackupServiceProtocol {
        var createCount = 0
        var pruneCount = 0
        var lastBackupType: String?
        var lastPruneLimit: Int?

        func createBackup(
            dbManager: DatabaseManager, episodeCount: Int, medicationCount: Int, backupType: String
        ) throws -> BackupMetadata {
            createCount += 1
            lastBackupType = backupType
            return BackupMetadata(
                id: UUID().uuidString, timestamp: TimestampHelper.now, version: "t",
                schemaVersion: 1, episodeCount: episodeCount, medicationCount: medicationCount
            )
        }

        func listBackups() throws -> [BackupMetadata] { [] }
        func deleteBackup(id: String) throws {}
        func restoreFromBackup(path: String, dbManager: DatabaseManager) throws {}
        func validateBackup(path: String) -> Bool { true }

        @discardableResult
        func pruneAutomaticBackups(keeping limit: Int) throws -> [String] {
            pruneCount += 1
            lastPruneLimit = limit
            return []
        }
    }

    private var dbManager: DatabaseManager!
    private var fake: FakeBackupService!
    private var defaults: UserDefaults!
    private var suiteName: String!

    override func setUp() async throws {
        dbManager = try DatabaseManager(inMemory: false)
        fake = FakeBackupService()
        suiteName = "AutoBackupServiceTests-\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suiteName)
    }

    override func tearDown() async throws {
        if let suiteName { defaults?.removePersistentDomain(forName: suiteName) }
        dbManager = nil
        fake = nil
        defaults = nil
        suiteName = nil
    }

    private func makeService() -> AutoBackupService {
        AutoBackupService(dbManager: dbManager, backupService: fake, defaults: defaults)
    }

    func testFirstRunCreatesAutomaticBackupAndPrunes() throws {
        try XCTSkipIf(DatabaseManager.isUsingInMemoryFallback, "Shared DB is on the in-memory fallback")

        makeService().runIfDue(now: Date(timeIntervalSince1970: 1_000_000))

        XCTAssertEqual(fake.createCount, 1)
        XCTAssertEqual(fake.lastBackupType, BackupType.automatic)
        XCTAssertEqual(fake.pruneCount, 1)
        XCTAssertEqual(fake.lastPruneLimit, AutoBackupService.retentionLimit)
    }

    func testWithinIntervalIsNoOp() throws {
        try XCTSkipIf(DatabaseManager.isUsingInMemoryFallback, "Shared DB is on the in-memory fallback")

        let service = makeService()
        let start = Date(timeIntervalSince1970: 1_000_000)
        service.runIfDue(now: start)
        service.runIfDue(now: start.addingTimeInterval(AutoBackupService.interval - 60))

        XCTAssertEqual(fake.createCount, 1, "Second run within the interval should be a no-op")
    }

    func testAfterIntervalCreatesAgain() throws {
        try XCTSkipIf(DatabaseManager.isUsingInMemoryFallback, "Shared DB is on the in-memory fallback")

        let service = makeService()
        let start = Date(timeIntervalSince1970: 1_000_000)
        service.runIfDue(now: start)
        service.runIfDue(now: start.addingTimeInterval(AutoBackupService.interval + 60))

        XCTAssertEqual(fake.createCount, 2, "A run past the interval should create another backup")
    }

    func testTimestampNotStampedWhenBackupFails() throws {
        try XCTSkipIf(DatabaseManager.isUsingInMemoryFallback, "Shared DB is on the in-memory fallback")

        final class FailingBackupService: FakeBackupService {
            override func createBackup(
                dbManager: DatabaseManager, episodeCount: Int, medicationCount: Int, backupType: String
            ) throws -> BackupMetadata {
                throw BackupError.metadataWriteFailed
            }
        }
        let failing = FailingBackupService()
        let service = AutoBackupService(dbManager: dbManager, backupService: failing, defaults: defaults)
        service.runIfDue(now: Date(timeIntervalSince1970: 1_000_000))

        XCTAssertNil(defaults.object(forKey: AutoBackupService.lastRunKey),
                     "A failed backup should not stamp the last-run time, so it retries next launch")
    }
}
