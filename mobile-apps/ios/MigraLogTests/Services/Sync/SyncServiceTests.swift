import XCTest
import GRDB
@testable import MigraLog

@MainActor
final class SyncServiceTests: XCTestCase {

    private func insertMedication(_ db: DatabaseManager, _ id: String) throws {
        try db.dbQueue.write {
            try $0.execute(
                sql: """
                    INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, created_at, updated_at)
                    VALUES (?, 'Med', 'rescue', 1, 'mg', 1000, 1000)
                    """,
                arguments: [id]
            )
        }
    }

    private func captureEnabled(_ db: DatabaseManager) throws -> Bool {
        (try db.dbQueue.read { try Int.fetchOne($0, sql: "SELECT enabled FROM sync_capture_state WHERE id = 1") }) == 1
    }

    func testEnableBacksUpBackfillsCapturesAndSyncs() async throws {
        let db = try DatabaseManager(inMemory: true)
        try insertMedication(db, "m1")
        let transport = InMemoryCloudKitTransport()
        let backup = SpyBackupService()
        let service = SyncService(dbManager: db, transport: transport, backupService: backup)

        try await service.enable()

        XCTAssertTrue(service.isEnabled)
        XCTAssertTrue(backup.createBackupCalled, "backed up before first sync")
        XCTAssertTrue(try captureEnabled(db), "capture turned on")
        XCTAssertNotNil(transport.record(named: "medications:m1"), "existing row backfilled and pushed")
        XCTAssertNotNil(service.lastSyncedAt)
        XCTAssertNil(service.lastError)
    }

    func testDisableTurnsOffCaptureAndFlag() async throws {
        let db = try DatabaseManager(inMemory: true)
        let service = SyncService(
            dbManager: db, transport: InMemoryCloudKitTransport(), backupService: SpyBackupService()
        )
        try await service.enable()

        try service.disable()

        XCTAssertFalse(service.isEnabled)
        XCTAssertFalse(try captureEnabled(db))
    }

    func testSyncIfEnabledSkipsWhenDisabled() async throws {
        let db = try DatabaseManager(inMemory: true)
        let transport = InMemoryCloudKitTransport()
        let service = SyncService(dbManager: db, transport: transport, backupService: SpyBackupService())

        await service.syncIfEnabled()

        XCTAssertFalse(transport.zoneCreated, "no sync work when disabled")
    }

    func testSyncNowRecordsFailure() async throws {
        let db = try DatabaseManager(inMemory: true)
        let transport = InMemoryCloudKitTransport()
        transport.accountIsAvailable = false
        let service = SyncService(dbManager: db, transport: transport, backupService: SpyBackupService())

        do {
            try await service.syncNow()
            XCTFail("expected sync to throw")
        } catch {
            // expected
        }
        XCTAssertNotNil(service.lastError, "failure recorded for the UI")
    }
}

private final class SpyBackupService: BackupServiceProtocol {
    private(set) var createBackupCalled = false

    func createBackup(dbManager: DatabaseManager, episodeCount: Int, medicationCount: Int) throws -> BackupMetadata {
        createBackupCalled = true
        return BackupMetadata(
            id: "test", timestamp: 0, version: "test", schemaVersion: 0,
            episodeCount: episodeCount, medicationCount: medicationCount
        )
    }

    func listBackups() throws -> [BackupMetadata] { [] }
    func deleteBackup(id: String) throws {}
    func restoreFromBackup(path: String, dbManager: DatabaseManager) throws {}
    func validateBackup(path: String) -> Bool { true }
}
