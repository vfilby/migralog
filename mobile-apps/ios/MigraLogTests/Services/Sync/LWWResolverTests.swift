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

    // MARK: - Timestamp-tie column merge (#469)

    func testTieMergeFillsLocallyMissingAndNullColumns() {
        let result = LWWResolver.tieMerge(
            localPayload: ["id": .text("m1"), "name": .text("Med"), "notes": .null],
            remotePayload: ["id": .text("m1"), "name": .text("Med"),
                            "notes": .text("rich"), "strength": .int(50)]
        )
        XCTAssertEqual(result, .fillColumns(["notes", "strength"]),
                       "remote fills the locally-NULL and locally-missing columns")
    }

    func testTieMergeKeepsLocalWhenRemoteIsSubset() {
        let result = LWWResolver.tieMerge(
            localPayload: ["id": .text("m1"), "name": .text("Med"), "notes": .text("mine")],
            remotePayload: ["id": .text("m1"), "name": .text("Med")]
        )
        XCTAssertEqual(result, .keepLocal, "remote offers nothing new")
    }

    func testTieMergeRemoteNullNeverOverwritesLocalValue() {
        let result = LWWResolver.tieMerge(
            localPayload: ["id": .text("m1"), "notes": .text("mine")],
            remotePayload: ["id": .text("m1"), "notes": .null]
        )
        XCTAssertEqual(result, .keepLocal)
    }

    func testTieMergeConflictingValuesFallBackToTiebreak() {
        let result = LWWResolver.tieMerge(
            localPayload: ["id": .text("m1"), "name": .text("Mine")],
            remotePayload: ["id": .text("m1"), "name": .text("Theirs"), "notes": .text("x")]
        )
        XCTAssertEqual(result, .conflictingValues,
                       "a genuine value disagreement is not a schema-richness merge")
    }

    /// Mirror-image merge converges: each device fills the column it lacks, both end
    /// at the column-union.
    func testTieMergeConvergesAcrossDevices() {
        let base: [String: SyncPayloadCodec.Value] = ["id": .text("m1"), "name": .text("Med")]
        var withNotes = base
        withNotes["notes"] = .text("n")
        var withStrength = base
        withStrength["strength"] = .int(50)

        XCTAssertEqual(LWWResolver.tieMerge(localPayload: withNotes, remotePayload: withStrength),
                       .fillColumns(["strength"]))
        XCTAssertEqual(LWWResolver.tieMerge(localPayload: withStrength, remotePayload: withNotes),
                       .fillColumns(["notes"]))
    }
}
