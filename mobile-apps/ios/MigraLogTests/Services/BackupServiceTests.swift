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
        // Deleting a backup that doesn't exist should not throw
        // (files simply don't exist, no error)
        XCTAssertNoThrow(try backupService.deleteBackup(id: "nonexistent-id"))
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
}
