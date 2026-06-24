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

    /// #527: even when sync is enabled, an automatic trigger must NOT run while the
    /// database fell back to the empty in-memory DB (locked-device BFU or corruption).
    /// Pushing the fallback's state could clobber real data on other devices.
    func testSyncIfEnabledSkipsWhenUsingInMemoryFallback() async throws {
        let db = try DatabaseManager(inMemory: true)
        try insertMedication(db, "m1")
        let transport = InMemoryCloudKitTransport()
        let service = SyncService(dbManager: db, transport: transport, backupService: SpyBackupService())
        try await service.enable()
        // enable() runs a first sync; ignore its effects and re-arm the transport.
        let baseline = transport.zoneCreated

        DatabaseManager.setInMemoryFallbackForTesting(true)
        defer { DatabaseManager.setInMemoryFallbackForTesting(false) }

        // A row edit would normally trigger an automatic sync; the gate must block it.
        try await db.dbQueue.write {
            try $0.execute(sql: "UPDATE medications SET name = 'Renamed', updated_at = 2000 WHERE id = 'm1'")
        }
        await service.syncIfEnabled()

        XCTAssertTrue(service.isEnabled, "sync stays enabled — only the run is skipped")
        // Nothing new should have been pushed while on the fallback DB.
        XCTAssertEqual(transport.zoneCreated, baseline, "no sync work against the in-memory fallback")
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

    func testForceFullResyncRepushesEditWhosePendingChangeWasLost() async throws {
        let db = try DatabaseManager(inMemory: true)
        try insertMedication(db, "m1")
        let transport = InMemoryCloudKitTransport()
        let service = SyncService(dbManager: db, transport: transport, backupService: SpyBackupService())
        try await service.enable()

        // Edit the row, then drop the captured pending change — simulating an edit whose
        // push was lost, so only a full re-sync can get it to the server.
        try await db.dbQueue.write {
            try $0.execute(sql: "UPDATE medications SET name = 'Renamed', updated_at = 2000 WHERE id = 'm1'")
            try $0.execute(sql: "DELETE FROM sync_pending_changes")
        }

        let enqueued = try await service.forceFullResync()

        XCTAssertGreaterThan(enqueued, 0)
        let pushed = transport.record(named: "medications:m1")
        XCTAssertEqual(pushed?.updatedAt, 2000, "edited row re-pushed with its real LWW timestamp")
        XCTAssertTrue(pushed?.payload.contains("Renamed") == true)
    }

    func testForceFullResyncIsNoOpWhenDisabled() async throws {
        let db = try DatabaseManager(inMemory: true)
        try insertMedication(db, "m1")
        let transport = InMemoryCloudKitTransport()
        let service = SyncService(dbManager: db, transport: transport, backupService: SpyBackupService())

        let enqueued = try await service.forceFullResync()

        XCTAssertEqual(enqueued, 0)
        XCTAssertNil(transport.record(named: "medications:m1"), "nothing pushed while sync is off")
    }
}

private final class SpyBackupService: BackupServiceProtocol {
    private(set) var createBackupCalled = false
    private(set) var lastBackupType: String?

    func createBackup(
        dbManager: DatabaseManager, episodeCount: Int, medicationCount: Int, backupType: String
    ) throws -> BackupMetadata {
        createBackupCalled = true
        lastBackupType = backupType
        return BackupMetadata(
            id: "test", timestamp: 0, version: "test", schemaVersion: 0,
            episodeCount: episodeCount, medicationCount: medicationCount
        )
    }

    func listBackups() throws -> [BackupMetadata] { [] }
    func deleteBackup(id: String) throws {}
    func restoreFromBackup(path: String, dbManager: DatabaseManager) throws {}
    func validateBackup(path: String) -> Bool { true }
    @discardableResult
    func pruneAutomaticBackups(keeping limit: Int) throws -> [String] { [] }
}
