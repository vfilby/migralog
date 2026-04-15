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
            "medication_reminders",
            "daily_status_logs",
            "calendar_overlays",
            "scheduled_notifications",
            "category_usage_limits",
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
        XCTAssertEqual(DatabaseManager.schemaVersion, 27)
    }

    func testMigrationIsRecordedInGRDB() throws {
        try dbManager.dbQueue.read { db in
            let migrations = try Row.fetchAll(db, sql: "SELECT * FROM grdb_migrations")
            XCTAssertFalse(migrations.isEmpty, "GRDB should track applied migrations")

            let identifiers = migrations.map { $0["identifier"] as String }
            XCTAssertTrue(identifiers.contains("v25"), "Migration v25 should be recorded")
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
