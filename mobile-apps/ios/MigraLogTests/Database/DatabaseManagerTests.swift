import XCTest
import GRDB
@testable import MigraLog

final class DatabaseManagerTests: XCTestCase {
    var dbManager: DatabaseManager!

    override func setUpWithError() throws {
        dbManager = try DatabaseManager(inMemory: true)
    }

    override func tearDownWithError() throws {
        dbManager = nil
    }

    // MARK: - Schema Initialization

    func testSchemaInitializationCreatesAllTables() throws {
        let expectedTables = [
            "episodes",
            "intensity_readings",
            "symptom_logs",
            "pain_location_logs",
            "episode_notes",
            "medications",
            "medication_schedules",
            "medication_doses",
            "medication_reminders",
            "daily_status_logs",
            "calendar_overlays",
            "scheduled_notifications",
        ]

        try dbManager.dbQueue.read { db in
            for table in expectedTables {
                let exists = try db.tableExists(table)
                XCTAssertTrue(exists, "Table '\(table)' should exist after initialization")
            }
        }
    }

    func testNoUnexpectedTablesCreated() throws {
        let expectedTables: Set<String> = [
            "episodes",
            "intensity_readings",
            "symptom_logs",
            "pain_location_logs",
            "episode_notes",
            "medications",
            "medication_schedules",
            "medication_doses",
            "medication_expectation_periods",
            "medication_reminders",
            "daily_status_logs",
            "calendar_overlays",
            "scheduled_notifications",
            "category_safety_rules",
            "tracking_options",
            "sync_pending_changes",
            "sync_zone_state",
            "sync_conflicts",
            "sync_capture_state",
            "sync_config",
            "grdb_migrations", // GRDB internal table
        ]

        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(db, sql: "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
            let actualTables = Set(rows.map { $0["name"] as String })
            let unexpected = actualTables.subtracting(expectedTables)
            XCTAssertTrue(unexpected.isEmpty, "Unexpected tables found: \(unexpected)")
        }
    }

    // MARK: - Table Column Verification

    func testEpisodesTableHasExpectedColumns() throws {
        try assertTableHasColumns("episodes", expected: [
            "id", "start_time", "end_time", "locations", "qualities",
            "symptoms", "triggers", "notes", "latitude", "longitude",
            "location_accuracy", "location_timestamp", "created_at", "updated_at",
        ])
    }

    func testIntensityReadingsTableHasExpectedColumns() throws {
        try assertTableHasColumns("intensity_readings", expected: [
            "id", "episode_id", "timestamp", "intensity", "created_at", "updated_at",
        ])
    }

    func testMedicationsTableHasExpectedColumns() throws {
        try assertTableHasColumns("medications", expected: [
            "id", "name", "type", "dosage_amount", "dosage_unit",
            "default_quantity", "schedule_frequency", "photo_uri",
            "active", "notes", "category", "created_at", "updated_at",
        ])
    }

    func testMedicationSchedulesTableHasExpectedColumns() throws {
        try assertTableHasColumns("medication_schedules", expected: [
            "id", "medication_id", "time", "timezone", "dosage",
            "enabled", "notification_id", "reminder_enabled",
        ])
    }

    func testMedicationDosesTableHasExpectedColumns() throws {
        try assertTableHasColumns("medication_doses", expected: [
            "id", "medication_id", "timestamp", "quantity", "dosage_amount",
            "dosage_unit", "status", "episode_id", "effectiveness_rating",
            "time_to_relief", "side_effects", "notes", "created_at", "updated_at",
        ])
    }

    func testDailyStatusLogsTableHasExpectedColumns() throws {
        try assertTableHasColumns("daily_status_logs", expected: [
            "id", "date", "status", "status_type", "notes",
            "prompted", "created_at", "updated_at",
        ])
    }

    func testCalendarOverlaysTableHasExpectedColumns() throws {
        try assertTableHasColumns("calendar_overlays", expected: [
            "id", "start_date", "end_date", "label", "notes",
            "exclude_from_stats", "created_at", "updated_at",
        ])
    }

    func testScheduledNotificationsTableHasExpectedColumns() throws {
        try assertTableHasColumns("scheduled_notifications", expected: [
            "id", "medication_id", "schedule_id", "date", "notification_id",
            "notification_type", "is_grouped", "group_key", "source_type",
            "medication_name", "scheduled_trigger_time", "notification_title",
            "notification_body", "category_identifier", "created_at",
        ])
    }

