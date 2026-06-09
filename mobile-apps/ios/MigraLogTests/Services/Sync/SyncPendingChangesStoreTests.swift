import XCTest
import GRDB
@testable import MigraLog

final class SyncPendingChangesStoreTests: XCTestCase {
    var dbManager: DatabaseManager!
    var store: SyncPendingChangesStore!

    override func setUpWithError() throws {
        dbManager = try DatabaseManager(inMemory: true)
        store = SyncPendingChangesStore(dbManager: dbManager)
    }

    override func tearDownWithError() throws {
        store = nil
        dbManager = nil
    }

    func testEnqueueAndFetchOldestFirst() throws {
        try store.enqueue(tableName: "episodes", recordId: "e1", changeType: .upsert, at: 1000)
        try store.enqueue(tableName: "medications", recordId: "m1", changeType: .delete, at: 2000)

        let batch = try store.fetchBatch(limit: 10)
        XCTAssertEqual(batch.map { $0.recordId }, ["e1", "m1"])
        XCTAssertEqual(batch[0].changeType, .upsert)
        XCTAssertEqual(batch[1].changeType, .delete)
    }

    func testEnqueueSupersedesSameRecord() throws {
        try store.enqueue(tableName: "episodes", recordId: "e1", changeType: .upsert, at: 1000)
        try store.enqueue(tableName: "episodes", recordId: "e1", changeType: .delete, at: 5000)

        let batch = try store.fetchBatch(limit: 10)
        XCTAssertEqual(batch.count, 1, "the same row collapses to a single pending entry")
        XCTAssertEqual(batch[0].changeType, .delete, "the latest change wins")
        XCTAssertEqual(batch[0].createdAt, 5000)
    }

    func testSupersedeClearsRetryState() throws {
        try store.enqueue(tableName: "episodes", recordId: "e1", changeType: .upsert, at: 1000)
        let id = try store.fetchBatch(limit: 1)[0].id
        try store.recordFailure(id: id, error: "boom")
        XCTAssertEqual(try store.fetchBatch(limit: 1)[0].retryCount, 1)

        try store.enqueue(tableName: "episodes", recordId: "e1", changeType: .upsert, at: 2000)
        let reread = try store.fetchBatch(limit: 1)[0]
        XCTAssertEqual(reread.retryCount, 0, "a superseding enqueue resets retry state")
        XCTAssertNil(reread.lastError)
    }

    func testRemove() throws {
        try store.enqueue(tableName: "episodes", recordId: "e1", changeType: .upsert, at: 1000)
        try store.enqueue(tableName: "episodes", recordId: "e2", changeType: .upsert, at: 2000)

        let batch = try store.fetchBatch(limit: 10)
        try store.remove(ids: [batch[0].id])

        XCTAssertEqual(try store.pendingCount(), 1)
        XCTAssertEqual(try store.fetchBatch(limit: 10).first?.recordId, "e2")
    }

    func testRemoveEmptyIsNoOp() throws {
        try store.enqueue(tableName: "episodes", recordId: "e1", changeType: .upsert, at: 1000)
        try store.remove(ids: [])
        XCTAssertEqual(try store.pendingCount(), 1)
    }

    func testRecordFailureIncrementsAndKeepsLatestError() throws {
        try store.enqueue(tableName: "episodes", recordId: "e1", changeType: .upsert, at: 1000)
        let id = try store.fetchBatch(limit: 1)[0].id
        try store.recordFailure(id: id, error: "err1")
        try store.recordFailure(id: id, error: "err2")

        let change = try store.fetchBatch(limit: 1)[0]
        XCTAssertEqual(change.retryCount, 2)
        XCTAssertEqual(change.lastError, "err2")
    }

    func testFetchBatchRespectsLimit() throws {
        for index in 0..<5 {
            try store.enqueue(
                tableName: "episodes", recordId: "e\(index)",
                changeType: .upsert, at: Int64(1000 + index)
            )
        }
        XCTAssertEqual(try store.fetchBatch(limit: 3).count, 3)
        XCTAssertEqual(try store.pendingCount(), 5)
    }

    func testRemovePendingDeletesOnlyThatRow() throws {
        try store.enqueue(tableName: "medications", recordId: "m1", changeType: .upsert, at: 1000)
        try store.enqueue(tableName: "episodes", recordId: "e1", changeType: .upsert, at: 1000)

        try store.removePending(tableName: "medications", recordId: "m1")

        XCTAssertEqual(try store.fetchBatch(limit: 10).map { $0.recordId }, ["e1"])
    }

    // MARK: - Backfill

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

    private func insertEpisode(_ id: String) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO episodes
                        (id, start_time, locations, qualities, symptoms, triggers, created_at, updated_at)
                    VALUES (?, 1000, '[]', '[]', '[]', '[]', 1000, 1000)
                    """,
                arguments: [id]
            )
        }
    }

    func testBackfillEnqueuesAllExistingRows() throws {
        try insertMedication("m1")
        try insertMedication("m2")
        try insertEpisode("e1")

        let count = try store.backfillExistingRows(at: 9000)
        XCTAssertEqual(count, 3)
        XCTAssertEqual(try store.pendingCount(), 3)
        XCTAssertTrue(try store.fetchBatch(limit: 10).allSatisfy { $0.changeType == .upsert })
    }

    func testBackfillDoesNotDowngradeAPendingDelete() throws {
        try insertMedication("m1")
        try insertMedication("m2")
        // m1 already has a pending delete (it was removed locally before the backfill).
        try store.enqueue(tableName: "medications", recordId: "m1", changeType: .delete, at: 500)

        let count = try store.backfillExistingRows(at: 9000)
        XCTAssertEqual(count, 1, "only m2 is newly enqueued; m1 is already queued")

        let pairs = try store.fetchBatch(limit: 10).map { ($0.recordId, $0.changeType) }
        let byId = Dictionary(uniqueKeysWithValues: pairs)
        XCTAssertEqual(byId["m1"], .delete, "the pending delete is preserved, not downgraded to upsert")
        XCTAssertEqual(byId["m2"], .upsert)
    }

    func testBackfillIsIdempotent() throws {
        try insertMedication("m1")
        XCTAssertEqual(try store.backfillExistingRows(at: 9000), 1)
        XCTAssertEqual(try store.backfillExistingRows(at: 9001), 0, "already-queued rows are not re-enqueued")
        XCTAssertEqual(try store.pendingCount(), 1)
    }
}
