import XCTest
import GRDB
@testable import MigraLog

final class SyncZoneStateStoreTests: XCTestCase {
    var dbManager: DatabaseManager!
    var store: SyncZoneStateStore!
    let zone = "MigraLogZone"

    override func setUpWithError() throws {
        dbManager = try DatabaseManager(inMemory: true)
        store = SyncZoneStateStore(dbManager: dbManager)
    }

    override func tearDownWithError() throws {
        store = nil
        dbManager = nil
    }

    func testUnknownZoneReturnsNil() throws {
        XCTAssertNil(try store.state(zoneName: zone))
    }

    func testSaveAndLoadChangeToken() throws {
        let token = Data([0x01, 0x02, 0x03])
        try store.saveChangeToken(token, zoneName: zone, syncedAt: 5000)

        let state = try store.state(zoneName: zone)
        XCTAssertEqual(state?.serverChangeToken, token)
        XCTAssertEqual(state?.lastSyncAt, 5000)
        XCTAssertNil(state?.lastError)
    }

    func testSaveChangeTokenUpdatesExisting() throws {
        try store.saveChangeToken(Data([0x01]), zoneName: zone, syncedAt: 1000)
        try store.saveChangeToken(Data([0x09]), zoneName: zone, syncedAt: 2000)

        let state = try store.state(zoneName: zone)
        XCTAssertEqual(state?.serverChangeToken, Data([0x09]))
        XCTAssertEqual(state?.lastSyncAt, 2000)
    }

    func testRecordErrorDoesNotClobberToken() throws {
        try store.saveChangeToken(Data([0x07]), zoneName: zone, syncedAt: 1000)
        try store.recordError("network down", zoneName: zone, at: 3000)

        let state = try store.state(zoneName: zone)
        XCTAssertEqual(state?.serverChangeToken, Data([0x07]), "an error must not wipe the cursor")
        XCTAssertEqual(state?.lastSyncAt, 1000)
        XCTAssertEqual(state?.lastError, "network down")
        XCTAssertEqual(state?.lastErrorAt, 3000)
    }

    func testSaveChangeTokenClearsPriorError() throws {
        try store.recordError("boom", zoneName: zone, at: 1000)
        try store.saveChangeToken(Data([0x05]), zoneName: zone, syncedAt: 2000)

        let state = try store.state(zoneName: zone)
        XCTAssertNil(state?.lastError, "a successful sync clears the error")
        XCTAssertNil(state?.lastErrorAt)
    }

    func testSaveSyncedSchemaPersists() throws {
        try store.saveSyncedSchema(#"{"medications":["id"]}"#, zoneName: zone)
        XCTAssertEqual(try store.state(zoneName: zone)?.lastSyncedSchema, #"{"medications":["id"]}"#)
    }

    func testSaveSyncedSchemaDoesNotDisturbTokenOrStatus() throws {
        try store.saveChangeToken(Data([0x07]), zoneName: zone, syncedAt: 1000)
        try store.saveSyncedSchema("{}", zoneName: zone)

        let state = try store.state(zoneName: zone)
        XCTAssertEqual(state?.serverChangeToken, Data([0x07]), "manifest save must not wipe the cursor")
        XCTAssertEqual(state?.lastSyncAt, 1000)
        XCTAssertEqual(state?.lastSyncedSchema, "{}")
    }

    func testTokenSaveAndErrorPreserveSyncedSchema() throws {
        try store.saveSyncedSchema("{}", zoneName: zone)
        try store.saveChangeToken(Data([0x01]), zoneName: zone, syncedAt: 2000)
        try store.recordError("boom", zoneName: zone, at: 3000)

        XCTAssertEqual(try store.state(zoneName: zone)?.lastSyncedSchema, "{}",
                       "token saves and errors must not clear the stamped manifest")
    }

    func testRecordErrorOnFreshZone() throws {
        try store.recordError("first failure", zoneName: zone, at: 1000)

        let state = try store.state(zoneName: zone)
        XCTAssertEqual(state?.lastError, "first failure")
        XCTAssertNil(state?.serverChangeToken)
        XCTAssertNil(state?.lastSyncAt)
    }
}
