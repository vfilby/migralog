import XCTest
@testable import MigraLog

final class InMemoryCloudKitTransportTests: XCTestCase {

    private func rec(
        _ table: String, _ id: String,
        updatedAt: Int64 = 1, deleted: Bool = false, payload: String = "{}"
    ) -> SyncRecord {
        SyncRecord(
            tableName: table, recordId: id, payload: payload,
            schemaVersion: 30, updatedAt: updatedAt, deleted: deleted
        )
    }

    func testEnsureZone() async throws {
        let transport = InMemoryCloudKitTransport()
        XCTAssertFalse(transport.zoneCreated)
        try await transport.ensureZone()
        XCTAssertTrue(transport.zoneCreated)
    }

    func testPushThenFetchAllFromNilToken() async throws {
        let transport = InMemoryCloudKitTransport()
        try await transport.push([rec("episodes", "e1"), rec("medications", "m1")])

        let batch = try await transport.fetchChanges(since: nil)
        XCTAssertEqual(Set(batch.records.map { $0.recordName }), ["episodes:e1", "medications:m1"])
        XCTAssertNotNil(batch.newToken)
        XCTAssertFalse(batch.moreComing)
    }

    func testFetchIsIncremental() async throws {
        let transport = InMemoryCloudKitTransport()
        try await transport.push([rec("episodes", "e1")])
        let first = try await transport.fetchChanges(since: nil)

        let nothingNew = try await transport.fetchChanges(since: first.newToken)
        XCTAssertTrue(nothingNew.records.isEmpty, "nothing changed since the first token")

        try await transport.push([rec("episodes", "e2")])
        let second = try await transport.fetchChanges(since: first.newToken)
        XCTAssertEqual(second.records.map { $0.recordName }, ["episodes:e2"], "only the new record returns")
    }

    func testPushUpdatesExistingRecord() async throws {
        let transport = InMemoryCloudKitTransport()
        try await transport.push([rec("episodes", "e1", updatedAt: 1)])
        try await transport.push([rec("episodes", "e1", updatedAt: 2)])

        XCTAssertEqual(transport.record(named: "episodes:e1")?.updatedAt, 2)
        let batch = try await transport.fetchChanges(since: nil)
        XCTAssertEqual(batch.records.count, 1, "the same record name stays a single record")
    }

    func testTombstonePropagatesAsRecord() async throws {
        let transport = InMemoryCloudKitTransport()
        try await transport.push([rec("episodes", "e1", updatedAt: 5, deleted: true)])

        let batch = try await transport.fetchChanges(since: nil)
        XCTAssertEqual(batch.records.first?.deleted, true)
    }

    func testFailNextPushThrowsOnce() async throws {
        struct Boom: Error {}
        let transport = InMemoryCloudKitTransport()
        transport.failNextPush = Boom()

        do {
            try await transport.push([rec("episodes", "e1")])
            XCTFail("expected push to throw")
        } catch is Boom {
            // expected
        }

        try await transport.push([rec("episodes", "e1")])
        XCTAssertEqual(transport.pushCount, 1, "only the successful push counts")
    }

    // MARK: - LWW at push (#461)

    func testPushKeepsNewerServerRecordAndReturnsIt() async throws {
        let transport = InMemoryCloudKitTransport()
        transport.seed(rec("episodes", "e1", updatedAt: 5, payload: #"{"v":"server"}"#))

        let serverWon = try await transport.push([rec("episodes", "e1", updatedAt: 2, payload: #"{"v":"local"}"#)])

        XCTAssertEqual(serverWon.map { $0.recordName }, ["episodes:e1"], "the newer server record is returned")
        XCTAssertEqual(transport.record(named: "episodes:e1")?.updatedAt, 5, "the stale push must not clobber it")
        XCTAssertEqual(transport.record(named: "episodes:e1")?.payload, #"{"v":"server"}"#)
    }

    func testPushOverwritesOlderServerRecordAndReturnsEmpty() async throws {
        let transport = InMemoryCloudKitTransport()
        transport.seed(rec("episodes", "e1", updatedAt: 2))

        let serverWon = try await transport.push([rec("episodes", "e1", updatedAt: 5)])

        XCTAssertTrue(serverWon.isEmpty, "our newer version wins, nothing to converge")
        XCTAssertEqual(transport.record(named: "episodes:e1")?.updatedAt, 5)
    }
}
