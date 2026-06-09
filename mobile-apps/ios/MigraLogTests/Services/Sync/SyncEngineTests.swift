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

    func testPushDeleteCarriesCapturedPayload() async throws {
        // The AFTER DELETE trigger captures the deleted row's synced columns as JSON into
        // sync_pending_changes.payload (#463). buildRecord must put that payload on the
        // tombstone for recoverability, instead of an empty `{}`.
        let captured = #"{"id":"gone","name":"Removed Med","type":"rescue"}"#
        try await dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO sync_pending_changes
                        (table_name, record_id, change_type, created_at, retry_count, last_error, payload)
                    VALUES ('medications', 'gone', 'delete', 2000, 0, NULL, ?)
                    """,
                arguments: [captured]
            )
        }

        _ = try await engine.push()
        let record = transport.record(named: "medications:gone")
        XCTAssertEqual(record?.deleted, true)
        XCTAssertEqual(record?.payload, captured, "tombstone must carry the captured delete payload, not {}")
    }

    // MARK: - Concurrent-edit-during-sync hardening (#461)

    func testPushDoesNotClobberNewerServerRecordAndConvergesLocally() async throws {
        // A local edit is queued at t=1000.
        try insertMedication("m1", name: "Local", updatedAt: 1000)
        try pendingStore.enqueue(tableName: "medications", recordId: "m1", changeType: .upsert, at: 1000)
        // Another device wrote a NEWER version into the zone during our pull→push window.
        transport.seed(remoteMedication("m1", name: "Remote", updatedAt: 2000))

        _ = try await engine.push(now: 3000)

        // Our stale push must not overwrite the newer server record...
        XCTAssertEqual(transport.record(named: "medications:m1")?.updatedAt, 2000)
        XCTAssertEqual(transport.record(named: "medications:m1")?.payload.contains("Remote"), true)
        // ...and the local DB converged to the server's version (losing local edit archived).
        XCTAssertEqual(try medicationName("m1"), "Remote")
        XCTAssertEqual(try pendingStore.pendingCount(), 0, "queue drained")
    }

    func testPushOverwritesOlderServerRecord() async throws {
        // Our local edit is the newer one.
        try insertMedication("m1", name: "Local", updatedAt: 5000)
        try pendingStore.enqueue(tableName: "medications", recordId: "m1", changeType: .upsert, at: 5000)
        transport.seed(remoteMedication("m1", name: "Remote", updatedAt: 2000))

        _ = try await engine.push(now: 6000)

        // Our newer version wins and lands on the server; local is unchanged.
        XCTAssertEqual(transport.record(named: "medications:m1")?.payload.contains("Local"), true)
        XCTAssertEqual(transport.record(named: "medications:m1")?.updatedAt, 5000)
        XCTAssertEqual(try medicationName("m1"), "Local")
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
        XCTAssertEqual(result.applied, 0, "pull runs before push, so our own push isn't echoed back this cycle")
        XCTAssertEqual(try medicationName("m1"), "Local")
        XCTAssertNotNil(transport.record(named: "medications:m1"), "local change was pushed")
    }

    /// Pull-then-push: a locally-queued edit that lost to a newer remote version must be
    /// dropped during pull, not pushed back over the winner.
    func testSyncDoesNotClobberNewerRemoteWithStaleLocalEdit() async throws {
        try insertMedication("m1", name: "Local", updatedAt: 1000)
        try pendingStore.enqueue(tableName: "medications", recordId: "m1", changeType: .upsert, at: 1000)
        try await transport.push([remoteMedication("m1", name: "Remote", updatedAt: 2000)])

        _ = try await engine.sync(now: 10)

        XCTAssertEqual(try medicationName("m1"), "Remote", "newer remote applied locally")
        let stored = transport.record(named: "medications:m1")
        XCTAssertEqual(stored?.updatedAt, 2000, "remote winner not overwritten by the stale local push")
        XCTAssertEqual(stored?.payload.contains("Remote"), true)
        XCTAssertEqual(try pendingStore.pendingCount(), 0, "superseded local edit was dropped")
    }

    /// The mirror case: a locally-queued edit that beats the remote version is kept and
    /// pushed over it.
    func testSyncPushesLocalWinnerOverOlderRemote() async throws {
        try insertMedication("m1", name: "Local", updatedAt: 2000)
        try pendingStore.enqueue(tableName: "medications", recordId: "m1", changeType: .upsert, at: 2000)
        try await transport.push([remoteMedication("m1", name: "Remote", updatedAt: 1000)])

        _ = try await engine.sync(now: 10)

        XCTAssertEqual(try medicationName("m1"), "Local", "local winner kept")
        let stored = transport.record(named: "medications:m1")
        XCTAssertEqual(stored?.updatedAt, 2000, "local winner pushed over the older remote")
        XCTAssertEqual(stored?.payload.contains("Local"), true)
        XCTAssertEqual(try pendingStore.pendingCount(), 0, "queue drained after push")
    }

    // MARK: - Recoverable errors

    func testSyncThrowsWhenAccountUnavailable() async throws {
        transport.accountIsAvailable = false
        do {
            _ = try await engine.sync(now: 10)
            XCTFail("expected accountUnavailable")
        } catch SyncTransportError.accountUnavailable {
            // expected
        }
        XCTAssertFalse(transport.zoneCreated, "no sync work attempted without an account")
    }

    func testPullRecoversFromExpiredToken() async throws {
        try await transport.push([remoteMedication("m1", name: "Remote", updatedAt: 2000)])
        transport.failNextFetch = SyncTransportError.changeTokenExpired

        let applied = try await engine.pull(now: 10)
        XCTAssertEqual(applied, 1, "token reset + retry, then the change applies")
        XCTAssertEqual(try medicationName("m1"), "Remote")
    }

    func testPushRecreatesZoneOnZoneNotFound() async throws {
        try insertMedication("m1", name: "Local", updatedAt: 1000)
        try pendingStore.enqueue(tableName: "medications", recordId: "m1", changeType: .upsert, at: 1000)
        transport.failNextPush = SyncTransportError.zoneNotFound

        let pushed = try await engine.push()
        XCTAssertEqual(pushed, 1)
        XCTAssertTrue(transport.zoneCreated, "zone recreated after zoneNotFound")
        XCTAssertNotNil(transport.record(named: "medications:m1"), "record pushed on retry")
    }
}
