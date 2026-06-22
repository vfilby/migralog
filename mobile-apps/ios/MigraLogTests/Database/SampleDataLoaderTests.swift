import XCTest
import GRDB
@testable import MigraLog

final class SampleDataLoaderTests: XCTestCase {
    var dbManager: DatabaseManager!

    override func setUpWithError() throws {
        dbManager = try DatabaseManager(inMemory: true)
    }

    override func tearDownWithError() throws {
        dbManager = nil
    }

    func testLoadPopulatesEpisodesMedicationsAndStatuses() throws {
        try SampleDataLoader.load(into: dbManager)

        try dbManager.dbQueue.read { db in
            // 12 historical episodes + 1 active episode.
            let episodes = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM episodes") ?? 0
            XCTAssertEqual(episodes, 13)

            // 4 medications: 2 preventative, 2 rescue.
            let meds = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM medications") ?? 0
            XCTAssertEqual(meds, 4)

            // 90 daily status logs.
            let statuses = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM daily_status_logs") ?? 0
            XCTAssertEqual(statuses, 90)

            // Exactly one active (open) episode.
            let active = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM episodes WHERE end_time IS NULL") ?? 0
            XCTAssertEqual(active, 1)

            // Doses exist (rescue + routine).
            let doses = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM medication_doses") ?? 0
            XCTAssertGreaterThan(doses, 0)
        }
    }

    func testLoadAfterResetProducesCleanDataset() throws {
        try SampleDataLoader.load(into: dbManager)
        try dbManager.resetDatabase()
        try SampleDataLoader.load(into: dbManager)

        // Reloading after a reset should not duplicate rows (fixed ids would
        // otherwise collide), so counts stay identical to a single load.
        try dbManager.dbQueue.read { db in
            let episodes = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM episodes") ?? 0
            XCTAssertEqual(episodes, 13)
        }
    }
}
