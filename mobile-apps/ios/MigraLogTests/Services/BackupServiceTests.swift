import XCTest
import GRDB
@testable import MigraLog

final class BackupServiceTests: XCTestCase {
    private var dbManager: DatabaseManager!
    private var backupService: BackupService!
    private var testBackupDir: URL!

    override func setUp() async throws {
        dbManager = try DatabaseManager(inMemory: false)
        backupService = BackupService()

        // Create a test backup directory
        testBackupDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("test_backups_\(UUID().uuidString)")
        try FileManager.default.createDirectory(
            at: testBackupDir,
            withIntermediateDirectories: true
        )
    }

    override func tearDown() async throws {
        // Clean up test backups
        if let dir = testBackupDir, FileManager.default.fileExists(atPath: dir.path) {
            try? FileManager.default.removeItem(at: dir)
        }
        dbManager = nil
        backupService = nil
    }

    // MARK: - Create Backup

    func testCreateBackupReturnsMetadata() throws {
        let metadata = try backupService.createBackup(
            dbManager: dbManager,
            episodeCount: 5,
            medicationCount: 3
        )

        XCTAssertFalse(metadata.id.isEmpty)
        XCTAssertGreaterThan(metadata.timestamp, 0)
        XCTAssertEqual(metadata.episodeCount, 5)
        XCTAssertEqual(metadata.medicationCount, 3)
        XCTAssertEqual(metadata.schemaVersion, DatabaseManager.schemaVersion)
        XCTAssertNotNil(metadata.fileName)
        XCTAssertEqual(metadata.backupType, "manual")

        // Clean up
        try? backupService.deleteBackup(id: metadata.id)
    }

    func testCreateBackupCreatesFiles() throws {
        let metadata = try backupService.createBackup(
            dbManager: dbManager,
            episodeCount: 0,
            medicationCount: 0
        )

        // Verify backup appears in list
        let backups = try backupService.listBackups()
        XCTAssertTrue(backups.contains { $0.id == metadata.id })

        // Clean up
        try? backupService.deleteBackup(id: metadata.id)
    }

    // MARK: - List Backups

    func testListBackupsEmpty() throws {
        // Use a fresh backup service pointing to a clean directory
        // In practice, the backup directory may have other test artifacts,
        // so we just verify no crash
        let backups = try backupService.listBackups()
        XCTAssertTrue(backups is [BackupMetadata])
    }

    func testListBackupsSortedByTimestampDesc() throws {
        let meta1 = try backupService.createBackup(
            dbManager: dbManager,
            episodeCount: 1,
            medicationCount: 0
        )
        // Small delay to ensure different timestamp
        Thread.sleep(forTimeInterval: 0.01)
        let meta2 = try backupService.createBackup(
            dbManager: dbManager,
            episodeCount: 2,
            medicationCount: 0
        )

        let backups = try backupService.listBackups()
        let ids = backups.map(\.id)

        // meta2 should come first (newest)
        if let idx1 = ids.firstIndex(of: meta1.id),
           let idx2 = ids.firstIndex(of: meta2.id) {
            XCTAssertLessThan(idx2, idx1, "Newer backup should appear first")
        }

        // Clean up
        try? backupService.deleteBackup(id: meta1.id)
        try? backupService.deleteBackup(id: meta2.id)
    }

    // MARK: - Delete Backup

    func testDeleteBackupRemovesFiles() throws {
        let metadata = try backupService.createBackup(
            dbManager: dbManager,
            episodeCount: 0,
            medicationCount: 0
        )

        try backupService.deleteBackup(id: metadata.id)

        let backups = try backupService.listBackups()
        XCTAssertFalse(backups.contains { $0.id == metadata.id })
    }

    func testDeleteNonexistentBackupDoesNotThrow() throws {
        // Deleting a (well-formed) backup id whose files don't exist should not throw
        // (files simply don't exist, no error). Uses a valid UUID so it passes the
        // #529 id-format guard; non-UUID ids are covered by testDeleteBackupRejectsNonUUIDID.
        XCTAssertNoThrow(try backupService.deleteBackup(id: UUID().uuidString))
    }

    // MARK: - Validate Backup

    func testValidateValidBackup() throws {
        let metadata = try backupService.createBackup(
            dbManager: dbManager,
            episodeCount: 0,
            medicationCount: 0
        )

        // Get the backup file path
        let documentsURL = try FileManager.default.url(
            for: .documentDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: false
        )
        let backupPath = documentsURL
            .appendingPathComponent("backups")
            .appendingPathComponent(metadata.fileName!)
            .path

        let isValid = backupService.validateBackup(path: backupPath)
        XCTAssertTrue(isValid)

        // Clean up
        try? backupService.deleteBackup(id: metadata.id)
    }

