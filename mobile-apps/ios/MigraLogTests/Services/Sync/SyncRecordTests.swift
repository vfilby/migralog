import XCTest
@testable import MigraLog

final class SyncRecordTests: XCTestCase {

    // MARK: - SyncableTable contract

    func testSyncableTablesAreTheExpectedEleven() {
        let expected: Set<String> = [
            "episodes", "intensity_readings", "symptom_logs", "pain_location_logs",
            "episode_notes", "medications", "medication_schedules", "medication_doses",
            "daily_status_logs", "calendar_overlays", "category_safety_rules",
        ]
        XCTAssertEqual(Set(SyncableTable.allCases.map { $0.tableName }), expected)
        XCTAssertEqual(SyncableTable.allCases.count, 11)
    }

    func testDeviceLocalAndSyncInternalTablesAreNotSyncable() {
        for tableName in ["scheduled_notifications", "medication_reminders", "sync_config"] {
            XCTAssertNil(SyncableTable.named(tableName), "\(tableName) must not be syncable")
        }
    }

    func testOnlyMedicationSchedulesStripsADeviceLocalColumn() {
        for table in SyncableTable.allCases {
            if table == .medicationSchedules {
                XCTAssertEqual(table.deviceLocalColumns, ["notification_id"])
            } else {
                XCTAssertTrue(table.deviceLocalColumns.isEmpty, "\(table.tableName) should strip nothing")
            }
        }
    }

    func testEverySyncableTableUsesIdPrimaryKey() {
        for table in SyncableTable.allCases {
            XCTAssertEqual(table.primaryKeyColumn, "id")
        }
    }

    // MARK: - SyncRecord.recordName

    func testRecordNameComposesTableAndId() {
        let record = SyncRecord(
            tableName: "episodes", recordId: "ABC-123", payload: "{}",
            schemaVersion: 29, updatedAt: 1000, deleted: false
        )
        XCTAssertEqual(record.recordName, "episodes:ABC-123")
    }

    func testParseRecordNameRoundTrips() {
        let parsed = SyncRecord.parseRecordName("medication_doses:11111111-2222-3333")
        XCTAssertEqual(parsed?.tableName, "medication_doses")
        XCTAssertEqual(parsed?.recordId, "11111111-2222-3333")
    }

    func testParseRecordNameRejectsMalformed() {
        XCTAssertNil(SyncRecord.parseRecordName("no-colon-here"))
        XCTAssertNil(SyncRecord.parseRecordName(":missing-table"))
        XCTAssertNil(SyncRecord.parseRecordName("missing-id:"))
    }
}
