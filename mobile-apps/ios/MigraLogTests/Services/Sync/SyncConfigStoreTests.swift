import XCTest
import GRDB
@testable import MigraLog

final class SyncConfigStoreTests: XCTestCase {
    var dbManager: DatabaseManager!
    var store: SyncConfigStore!

    override func setUpWithError() throws {
        dbManager = try DatabaseManager(inMemory: true)
        store = SyncConfigStore(dbManager: dbManager)
    }

    override func tearDownWithError() throws {
        store = nil
        dbManager = nil
    }

    func testDefaultsToDisabled() throws {
        let config = try store.config()
        XCTAssertFalse(config.enabled)
        XCTAssertNil(config.lastSyncedAt)
        XCTAssertNil(config.lastError)
    }

    func testSetEnabledRoundTrips() throws {
        try store.setEnabled(true)
        XCTAssertTrue(try store.config().enabled)
        try store.setEnabled(false)
        XCTAssertFalse(try store.config().enabled)
    }

    func testRecordSuccessStampsTimeAndClearsError() throws {
        try store.recordFailure("boom")
        try store.recordSuccess(at: 5000)
        let config = try store.config()
        XCTAssertEqual(config.lastSyncedAt, 5000)
        XCTAssertNil(config.lastError)
    }

    func testRecordFailureStoresMessage() throws {
        try store.recordFailure("network down")
        XCTAssertEqual(try store.config().lastError, "network down")
    }
}
