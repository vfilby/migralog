import XCTest
import GRDB
@testable import MigraLog

final class SyncCaptureTriggerTests: XCTestCase {
    var dbManager: DatabaseManager!

    override func setUpWithError() throws {
        dbManager = try DatabaseManager(inMemory: true)
    }

    override func tearDownWithError() throws {
        dbManager = nil
    }

    // MARK: - Helpers

    private func enableCapture() throws {
        try dbManager.dbQueue.write { db in
            try db.execute(sql: "UPDATE sync_capture_state SET enabled = 1 WHERE id = 1")
        }
    }

    private func insertMedication(_ id: String) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, created_at, updated_at)
                    VALUES (?, 'Med', 'rescue', 1, 'mg', 1000, 1000)
                    """,
                arguments: [id]
            )
        }
    }

    private func pending() throws -> [(table: String, recordId: String, type: String)] {
        try dbManager.dbQueue.read { db in
            try Row.fetchAll(db, sql: "SELECT table_name, record_id, change_type FROM sync_pending_changes ORDER BY id")
                .map { (table: $0["table_name"], recordId: $0["record_id"], type: $0["change_type"]) }
        }
    }

    private func remoteMedicationRecord(_ id: String) throws -> SyncRecord {
        let payload = try SyncPayloadCodec.encodePayload(row: Row([
            "id": id, "name": "Remote", "type": "rescue", "dosage_amount": 1.0,
            "dosage_unit": "mg", "active": Int64(1), "created_at": Int64(1000), "updated_at": Int64(2000),
        ]), table: .episodes)
        return SyncRecord(
            tableName: "medications", recordId: id, payload: payload,
            schemaVersion: 32, updatedAt: 2000, deleted: false
        )
    }

    // MARK: - Capture

    func testCaptureIsOffByDefault() throws {
        try insertMedication("m1")
        XCTAssertEqual(try pending().count, 0, "nothing is captured until sync is enabled")
    }

    func testInsertEnqueuesUpsert() throws {
        try enableCapture()
        try insertMedication("m1")
        let queued = try pending()
        XCTAssertEqual(queued.count, 1)
        XCTAssertEqual(queued[0].table, "medications")
        XCTAssertEqual(queued[0].recordId, "m1")
        XCTAssertEqual(queued[0].type, "upsert")
    }

    func testInsertThenUpdateCollapsesToOneUpsert() throws {
        try enableCapture()
        try insertMedication("m1")
        try dbManager.dbQueue.write { db in
            try db.execute(sql: "UPDATE medications SET name = 'Renamed' WHERE id = 'm1'")
        }
        let queued = try pending()
        XCTAssertEqual(queued.count, 1, "repeated edits to a row collapse to one entry")
        XCTAssertEqual(queued[0].type, "upsert")
    }

    func testDeleteSupersedesUpsert() throws {
        try enableCapture()
        try insertMedication("m1")
        try dbManager.dbQueue.write { db in
            try db.execute(sql: "DELETE FROM medications WHERE id = 'm1'")
        }
        let queued = try pending()
        XCTAssertEqual(queued.count, 1)
        XCTAssertEqual(queued[0].type, "delete", "a delete supersedes the pending upsert")
    }

    // MARK: - Delete payload capture (#463)

    private func pendingPayload(table: String, recordId: String) throws -> String? {
        try dbManager.dbQueue.read { db in
            try String.fetchOne(
                db,
                sql: "SELECT payload FROM sync_pending_changes WHERE table_name = ? AND record_id = ?",
                arguments: [table, recordId]
            )
        }
    }

    func testDeleteCapturesRowPayload() throws {
        try enableCapture()
        try insertMedication("m1")
        try dbManager.dbQueue.write { db in
            try db.execute(sql: "DELETE FROM medications WHERE id = 'm1'")
        }

        let queued = try pending()
        XCTAssertEqual(queued.count, 1)
        XCTAssertEqual(queued[0].type, "delete")

        // The AFTER DELETE trigger snapshots the deleted row's synced columns as JSON.
        let payload = try pendingPayload(table: "medications", recordId: "m1")
        let json = try XCTUnwrap(payload, "delete tombstone must carry the captured row payload")
        let obj = try JSONSerialization.jsonObject(with: Data(json.utf8)) as? [String: Any]
        let keys = Set(try XCTUnwrap(obj).keys)

        // Captured keys must be exactly the synced columns for the table.
        XCTAssertEqual(keys, Set(SyncableTable.medications.syncedColumns))
        XCTAssertEqual(obj?["id"] as? String, "m1")
        XCTAssertEqual(obj?["name"] as? String, "Med")
    }

    func testDeletePayloadExcludesDeviceLocalColumns() throws {
        try enableCapture()
        // medication_schedules.notification_id is device-local and must not be captured.
        try insertMedication("m1")
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO medication_schedules
                        (id, medication_id, time, timezone, dosage, enabled, notification_id,
                         reminder_enabled, created_at, updated_at)
                    VALUES ('s1', 'm1', '08:00', 'America/New_York', 1.0, 1, 'notif-xyz', 1, 1000, 1000)
                    """
            )
            try db.execute(sql: "DELETE FROM medication_schedules WHERE id = 's1'")
        }

        let payload = try XCTUnwrap(try pendingPayload(table: "medication_schedules", recordId: "s1"))
        let obj = try JSONSerialization.jsonObject(with: Data(payload.utf8)) as? [String: Any]
        let keys = Set(try XCTUnwrap(obj).keys)
        XCTAssertEqual(keys, Set(SyncableTable.medicationSchedules.syncedColumns))
        XCTAssertFalse(keys.contains("notification_id"), "device-local column must not be captured")
    }

    func testUpsertHasNoPayload() throws {
        try enableCapture()
        try insertMedication("m1")
        XCTAssertNil(
            try pendingPayload(table: "medications", recordId: "m1"),
            "upserts carry no payload — the live row is re-read at push time"
        )
    }

    // MARK: - Echo suppression

    func testApplierWritesAreNotCaptured() throws {
        try enableCapture()
        let applier = RemoteChangeApplier(dbManager: dbManager)
        _ = try applier.apply(try remoteMedicationRecord("m9"), now: 10)

        XCTAssertEqual(try pending().count, 0, "the applier's own writes must not be re-enqueued")
        let name = try dbManager.dbQueue.read { db in
            try String.fetchOne(db, sql: "SELECT name FROM medications WHERE id = 'm9'")
        }
        XCTAssertEqual(name, "Remote", "but the remote change is still applied")
    }

    func testSuppressionResetsAfterApply() throws {
        try enableCapture()
        let applier = RemoteChangeApplier(dbManager: dbManager)
        _ = try applier.apply(try remoteMedicationRecord("m9"), now: 10)

        // A subsequent direct user write is captured again — suppression was reset.
        try insertMedication("m1")
        let queued = try pending()
        XCTAssertEqual(queued.count, 1)
        XCTAssertEqual(queued[0].recordId, "m1")
    }
}