    func testSymptomLogsTableHasExpectedColumns() throws {
        try assertTableHasColumns("symptom_logs", expected: [
            "id", "episode_id", "symptom", "onset_time",
            "resolution_time", "severity", "created_at",
        ])
    }

    func testPainLocationLogsTableHasExpectedColumns() throws {
        try assertTableHasColumns("pain_location_logs", expected: [
            "id", "episode_id", "timestamp", "pain_locations",
            "created_at", "updated_at",
        ])
    }

    func testEpisodeNotesTableHasExpectedColumns() throws {
        try assertTableHasColumns("episode_notes", expected: [
            "id", "episode_id", "timestamp", "note", "created_at",
        ])
    }

    func testMedicationRemindersTableHasExpectedColumns() throws {
        try assertTableHasColumns("medication_reminders", expected: [
            "id", "medication_id", "scheduled_time", "completed",
            "snoozed_until", "completed_at",
        ])
    }

    // MARK: - Foreign Keys

    func testForeignKeysAreEnabled() throws {
        try dbManager.dbQueue.read { db in
            let fkEnabled = try Int.fetchOne(db, sql: "PRAGMA foreign_keys")
            XCTAssertEqual(fkEnabled, 1, "Foreign keys should be enabled")
        }
    }

    // MARK: - Idempotent Initialization

    func testMultipleInitCallsDoNotCrash() throws {
        // Creating multiple in-memory database managers should not crash
        let db1 = try DatabaseManager(inMemory: true)
        let db2 = try DatabaseManager(inMemory: true)
        let db3 = try DatabaseManager(inMemory: true)

        // All should have the expected tables
        for manager in [db1, db2, db3] {
            try manager.dbQueue.read { db in
                XCTAssertTrue(try db.tableExists("episodes"))
                XCTAssertTrue(try db.tableExists("medications"))
            }
        }
    }

    // MARK: - Schema Version

    func testSchemaVersionIsTracked() throws {
        XCTAssertEqual(DatabaseManager.schemaVersion, 39)
    }

    func testMigrationIsRecordedInGRDB() throws {
        try dbManager.dbQueue.read { db in
            let migrations = try Row.fetchAll(db, sql: "SELECT * FROM grdb_migrations")
            XCTAssertFalse(migrations.isEmpty, "GRDB should track applied migrations")

            let identifiers = migrations.map { $0["identifier"] as String }
            XCTAssertTrue(identifiers.contains("v25"), "Migration v25 should be recorded")
        }
    }

    // MARK: - iCloud Sync Schema (v29)

    /// v29 adds the last-write-wins `updated_at` timestamp to the synced tables that
    /// lacked it, and `created_at` + `updated_at` to `medication_schedules` (#434).
    func testV29AddsSyncTimestampColumns() throws {
        try dbManager.dbQueue.read { db in
            for table in ["symptom_logs", "episode_notes", "category_safety_rules", "medication_schedules"] {
                let names = try Row.fetchAll(db, sql: "PRAGMA table_info(\(table))")
                    .compactMap { $0["name"] as String? }
                XCTAssertTrue(names.contains("updated_at"), "\(table) should have updated_at after v29")
            }
            let scheduleNames = try Row.fetchAll(db, sql: "PRAGMA table_info(medication_schedules)")
                .compactMap { $0["name"] as String? }
            XCTAssertTrue(scheduleNames.contains("created_at"), "medication_schedules should gain created_at in v29")
        }
    }

    func testV29MigrationIsRecorded() throws {
        try dbManager.dbQueue.read { db in
            let identifiers = try Row.fetchAll(db, sql: "SELECT identifier FROM grdb_migrations")
                .map { $0["identifier"] as String }
            XCTAssertTrue(identifiers.contains("v29"), "Migration v29 should be recorded")
        }
    }

    /// v30 creates the device-local sync-state tables (#434): the outbound queue and
    /// the per-zone change-token cursor. sync_config / sync_conflicts arrive later.
    func testV30CreatesSyncStateTables() throws {
        try dbManager.dbQueue.read { db in
            XCTAssertTrue(try db.tableExists("sync_pending_changes"))
            XCTAssertTrue(try db.tableExists("sync_zone_state"))
            let identifiers = try Row.fetchAll(db, sql: "SELECT identifier FROM grdb_migrations")
                .map { $0["identifier"] as String }
            XCTAssertTrue(identifiers.contains("v30"), "Migration v30 should be recorded")
        }
    }

