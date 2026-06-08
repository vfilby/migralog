import XCTest
import GRDB
@testable import MigraLog

final class RemoteChangeApplierTests: XCTestCase {
    var dbManager: DatabaseManager!
    var applier: RemoteChangeApplier!

    override func setUpWithError() throws {
        dbManager = try DatabaseManager(inMemory: true)
        applier = RemoteChangeApplier(dbManager: dbManager)
    }

    override func tearDownWithError() throws {
        applier = nil
        dbManager = nil
    }

    // MARK: - Helpers

    private func makePayload(_ columns: [String: (any DatabaseValueConvertible)?]) -> String {
        (try? SyncPayloadCodec.encodePayload(row: Row(columns), table: .episodes)) ?? "{}"
    }

    private func medicationRecord(_ id: String, name: String, updatedAt: Int64, deleted: Bool = false) -> SyncRecord {
        SyncRecord(
            tableName: "medications", recordId: id,
            payload: makePayload([
                "id": id, "name": name, "type": "rescue", "dosage_amount": 1.0,
                "dosage_unit": "mg", "active": Int64(1), "created_at": Int64(1000), "updated_at": updatedAt,
            ]),
            schemaVersion: 31, updatedAt: updatedAt, deleted: deleted
        )
    }

    private func insertMedication(_ id: String, name: String, updatedAt: Int64) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, created_at, updated_at)
                    VALUES (?, ?, 'rescue', 1, 'mg', 1000, ?)
                    """,
                arguments: [id, name, updatedAt]
            )
        }
    }

    private func medicationName(_ id: String) throws -> String? {
        try dbManager.dbQueue.read { db in
            try String.fetchOne(db, sql: "SELECT name FROM medications WHERE id = ?", arguments: [id])
        }
    }

    private func enqueuePending(table: String, id: String) throws {
        try SyncPendingChangesStore(dbManager: dbManager)
            .enqueue(tableName: table, recordId: id, changeType: .upsert, at: 1)
    }

    private func conflicts() throws -> [(losingSide: String, payload: String)] {
        try dbManager.dbQueue.read { db in
            try Row.fetchAll(db, sql: "SELECT losing_side, payload FROM sync_conflicts")
                .map { (losingSide: $0["losing_side"], payload: $0["payload"]) }
        }
    }

    // MARK: - Basic apply

    func testUnknownTableIsSkipped() throws {
        let record = SyncRecord(
            tableName: "scheduled_notifications", recordId: "x", payload: "{}",
            schemaVersion: 31, updatedAt: 1, deleted: false
        )
        XCTAssertEqual(try applier.apply(record, now: 10), .skippedUnknownTable)
    }

    func testInsertsNewRecord() throws {
        let outcome = try applier.apply(medicationRecord("m1", name: "Sumatriptan", updatedAt: 2000), now: 10)
        XCTAssertEqual(outcome, .insertedNew)
        XCTAssertEqual(try medicationName("m1"), "Sumatriptan")
    }

    func testTombstoneForMissingRowIsNoop() throws {
        let record = medicationRecord("ghost", name: "x", updatedAt: 2000, deleted: true)
        XCTAssertEqual(try applier.apply(record, now: 10), .noopTombstone)
        XCTAssertNil(try medicationName("ghost"))
    }

    // MARK: - LWW + conflict archiving

    func testRemoteNewerWithoutPendingAppliesWithoutArchiving() throws {
        try insertMedication("m1", name: "Old", updatedAt: 1000)
        let outcome = try applier.apply(medicationRecord("m1", name: "New", updatedAt: 2000), now: 10)
        XCTAssertEqual(outcome, .appliedRemoteWin)
        XCTAssertEqual(try medicationName("m1"), "New")
        XCTAssertEqual(try conflicts().count, 0, "no pending local edit → not a conflict")
    }

    func testRemoteWinsWithPendingArchivesLocalLoser() throws {
        try insertMedication("m1", name: "LocalEdit", updatedAt: 1500)
        try enqueuePending(table: "medications", id: "m1")

        let outcome = try applier.apply(medicationRecord("m1", name: "RemoteWins", updatedAt: 2000), now: 99)
        XCTAssertEqual(outcome, .appliedRemoteWin)
        XCTAssertEqual(try medicationName("m1"), "RemoteWins")

        let archived = try conflicts()
        XCTAssertEqual(archived.count, 1)
        XCTAssertEqual(archived[0].losingSide, "local")
        XCTAssertTrue(archived[0].payload.contains("LocalEdit"), "the displaced local payload is preserved")
    }

    func testLocalNewerWithPendingKeepsLocalAndArchivesRemote() throws {
        try insertMedication("m1", name: "LocalWins", updatedAt: 3000)
        try enqueuePending(table: "medications", id: "m1")

        let outcome = try applier.apply(medicationRecord("m1", name: "StaleRemote", updatedAt: 2000), now: 99)
        XCTAssertEqual(outcome, .keptLocalWin)
        XCTAssertEqual(try medicationName("m1"), "LocalWins", "local is untouched")

        let archived = try conflicts()
        XCTAssertEqual(archived.count, 1)
        XCTAssertEqual(archived[0].losingSide, "remote")
        XCTAssertTrue(archived[0].payload.contains("StaleRemote"))
    }

    func testRemoteTombstoneDeletesLocalRow() throws {
        try insertMedication("m1", name: "ToDelete", updatedAt: 1000)
        let tombstone = medicationRecord("m1", name: "ToDelete", updatedAt: 2000, deleted: true)
        let outcome = try applier.apply(tombstone, now: 10)
        XCTAssertEqual(outcome, .appliedRemoteWin)
        XCTAssertNil(try medicationName("m1"), "row deleted")
    }

    // MARK: - Correctness guarantees

    /// Updating a parent must NOT delete its children. ON CONFLICT DO UPDATE updates in
    /// place; INSERT OR REPLACE would cascade-delete the readings.
    func testUpdatingParentPreservesChildren() throws {
        try dbManager.dbQueue.write { db in
            try db.execute(sql: """
                INSERT INTO episodes (id, start_time, locations, qualities, symptoms, triggers, created_at, updated_at)
                VALUES ('e1', 1000, '[]', '[]', '[]', '[]', 1000, 1000)
                """)
            try db.execute(sql: """
                INSERT INTO intensity_readings (id, episode_id, timestamp, intensity, created_at, updated_at)
                VALUES ('ir1', 'e1', 1000, 5, 1000, 1000)
                """)
        }

        let remote = SyncRecord(
            tableName: "episodes", recordId: "e1",
            payload: makePayload([
                "id": "e1", "start_time": Int64(1000), "locations": "[]", "qualities": "[]",
                "symptoms": "[]", "triggers": "[]", "notes": "updated",
                "created_at": Int64(1000), "updated_at": Int64(2000),
            ]),
            schemaVersion: 31, updatedAt: 2000, deleted: false
        )
        XCTAssertEqual(try applier.apply(remote, now: 10), .appliedRemoteWin)

        try dbManager.dbQueue.read { db in
            XCTAssertEqual(try String.fetchOne(db, sql: "SELECT notes FROM episodes WHERE id = 'e1'"), "updated")
            let childCount = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM intensity_readings WHERE id = 'ir1'")
            XCTAssertEqual(childCount, 1, "the child reading must survive a parent update")
        }
    }

    /// A device-local column (medication_schedules.notification_id) is absent from the
    /// payload and must be preserved across a remote update, not nulled.
    func testDeviceLocalColumnPreservedOnUpdate() throws {
        try dbManager.dbQueue.write { db in
            try db.execute(sql: """
                INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, created_at, updated_at)
                VALUES ('med1', 'Med', 'preventative', 1, 'mg', 1000, 1000)
                """)
            try db.execute(sql: """
                INSERT INTO medication_schedules
                    (id, medication_id, time, timezone, notification_id, created_at, updated_at)
                VALUES ('sch1', 'med1', '08:00', 'UTC', 'local-notif', 1000, 1000)
                """)
        }

        let remote = SyncRecord(
            tableName: "medication_schedules", recordId: "sch1",
            payload: makePayload([
                "id": "sch1", "medication_id": "med1", "time": "09:00", "timezone": "UTC",
                "dosage": 1.0, "enabled": Int64(1), "reminder_enabled": Int64(1),
                "created_at": Int64(1000), "updated_at": Int64(2000),
            ]),
            schemaVersion: 31, updatedAt: 2000, deleted: false
        )
        XCTAssertEqual(try applier.apply(remote, now: 10), .appliedRemoteWin)

        try dbManager.dbQueue.read { db in
            let time = try String.fetchOne(db, sql: "SELECT time FROM medication_schedules WHERE id = 'sch1'")
            XCTAssertEqual(time, "09:00")
            let notif = try String.fetchOne(
                db, sql: "SELECT notification_id FROM medication_schedules WHERE id = 'sch1'"
            )
            XCTAssertEqual(notif, "local-notif", "device-local notification_id must be preserved")
        }
    }

    /// A payload column the local schema doesn't have (newer remote schema) is dropped,
    /// not an error — basic forward-compatible migrate-on-read.
    func testUnknownPayloadColumnIsDropped() throws {
        let record = SyncRecord(
            tableName: "medications", recordId: "m1",
            payload: makePayload([
                "id": "m1", "name": "Future", "type": "rescue", "dosage_amount": 1.0,
                "dosage_unit": "mg", "created_at": Int64(1000), "updated_at": Int64(2000),
                "future_column": "ignored",
            ]),
            schemaVersion: 99, updatedAt: 2000, deleted: false
        )
        XCTAssertEqual(try applier.apply(record, now: 10), .insertedNew)
        XCTAssertEqual(try medicationName("m1"), "Future")
    }
}
