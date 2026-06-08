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