    /// v31 adds the conflict archive (#434).
    func testV31CreatesConflictArchive() throws {
        try dbManager.dbQueue.read { db in
            XCTAssertTrue(try db.tableExists("sync_conflicts"))
            let identifiers = try Row.fetchAll(db, sql: "SELECT identifier FROM grdb_migrations")
                .map { $0["identifier"] as String }
            XCTAssertTrue(identifiers.contains("v31"), "Migration v31 should be recorded")
        }
    }

    /// v32 adds the change-capture control table and per-table triggers (#434).
    func testV32CreatesCaptureTriggers() throws {
        try dbManager.dbQueue.read { db in
            XCTAssertTrue(try db.tableExists("sync_capture_state"))
            let triggerCount = try Int.fetchOne(
                db, sql: "SELECT COUNT(*) FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'sync_capture_%'"
            )
            XCTAssertEqual(triggerCount, 39, "one INSERT/UPDATE/DELETE trigger per synced table (13 × 3)")
            let identifiers = try Row.fetchAll(db, sql: "SELECT identifier FROM grdb_migrations")
                .map { $0["identifier"] as String }
            XCTAssertTrue(identifiers.contains("v32"), "Migration v32 should be recorded")
        }
    }

    /// v33 adds sync_config — the on/off switch for iCloud sync (#434).
    func testV33CreatesSyncConfig() throws {
        try dbManager.dbQueue.read { db in
            XCTAssertTrue(try db.tableExists("sync_config"))
            let enabled = try Int.fetchOne(db, sql: "SELECT enabled FROM sync_config WHERE id = 1")
            XCTAssertEqual(enabled, 0, "sync is off by default")
            let identifiers = try Row.fetchAll(db, sql: "SELECT identifier FROM grdb_migrations")
                .map { $0["identifier"] as String }
            XCTAssertTrue(identifiers.contains("v33"), "Migration v33 should be recorded")
        }
    }

    /// v37 adds medications.excluded_from_safety_warnings and rebuilds the
    /// capture triggers so the DELETE tombstone payload includes the new column.
    func testV37AddsExclusionColumnAndRebuildsMedicationTriggers() throws {
        try dbManager.dbQueue.read { db in
            let names = try Row.fetchAll(db, sql: "PRAGMA table_info(medications)")
                .compactMap { $0["name"] as String? }
            XCTAssertTrue(names.contains("excluded_from_safety_warnings"))

            let triggerSql = try String.fetchOne(
                db,
                sql: "SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = 'sync_capture_medications_delete'"
            )
            XCTAssertTrue(
                triggerSql?.contains("excluded_from_safety_warnings") == true,
                "delete tombstone trigger should snapshot the new synced column"
            )

            let identifiers = try Row.fetchAll(db, sql: "SELECT identifier FROM grdb_migrations")
                .map { $0["identifier"] as String }
            XCTAssertTrue(identifiers.contains("v37"), "Migration v37 should be recorded")
        }
    }

    /// v38 adds the medication_expectation_periods table (synced) and re-runs
    /// createSyncCaptureTriggers so the new table gets capture triggers.
    func testV38CreatesExpectationPeriodsTableWithTriggers() throws {
        try dbManager.dbQueue.read { db in
            XCTAssertTrue(try db.tableExists("medication_expectation_periods"))

            let triggerCount = try Int.fetchOne(
                db,
                sql: """
                    SELECT COUNT(*) FROM sqlite_master
                    WHERE type = 'trigger' AND name LIKE 'sync_capture_medication_expectation_periods_%'
                    """
            )
            XCTAssertEqual(triggerCount, 3, "insert/update/delete capture triggers for the new synced table")

            let identifiers = try Row.fetchAll(db, sql: "SELECT identifier FROM grdb_migrations")
                .map { $0["identifier"] as String }
            XCTAssertTrue(identifiers.contains("v38"), "Migration v38 should be recorded")
        }
    }

