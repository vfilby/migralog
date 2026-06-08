import XCTest
import GRDB
@testable import MigraLog

final class SyncConflictsStoreTests: XCTestCase {
    var dbManager: DatabaseManager!
    var store: SyncConflictsStore!

    override func setUpWithError() throws {
        dbManager = try DatabaseManager(inMemory: true)
        store = SyncConflictsStore(dbManager: dbManager)
    }

    override func tearDownWithError() throws {
        store = nil
        dbManager = nil
    }

    func testArchiveAndFetchForRecord() throws {
        try store.archive(
            tableName: "episodes", recordId: "e1", losingSide: .local,
            payloads: (losing: #"{"v":1}"#, winning: #"{"v":2}"#), resolvedAt: 1000
        )
        let conflicts = try store.conflicts(forRecord: "episodes", recordId: "e1")
        XCTAssertEqual(conflicts.count, 1)
        XCTAssertEqual(conflicts[0].losingSide, .local)
        XCTAssertEqual(conflicts[0].payload, #"{"v":1}"#)
        XCTAssertEqual(conflicts[0].winningPayload, #"{"v":2}"#)
        XCTAssertEqual(conflicts[0].resolvedAt, 1000)
    }

    func testExpiresAtIsResolvedPlusRetention() throws {
        try store.archive(
            tableName: "episodes", recordId: "e1", losingSide: .remote,
            payloads: (losing: "a", winning: "b"), resolvedAt: 1000
        )
        let conflict = try store.conflicts(forRecord: "episodes", recordId: "e1")[0]
        let retentionMillis = Int64(SyncConflictsStore.retentionDays) * 24 * 3600 * 1000
        XCTAssertEqual(conflict.expiresAt, 1000 + retentionMillis)
    }

    func testFetchForRecordNewestFirst() throws {
        try store.archive(
            tableName: "episodes", recordId: "e1", losingSide: .local,
            payloads: (losing: "old", winning: "w"), resolvedAt: 1000
        )
        try store.archive(
            tableName: "episodes", recordId: "e1", losingSide: .remote,
            payloads: (losing: "new", winning: "w"), resolvedAt: 2000
        )
        let conflicts = try store.conflicts(forRecord: "episodes", recordId: "e1")
        XCTAssertEqual(conflicts.map { $0.payload }, ["new", "old"])
    }

    func testFetchIsScopedToRecord() throws {
        try store.archive(
            tableName: "episodes", recordId: "e1", losingSide: .local,
            payloads: (losing: "a", winning: "b"), resolvedAt: 1000
        )
        try store.archive(
            tableName: "medications", recordId: "m1", losingSide: .local,
            payloads: (losing: "c", winning: "d"), resolvedAt: 1000
        )
        XCTAssertEqual(try store.conflicts(forRecord: "episodes", recordId: "e1").count, 1)
        XCTAssertEqual(try store.count(), 2)
    }

    func testPurgeExpiredRemovesOnlyExpired() throws {
        let retentionMillis = Int64(SyncConflictsStore.retentionDays) * 24 * 3600 * 1000
        try store.archive(
            tableName: "episodes", recordId: "old", losingSide: .local,
            payloads: (losing: "a", winning: "b"), resolvedAt: 1000
        )
        try store.archive(
            tableName: "episodes", recordId: "new", losingSide: .local,
            payloads: (losing: "c", winning: "d"), resolvedAt: 5000
        )
        // Just past the first conflict's expiry, before the second's.
        let now = 1000 + retentionMillis + 1
        let purged = try store.purgeExpired(now: now)
        XCTAssertEqual(purged, 1)
        XCTAssertEqual(try store.count(), 1)
        XCTAssertEqual(try store.conflicts(forRecord: "episodes", recordId: "new").count, 1)
    }
}
