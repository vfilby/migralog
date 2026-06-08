import XCTest
@testable import MigraLog

final class LWWResolverTests: XCTestCase {

    func testRemoteNewerWins() {
        XCTAssertEqual(
            LWWResolver.resolve(localUpdatedAt: 100, localPayload: "a", remoteUpdatedAt: 200, remotePayload: "b"),
            .remote
        )
    }

    func testLocalNewerWins() {
        XCTAssertEqual(
            LWWResolver.resolve(localUpdatedAt: 300, localPayload: "a", remoteUpdatedAt: 200, remotePayload: "b"),
            .local
        )
    }

    func testTimestampTieBreaksOnHigherPayload() {
        XCTAssertEqual(
            LWWResolver.resolve(localUpdatedAt: 100, localPayload: "aaa", remoteUpdatedAt: 100, remotePayload: "bbb"),
            .remote
        )
        XCTAssertEqual(
            LWWResolver.resolve(localUpdatedAt: 100, localPayload: "zzz", remoteUpdatedAt: 100, remotePayload: "aaa"),
            .local
        )
    }

    func testIdenticalVersionsKeepLocal() {
        XCTAssertEqual(
            LWWResolver.resolve(localUpdatedAt: 100, localPayload: "same", remoteUpdatedAt: 100, remotePayload: "same"),
            .local
        )
    }

    /// Both devices see the same two versions (mirrored local/remote) and must converge
    /// on the same surviving payload — here, "y".
    func testTiebreakConvergesAcrossDevices() {
        let deviceA = LWWResolver.resolve(localUpdatedAt: 5, localPayload: "x", remoteUpdatedAt: 5, remotePayload: "y")
        let deviceB = LWWResolver.resolve(localUpdatedAt: 5, localPayload: "y", remoteUpdatedAt: 5, remotePayload: "x")
        XCTAssertEqual(deviceA, .remote, "device A keeps remote 'y'")
        XCTAssertEqual(deviceB, .local, "device B keeps local 'y'")
    }
}