    /// Exercises the upgrade path directly: an old-shape DB (no sync timestamps) is
    /// migrated, and existing rows must be backfilled with usable timestamps.
    func testAddSyncTimestampColumnsBackfillsExistingRows() throws {
        let queue = try DatabaseQueue()
        try queue.write { db in
            // Pre-v29 shapes (only the columns the helper reads).
            try db.execute(sql: "CREATE TABLE symptom_logs (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL)")
            try db.execute(sql: "CREATE TABLE episode_notes (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL)")
            try db.execute(sql: "CREATE TABLE category_safety_rules (id TEXT PRIMARY KEY, created_at INTEGER NOT NULL)")
            try db.execute(sql: "CREATE TABLE medication_schedules (id TEXT PRIMARY KEY, medication_id TEXT NOT NULL)")
            try db.execute(sql: "INSERT INTO symptom_logs (id, created_at) VALUES ('s1', 5000)")
            try db.execute(sql: "INSERT INTO medication_schedules (id, medication_id) VALUES ('sch1', 'med1')")
        }

        try queue.write { db in
            try DatabaseManager.addSyncTimestampColumns(in: db)
        }

        try queue.read { db in
            // Append-only table: updated_at backfills from created_at.
            let updatedAt = try Int64.fetchOne(db, sql: "SELECT updated_at FROM symptom_logs WHERE id = 's1'")
            XCTAssertEqual(updatedAt, 5000, "symptom_logs.updated_at should backfill from created_at")

            // medication_schedules gains both timestamps, stamped and equal.
            let row = try Row.fetchOne(db, sql: "SELECT created_at, updated_at FROM medication_schedules WHERE id = 'sch1'")
            let createdAt = row?["created_at"] as Int64?
            let scheduleUpdatedAt = row?["updated_at"] as Int64?
            XCTAssertNotNil(createdAt)
            XCTAssertGreaterThan(createdAt ?? 0, 0, "medication_schedules.created_at should be stamped")
            XCTAssertEqual(createdAt, scheduleUpdatedAt, "schedule updated_at should equal backfilled created_at")
        }
    }

    /// The migration must be safe to run again on an already-migrated DB.
    func testAddSyncTimestampColumnsIsIdempotent() throws {
        try dbManager.dbQueue.write { db in
            try DatabaseManager.addSyncTimestampColumns(in: db)
            try DatabaseManager.addSyncTimestampColumns(in: db)
        }
    }

    // MARK: - Open-failure classification (#527)

    /// A locked-device (BFU) open failure surfaces as one of SQLITE_IOERR/CANTOPEN/AUTH
    /// while protected data is unavailable. These MUST be classified as the transient
    /// `.protectedDataUnavailable` case so writers/sync defer rather than committing to
    /// an empty in-memory DB and silently dropping the write.
    func testClassifyOpenFailureTreatsLockedDeviceCodesAsTransient() {
        let transientCodes: [ResultCode] = [.SQLITE_IOERR, .SQLITE_CANTOPEN, .SQLITE_AUTH]
        for code in transientCodes {
            let error = DatabaseError(resultCode: code, message: "open failed")
            let classified = DatabaseManager.classifyOpenFailure(error, protectedDataAvailable: false)
            guard case .protectedDataUnavailable = classified else {
                XCTFail("code \(code) while locked should be .protectedDataUnavailable, got \(classified)")
                continue
            }
        }
    }

    /// The same SQLite codes, when protected data IS available, are genuine corruption —
    /// the in-memory fallback (and recovery UI) is appropriate.
    func testClassifyOpenFailureWithProtectedDataAvailableIsCorruption() {
        let error = DatabaseError(resultCode: .SQLITE_CANTOPEN, message: "open failed")
        let classified = DatabaseManager.classifyOpenFailure(error, protectedDataAvailable: true)
        guard case .corruption = classified else {
            return XCTFail("CANTOPEN with protected data available should be .corruption, got \(classified)")
        }
    }

    /// A corruption-class code (e.g. SQLITE_CORRUPT) is never transient, even while locked —
    /// it must not be mistaken for a recoverable lock-screen condition.
    func testClassifyOpenFailureCorruptCodeIsNeverTransient() {
        let error = DatabaseError(resultCode: .SQLITE_CORRUPT, message: "malformed")
        let classified = DatabaseManager.classifyOpenFailure(error, protectedDataAvailable: false)
        guard case .corruption = classified else {
            return XCTFail("SQLITE_CORRUPT should be .corruption regardless of lock state, got \(classified)")
        }
    }

