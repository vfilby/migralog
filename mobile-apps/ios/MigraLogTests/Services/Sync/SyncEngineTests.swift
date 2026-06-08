import XCTest
import GRDB
@testable import MigraLog

final class SyncEngineTests: XCTestCase {
    var dbManager: DatabaseManager!
    var transport: InMemoryCloudKitTransport!
    var pendingStore: SyncPendingChangesStore!
    var zoneStore: SyncZoneStateStore!
    var engine: SyncEngine!

    override func setUpWithError() throws {
        dbManager = try DatabaseManager(inMemory: true)
        transport = InMemoryCloudKitTransport()
        pendingStore = SyncPendingChangesStore(dbManager: dbManager)
        zoneStore = SyncZoneStateStore(dbManager: dbManager)
        engine = SyncEngine(
            transport: transport, dbManager: dbManager,
            pendingStore: pendingStore, zoneStore: zoneStore,
            applier: RemoteChangeApplier(dbManager: dbManager)
        )
    }

    override func tearDownWithError() throws {
        engine = nil
        zoneStore = nil
        pendingStore = nil
        transport = nil
        dbManager = nil
    }

    // MARK: - Helpers

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

    private func payload(_ columns: [String: (any DatabaseValueConvertible)?]) -> String {
        (try? SyncPayloadCodec.encodePayload(row: Row(columns), table: .episodes)) ?? "{}"
    }

    private func remoteMedication(_ id: String, name: String, updatedAt: Int64) -> SyncRecord {
        SyncRecord(
            tableName: "medications", recordId: id,
            payload: payload([
                "id": id, "name": name, "type": "rescue", "dosage_amount": 1.0,
                "dosage_unit": "mg", "active": Int64(1), "created_at": Int64(1000), "updated_at": updatedAt,
            ]),
            schemaVersion: 31, updatedAt: updatedAt, deleted: false
        )
    }

    private func medicationName(_ id: String) throws -> String? {
        try dbManager.dbQueue.read { db in
            try String.fetchOne(db, sql: "SELECT name FROM medications WHERE id = ?", arguments: [id])
        }
    }

    // MARK: - Push

    func testPushUpsertSendsEncodedRow() async throws {
        try insertMedication("m1", name: "Sumatriptan", updatedAt: 1500)
        try pendingStore.enqueue(tableName: "medications", recordId: "m1", changeType: .upsert, at: 1500)

        let pushed = try await engine.push()
        XCTAssertEqual(pushed, 1)

        let record = transport.record(named: "medications:m1")
        XCTAssertNotNil(record)
        XCTAssertEqual(record?.deleted, false)
        XCTAssertEqual(record?.updatedAt, 1500)
        XCTAssertEqual(record?.payload.contains("Sumatriptan"), true)
        XCTAssertEqual(try pendingStore.pendingCount(), 0, "queue drained after push")
    }

    func testPushDeleteSendsTombstone() async throws {
        try pendingStore.enqueue(tableName: "medications", recordId: "gone", changeType: .delete, at: 2000)

        _ = try await engine.push()
        let record = transport.record(named: "medications:gone")
        XCTAssertEqual(record?.deleted, true)
        XCTAssertEqual(record?.updatedAt, 2000)
        XCTAssertEqual(try pendingStore.pendingCount(), 0)
    }

    // MARK: - Pull

    func testPullAppliesRemoteRecordAndSavesToken() async throws {
        try await transport.push([remoteMedication("m9", name: "Remote", updatedAt: 2000)])

        let applied = try await engine.pull(now: 10)
        XCTAssertEqual(applied, 1)
        XCTAssertEqual(try medicationName("m9"), "Remote")
        XCTAssertNotNil(try zoneStore.state(zoneName: SyncEngine.zoneName)?.serverChangeToken)
    }

    /// The engine must apply parent tables before children, even when the batch arrives
    /// child-first, or the child's FK insert fails.
    func testPullAppliesParentsBeforeChildren() async throws {
        let reading = SyncRecord(
            tableName: "intensity_readings", recordId: "ir1",
            payload: payload([
                "id": "ir1", "episode_id": "e1", "timestamp": Int64(1000), "intensity": 5.0,
                "created_at": Int64(1000), "updated_at": Int64(1000),
            ]),
            schemaVersion: 31, updatedAt: 1000, deleted: false
        )
        let episode = SyncRecord(
            tableName: "episodes", recordId: "e1",
            payload: payload([
                "id": "e1", "start_time": Int64(1000), "locations": "[]", "qualities": "[]",
                "symptoms": "[]", "triggers": "[]", "created_at": Int64(1000), "updated_at": Int64(1000),
            ]),
            schemaVersion: 31, updatedAt: 1000, deleted: false
        )
        // Child pushed before parent.
        try await transport.push([reading])
        try await transport.push([episode])

        let applied = try await engine.pull(now: 10)
        XCTAssertEqual(applied, 2)
        let childCount = try await dbManager.dbQueue.read { db in
            try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM intensity_readings WHERE id = 'ir1'")
        }
        XCTAssertEqual(childCount, 1, "child applied after parent, no FK error")
    }

    func testPullIsIncremental() async throws {
        try await transport.push([remoteMedication("m1", name: "X", updatedAt: 1000)])
        _ = try await engine.pull(now: 10)
        let secondApplied = try await engine.pull(now: 20)
        XCTAssertEqual(secondApplied, 0, "nothing new since the saved token")
    }

    // MARK: - Full cycle

    func testSyncEnsuresZonePushesAndPulls() async throws {
        try insertMedication("m1", name: "Local", updatedAt: 1000)
        try pendingStore.enqueue(tableName: "medications", recordId: "m1", changeType: .upsert, at: 1000)

        let result = try await engine.sync(now: 10)
        XCTAssertTrue(transport.zoneCreated)
        XCTAssertEqual(result.pushed, 1)
        XCTAssertGreaterThanOrEqual(result.applied, 1, "the pushed record echoes back and applies idempotently")
        XCTAssertEqual(try medicationName("m1"), "Local")
    }
}