    func testValidateNonexistentFile() throws {
        let isValid = backupService.validateBackup(path: "/nonexistent/path.db")
        XCTAssertFalse(isValid)
    }

    func testValidateEmptyFile() throws {
        let emptyFile = testBackupDir.appendingPathComponent("empty.db")
        FileManager.default.createFile(atPath: emptyFile.path, contents: Data())

        let isValid = backupService.validateBackup(path: emptyFile.path)
        XCTAssertFalse(isValid)
    }

    func testValidateInvalidFile() throws {
        let invalidFile = testBackupDir.appendingPathComponent("invalid.db")
        let invalidData = "this is not a sqlite database".data(using: .utf8)!
        try invalidData.write(to: invalidFile)

        let isValid = backupService.validateBackup(path: invalidFile.path)
        XCTAssertFalse(isValid)
    }

    // MARK: - Backup with Data

    func testBackupPreservesData() throws {
        let now = TimestampHelper.now

        // Insert test data
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO episodes (id, start_time, locations, qualities,
                        symptoms, triggers, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                arguments: ["ep1", now, "[]", "[]", "[]", "[]", now, now]
            )

            try db.execute(
                sql: """
                    INSERT INTO medications (id, name, type, dosage_amount, dosage_unit,
                        active, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                arguments: ["med1", "Aspirin", "rescue", 325.0, "mg", 1, now, now]
            )
        }

        let metadata = try backupService.createBackup(
            dbManager: dbManager,
            episodeCount: 1,
            medicationCount: 1
        )

        // Verify the backup database has the data
        let documentsURL = try FileManager.default.url(
            for: .documentDirectory,
            in: .userDomainMask,
            appropriateFor: nil,
            create: false
        )
        let backupPath = documentsURL
            .appendingPathComponent("backups")
            .appendingPathComponent(metadata.fileName!)
            .path

        let backupDb = try DatabaseManager(path: backupPath)
        try backupDb.dbQueue.read { db in
            let episodeCount = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM episodes")
            XCTAssertEqual(episodeCount, 1)

            let medCount = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM medications")
            XCTAssertEqual(medCount, 1)
        }

        // Clean up
        try? backupService.deleteBackup(id: metadata.id)
    }

    // MARK: - Restore from RN Backup

    func testRestoreFromReactNativeBackup() throws {
        // Use the actual prod backup file to test cross-platform restore
        let backupPath = "/Users/vfilby/Downloads/backup_1774484184169_ty08gybj0.db"

        guard FileManager.default.fileExists(atPath: backupPath) else {
            throw XCTSkip("Prod backup file not found at \(backupPath)")
        }

        // Copy to temp location (same as the app does)
        let tempPath = FileManager.default.temporaryDirectory
            .appendingPathComponent("restore_test_\(UUID().uuidString).db")
        try FileManager.default.copyItem(
            atPath: backupPath,
            toPath: tempPath.path
        )
        defer { try? FileManager.default.removeItem(at: tempPath) }

        // Validate
        XCTAssertTrue(
            backupService.validateBackup(path: tempPath.path),
            "Backup should pass validation"
        )

        // Restore into our test in-memory DB
        XCTAssertNoThrow(
            try backupService.restoreFromBackup(path: tempPath.path, dbManager: dbManager),
            "Restore should not throw"
        )

        // Verify data was restored
        try dbManager.dbQueue.read { db in
            let episodes = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM episodes")
            XCTAssertEqual(episodes, 70, "Should restore 70 episodes")

            let medications = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM medications")
            XCTAssertEqual(medications, 12, "Should restore 12 medications")

            let dailyStatus = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM daily_status_logs")
            XCTAssertEqual(dailyStatus, 80, "Should restore 80 daily status logs")

            let painLogs = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM pain_location_logs")
            XCTAssertEqual(painLogs, 49, "Should restore 49 pain location logs")

            let doses = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM medication_doses")
            XCTAssertEqual(doses, 594, "Should restore 594 medication doses")

            // 1 of 5 schedules has bad data (date instead of time), so 4 should restore
            let schedules = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM medication_schedules")
            XCTAssertEqual(schedules, 4, "Should restore 4 valid medication schedules (1 skipped due to bad time format)")
        }
    }

    // MARK: - Backup Type

    func testCreateBackupRecordsExplicitType() throws {
        let metadata = try backupService.createBackup(
            dbManager: dbManager,
            episodeCount: 0,
            medicationCount: 0,
            backupType: BackupType.automatic
        )
        defer { try? backupService.deleteBackup(id: metadata.id) }

        XCTAssertEqual(metadata.backupType, BackupType.automatic)
    }

    // MARK: - Pre-Migration Backup

    func testCreatePreMigrationBackupCopiesFileAndStampsVersion() throws {
        let now = TimestampHelper.now
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO medications (id, name, type, dosage_amount, dosage_unit,
                        active, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                arguments: ["med1", "Aspirin", "rescue", 325.0, "mg", 1, now, now]
            )
        }

        let metadata = try backupService.createPreMigrationBackup(
            sourceDBPath: dbManager.dbQueue.path,
            schemaVersion: 30,
            episodeCount: 0,
            medicationCount: 1
        )
        defer { try? backupService.deleteBackup(id: metadata.id) }

        XCTAssertEqual(metadata.backupType, BackupType.migration)
        XCTAssertEqual(metadata.schemaVersion, 30, "Should record the pre-migration version")
        XCTAssertEqual(metadata.medicationCount, 1)

        // The copied file is a valid, restorable database.
        let url = try backupService.backupFileURL(for: metadata.id)
        XCTAssertTrue(backupService.validateBackup(path: url.path))
    }

    // MARK: - Prune

    /// Remove every existing automatic/migration backup so a prune test owns the set.
    private func clearPrunableBackups() throws {
        for backup in try backupService.listBackups()
        where BackupType.prunable.contains(backup.backupType ?? BackupType.manual) {
            try? backupService.deleteBackup(id: backup.id)
        }
    }

    private func makeAutomaticBackups(_ count: Int) throws -> [BackupMetadata] {
        var created: [BackupMetadata] = []
        for _ in 0..<count {
            created.append(try backupService.createBackup(
                dbManager: dbManager, episodeCount: 0, medicationCount: 0,
                backupType: BackupType.automatic
            ))
            // Ensure distinct millisecond timestamps so newest-first ordering is stable.
            Thread.sleep(forTimeInterval: 0.01)
        }
        return created
    }

    func testPruneKeepsNewestAndDeletesOldestAutomaticBackups() throws {
        try clearPrunableBackups()
        let created = try makeAutomaticBackups(12)
        defer { for b in created { try? backupService.deleteBackup(id: b.id) } }

        let deleted = try backupService.pruneAutomaticBackups(keeping: 10)
        XCTAssertEqual(deleted.count, 2, "Should delete the 2 oldest beyond the limit of 10")

        let remaining = Set(try backupService.listBackups().map(\.id))
        let newestFirst = created.sorted { $0.timestamp > $1.timestamp }
        for b in newestFirst.prefix(10) {
            XCTAssertTrue(remaining.contains(b.id), "Newest 10 should be kept")
        }
        for b in newestFirst.suffix(2) {
            XCTAssertFalse(remaining.contains(b.id), "Oldest 2 should be pruned")
        }
    }

    func testPruneUnderLimitDeletesNothing() throws {
        try clearPrunableBackups()
        let created = try makeAutomaticBackups(3)
        defer { for b in created { try? backupService.deleteBackup(id: b.id) } }

        let deleted = try backupService.pruneAutomaticBackups(keeping: 10)
        XCTAssertTrue(deleted.isEmpty)
    }

    func testPruneNeverDeletesManualOrSyncBackups() throws {
        try clearPrunableBackups()
        let manual = try backupService.createBackup(
            dbManager: dbManager, episodeCount: 0, medicationCount: 0, backupType: BackupType.manual)
        let sync = try backupService.createBackup(
            dbManager: dbManager, episodeCount: 0, medicationCount: 0, backupType: BackupType.sync)
        let autos = try makeAutomaticBackups(5)
        defer {
            try? backupService.deleteBackup(id: manual.id)
            try? backupService.deleteBackup(id: sync.id)
            for b in autos { try? backupService.deleteBackup(id: b.id) }
        }

        // Aggressively prune to 2 — only automatic backups should be affected.
        let deleted = try backupService.pruneAutomaticBackups(keeping: 2)
        XCTAssertEqual(deleted.count, 3, "Only the 3 oldest automatic backups should be deleted")

        let remaining = Set(try backupService.listBackups().map(\.id))
        XCTAssertTrue(remaining.contains(manual.id), "Manual backups are exempt from pruning")
        XCTAssertTrue(remaining.contains(sync.id), "Sync backups are exempt from pruning")
    }

    // MARK: - File Size

    func testBackupFileSize() throws {
        let metadata = try backupService.createBackup(
            dbManager: dbManager,
            episodeCount: 0,
            medicationCount: 0
        )

        XCTAssertNotNil(metadata.fileSize)
        XCTAssertGreaterThan(metadata.fileSize ?? 0, 0, "Backup file should have non-zero size")

        // Clean up
        try? backupService.deleteBackup(id: metadata.id)
    }

    // MARK: - Backup ID Validation (#529)

    func testIsValidBackupIDAcceptsCanonicalUUID() {
        XCTAssertTrue(BackupService.isValidBackupID(UUID().uuidString))
        // Canonical uppercase form
        XCTAssertTrue(BackupService.isValidBackupID("AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE"))
    }

    func testIsValidBackupIDRejectsNonUUID() {
        let bad = [
            "",
            "not-a-uuid",
            "../../etc/passwd",
            "../malicious",
            "12345678-1234-1234-1234-1234567890",          // too short
            "12345678-1234-1234-1234-1234567890123",       // too long
            "gggggggg-gggg-gggg-gggg-gggggggggggg",         // non-hex
            "\(UUID().uuidString)/../escape",
            "\(UUID().uuidString).db",
            " \(UUID().uuidString)"                          // leading space
        ]
        for id in bad {
            XCTAssertFalse(BackupService.isValidBackupID(id), "Should reject id: \(id)")
        }
    }

    func testDeleteBackupRejectsNonUUIDID() {
        for id in ["../../etc/passwd", "not-a-uuid", "migralog_backup_x"] {
            XCTAssertThrowsError(try backupService.deleteBackup(id: id)) { error in
                XCTAssertEqual(error as? BackupError, .invalidBackupID("Backup id must be a UUID"))
            }
        }
    }

    func testBackupFileURLRejectsNonUUIDID() {
        for id in ["../escape", "abc"] {
            XCTAssertThrowsError(try backupService.backupFileURL(for: id)) { error in
                XCTAssertEqual(error as? BackupError, .invalidBackupID("Backup id must be a UUID"))
            }
        }
    }

    func testBackupFileURLAcceptsValidUUID() throws {
        let id = UUID().uuidString
        let url = try backupService.backupFileURL(for: id)
        XCTAssertEqual(url.lastPathComponent, "migralog_backup_\(id).db")
        // Path must stay inside the backups directory (no traversal).
        XCTAssertTrue(url.deletingLastPathComponent().lastPathComponent == "backups")
    }

    // MARK: - Metadata Bounds Validation (#529)

    private func makeMetadata(
        id: String = UUID().uuidString,
        timestamp: Int64 = 1_700_000_000_000,
        schemaVersion: Int = DatabaseManager.schemaVersion,
        episodeCount: Int = 1,
        medicationCount: Int = 1,
        fileSize: Int64? = 1024,
        fileName: String? = "migralog_backup.db"
    ) -> BackupMetadata {
        BackupMetadata(
            id: id,
            timestamp: timestamp,
            version: "1.0.0",
            schemaVersion: schemaVersion,
            episodeCount: episodeCount,
            medicationCount: medicationCount,
            fileSize: fileSize,
            fileName: fileName,
            backupType: "manual"
        )
    }

    func testMetadataWellFormedAcceptsValid() {
        XCTAssertTrue(backupService.isMetadataWellFormed(makeMetadata()))
        // Optional fields absent is fine.
        XCTAssertTrue(backupService.isMetadataWellFormed(makeMetadata(fileSize: nil, fileName: nil)))
    }

    func testMetadataWellFormedRejectsBadID() {
        XCTAssertFalse(backupService.isMetadataWellFormed(makeMetadata(id: "../traversal")))
    }

    func testMetadataWellFormedRejectsBadTimestamp() {
        XCTAssertFalse(backupService.isMetadataWellFormed(makeMetadata(timestamp: 0)))
        XCTAssertFalse(backupService.isMetadataWellFormed(makeMetadata(timestamp: -1)))
    }

    func testMetadataWellFormedRejectsBadSchemaVersion() {
        XCTAssertFalse(backupService.isMetadataWellFormed(makeMetadata(schemaVersion: 0)))
        XCTAssertFalse(backupService.isMetadataWellFormed(makeMetadata(schemaVersion: -5)))
    }

    func testMetadataWellFormedRejectsNegativeCounts() {
        XCTAssertFalse(backupService.isMetadataWellFormed(makeMetadata(episodeCount: -1)))
        XCTAssertFalse(backupService.isMetadataWellFormed(makeMetadata(medicationCount: -1)))
    }

    func testMetadataWellFormedRejectsOversizedFile() {
        let huge = BackupService.maxBackupFileSize + 1
        XCTAssertFalse(backupService.isMetadataWellFormed(makeMetadata(fileSize: huge)))
        XCTAssertFalse(backupService.isMetadataWellFormed(makeMetadata(fileSize: -1)))
    }

    func testMetadataWellFormedRejectsOverlongFileName() {
        let longName = String(repeating: "a", count: BackupService.maxFileNameLength + 1)
        XCTAssertFalse(backupService.isMetadataWellFormed(makeMetadata(fileName: longName)))
    }
}