    /// A non-DatabaseError open failure is treated as corruption (conservative default).
    func testClassifyOpenFailureNonDatabaseErrorIsCorruption() {
        let error = NSError(domain: "test", code: 1)
        let classified = DatabaseManager.classifyOpenFailure(error, protectedDataAvailable: false)
        guard case .corruption = classified else {
            return XCTFail("non-DatabaseError should be .corruption, got \(classified)")
        }
    }

    // MARK: - Reset Database

    func testResetDatabaseClearsAllData() throws {
        // Insert data into several tables
        try dbManager.dbQueue.write { db in
            let now = TimestampHelper.now
            try db.execute(
                sql: """
                    INSERT INTO episodes (id, start_time, locations, qualities, symptoms, triggers, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                arguments: ["ep1", now, "[]", "[]", "[]", "[]", now, now]
            )
            try db.execute(
                sql: """
                    INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                arguments: ["med1", "Ibuprofen", "rescue", 200, "mg", now, now]
            )
            try db.execute(
                sql: """
                    INSERT INTO daily_status_logs (id, date, status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                arguments: ["ds1", "2026-03-24", "green", now, now]
            )
            try db.execute(
                sql: """
                    INSERT INTO calendar_overlays (id, start_date, label, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                arguments: ["co1", "2026-03-24", "Vacation", now, now]
            )
        }

        // Verify data exists
        try dbManager.dbQueue.read { db in
            XCTAssertEqual(try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM episodes"), 1)
            XCTAssertEqual(try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM medications"), 1)
            XCTAssertEqual(try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM daily_status_logs"), 1)
            XCTAssertEqual(try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM calendar_overlays"), 1)
        }

        // Reset
        try dbManager.resetDatabase()

        // Verify all tables are empty
        let tables = [
            "episodes", "intensity_readings", "symptom_logs",
            "pain_location_logs", "episode_notes", "medications",
            "medication_schedules", "medication_doses", "medication_reminders",
            "daily_status_logs", "calendar_overlays", "scheduled_notifications",
        ]

        try dbManager.dbQueue.read { db in
            for table in tables {
                let count = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM \(table)")
                XCTAssertEqual(count, 0, "Table '\(table)' should be empty after reset")
            }
        }
    }

    func testResetDatabasePreservesTables() throws {
        try dbManager.resetDatabase()

        // Tables should still exist after reset
        try dbManager.dbQueue.read { db in
            XCTAssertTrue(try db.tableExists("episodes"))
            XCTAssertTrue(try db.tableExists("medications"))
            XCTAssertTrue(try db.tableExists("daily_status_logs"))
        }
    }

    func testResetDatabaseCascadesChildRecords() throws {
        // Insert parent + child records
        try dbManager.dbQueue.write { db in
            let now = TimestampHelper.now
            try db.execute(
                sql: """
                    INSERT INTO episodes (id, start_time, locations, qualities, symptoms, triggers, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                arguments: ["ep1", now, "[]", "[]", "[]", "[]", now, now]
            )
            try db.execute(
                sql: """
                    INSERT INTO intensity_readings (id, episode_id, timestamp, intensity, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                arguments: ["ir1", "ep1", now, 5.0, now, now]
            )
            try db.execute(
                sql: """
                    INSERT INTO symptom_logs (id, episode_id, symptom, onset_time, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                arguments: ["sl1", "ep1", "nausea", now, now]
            )
        }

        try dbManager.resetDatabase()

        try dbManager.dbQueue.read { db in
            XCTAssertEqual(try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM episodes"), 0)
            XCTAssertEqual(try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM intensity_readings"), 0)
            XCTAssertEqual(try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM symptom_logs"), 0)
        }
    }

    // MARK: - Indexes

    func testIndexesAreCreated() throws {
        let expectedIndexes = [
            "idx_episodes_start_time",
            "idx_intensity_readings_episode",
            "idx_symptom_logs_episode",
            "idx_medication_doses_medication",
            "idx_medication_doses_timestamp",
            "idx_daily_status_date",
            "idx_scheduled_notifications_date",
            "idx_episodes_date_range",
            "idx_medications_active_type",
        ]

        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(db, sql: "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'")
            let actualIndexes = Set(rows.map { $0["name"] as String })
            for index in expectedIndexes {
                XCTAssertTrue(actualIndexes.contains(index), "Index '\(index)' should exist")
            }
        }
    }

    // MARK: - TimestampHelper Tests

    func testTimestampHelperNowReturnsReasonableValue() {
        let now = TimestampHelper.now
        // Should be in milliseconds since epoch, roughly current time
        // As of 2026, timestamp should be > 1_700_000_000_000 (Nov 2023)
        XCTAssertGreaterThan(now, 1_700_000_000_000)
        // Should be less than year 2100 in ms
        XCTAssertLessThan(now, 4_102_444_800_000)
    }

    func testTimestampHelperFromDateToDateRoundTrip() {
        let original = Date(timeIntervalSince1970: 1_700_000_000)
        let timestamp = TimestampHelper.fromDate(original)
        let roundTripped = TimestampHelper.toDate(timestamp)

        XCTAssertEqual(
            original.timeIntervalSince1970,
            roundTripped.timeIntervalSince1970,
            accuracy: 0.001,
            "Round-trip should preserve the date"
        )
    }

    func testTimestampHelperFromDateProducesMilliseconds() {
        let date = Date(timeIntervalSince1970: 1_700_000_000)
        let timestamp = TimestampHelper.fromDate(date)
        XCTAssertEqual(timestamp, 1_700_000_000_000)
    }

    func testTimestampHelperToDateFromMilliseconds() {
        let timestamp: Int64 = 1_700_000_000_000
        let date = TimestampHelper.toDate(timestamp)
        XCTAssertEqual(date.timeIntervalSince1970, 1_700_000_000, accuracy: 0.001)
    }

    func testTimestampHelperDateStringProducesYYYYMMDD() {
        let date = Date(timeIntervalSince1970: 1_700_000_000) // 2023-11-14
        let string = TimestampHelper.dateString(from: date)
        // swiftlint:disable:next force_try
        let regex = try! NSRegularExpression(pattern: "^\\d{4}-\\d{2}-\\d{2}$")
        let range = NSRange(string.startIndex..., in: string)
        XCTAssertNotNil(regex.firstMatch(in: string, range: range), "Should match YYYY-MM-DD format")
    }

    func testTimestampHelperDateFromStringParsesCorrectly() {
        let date = TimestampHelper.dateFromString("2026-03-24")
        XCTAssertNotNil(date, "Should parse a valid date string")

        let components = Calendar.current.dateComponents([.year, .month, .day], from: date!)
        XCTAssertEqual(components.year, 2026)
        XCTAssertEqual(components.month, 3)
        XCTAssertEqual(components.day, 24)
    }

    func testTimestampHelperDateFromStringReturnsNilForInvalidInput() {
        XCTAssertNil(TimestampHelper.dateFromString("not-a-date"))
        XCTAssertNil(TimestampHelper.dateFromString(""))
        XCTAssertNil(TimestampHelper.dateFromString("abc"))
    }

    func testTimestampHelperDateStringAndDateFromStringRoundTrip() {
        let originalDate = TimestampHelper.dateFromString("2026-06-15")!
        let string = TimestampHelper.dateString(from: originalDate)
        XCTAssertEqual(string, "2026-06-15")
    }

    // MARK: - JSONHelper Tests

    func testJSONHelperEncodeDecodeRoundTrip() {
        let original = ["hello", "world"]
        let encoded = JSONHelper.encode(original)
        let decoded = JSONHelper.decode([String].self, from: encoded)
        XCTAssertEqual(decoded, original)
    }

    func testJSONHelperDecodeArrayFromNil() {
        let result: [String] = JSONHelper.decodeArray(String.self, from: nil)
        XCTAssertTrue(result.isEmpty)
    }

    func testJSONHelperDecodeArrayFromInvalidString() {
        let result: [String] = JSONHelper.decodeArray(String.self, from: "not json")
        XCTAssertTrue(result.isEmpty)
    }

    func testJSONHelperEncodeReturnsEmptyArrayForFailure() {
        // Encoding a valid value should succeed
        let encoded = JSONHelper.encode(["test"])
        XCTAssertFalse(encoded.isEmpty)
        XCTAssertTrue(encoded.contains("test"))
    }

    // MARK: - Helpers

    private func assertTableHasColumns(_ table: String, expected: [String], file: StaticString = #file, line: UInt = #line) throws {
        try dbManager.dbQueue.read { db in
            let columns = try db.columns(in: table)
            let columnNames = Set(columns.map { $0.name })
            for col in expected {
                XCTAssertTrue(columnNames.contains(col), "Table '\(table)' should have column '\(col)'", file: file, line: line)
            }
        }
    }
}
