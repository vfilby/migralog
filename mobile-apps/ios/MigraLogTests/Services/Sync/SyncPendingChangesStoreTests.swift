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
}
