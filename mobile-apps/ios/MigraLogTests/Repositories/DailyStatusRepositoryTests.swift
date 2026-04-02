import XCTest
@testable import MigraLog

final class DailyStatusRepositoryTests: XCTestCase {
    var dbManager: DatabaseManager!
    var repo: DailyStatusRepository!

    override func setUpWithError() throws {
        dbManager = try DatabaseManager(inMemory: true)
        repo = DailyStatusRepository(dbManager: dbManager)
    }

    override func tearDownWithError() throws {
        dbManager = nil
        repo = nil
    }

    // MARK: - Helpers

    private func makeStatus(
        id: String = UUID().uuidString,
        date: String = "2024-01-15",
        status: DayStatus = .green,
        statusType: YellowDayType? = nil,
        notes: String? = nil,
        prompted: Bool = false
    ) -> DailyStatusLog {
        let now = TimestampHelper.now
        return DailyStatusLog(
            id: id,
            date: date,
            status: status,
            statusType: statusType,
            notes: notes,
            prompted: prompted,
            createdAt: now,
            updatedAt: now
        )
    }

    // MARK: - CRUD Tests

    func testCreateDailyStatus() throws {
        let status = makeStatus(date: "2024-01-15", status: .green)
        let created = try repo.createStatus(status)

        XCTAssertEqual(created.id, status.id)
        XCTAssertEqual(created.status, .green)
    }

    func testCreateYellowDayWithType() throws {
        let status = makeStatus(
            date: "2024-01-16",
            status: .yellow,
            statusType: .prodrome,
            notes: "Feeling off"
        )
        try repo.createStatus(status)

        let fetched = try repo.getStatusById(status.id)
        XCTAssertNotNil(fetched)
        XCTAssertEqual(fetched?.status, .yellow)
        XCTAssertEqual(fetched?.statusType, .prodrome)
        XCTAssertEqual(fetched?.notes, "Feeling off")
    }

    func testGetStatusByIdExists() throws {
        let status = makeStatus()
        try repo.createStatus(status)

        let fetched = try repo.getStatusById(status.id)
        XCTAssertNotNil(fetched)
        XCTAssertEqual(fetched?.id, status.id)
    }

    func testGetStatusByIdNotFound() throws {
        let fetched = try repo.getStatusById("nonexistent")
        XCTAssertNil(fetched)
    }

    func testGetStatusByDate() throws {
        let status = makeStatus(date: "2024-03-01")
        try repo.createStatus(status)

        let fetched = try repo.getStatusByDate("2024-03-01")
        XCTAssertNotNil(fetched)
        XCTAssertEqual(fetched?.id, status.id)
    }

    func testGetStatusByDateNotFound() throws {
        let fetched = try repo.getStatusByDate("2024-12-31")
        XCTAssertNil(fetched)
    }

    func testGetStatusesByDateRange() throws {
        try repo.createStatus(makeStatus(date: "2024-01-10", status: .green))
        try repo.createStatus(makeStatus(date: "2024-01-15", status: .red))
        try repo.createStatus(makeStatus(date: "2024-01-20", status: .yellow, statusType: .anxiety))
        try repo.createStatus(makeStatus(date: "2024-02-01", status: .green))

        let results = try repo.getStatusesByDateRange(start: "2024-01-10", end: "2024-01-20")
        XCTAssertEqual(results.count, 3)
        XCTAssertEqual(results[0].date, "2024-01-10")
        XCTAssertEqual(results[2].date, "2024-01-20")
    }

    func testGetMonthStats() throws {
        try repo.createStatus(makeStatus(date: "2024-01-05", status: .green))
        try repo.createStatus(makeStatus(date: "2024-01-15", status: .red))
        try repo.createStatus(makeStatus(date: "2024-01-25", status: .yellow, statusType: .postdrome))
        try repo.createStatus(makeStatus(date: "2024-02-01", status: .green))

        let janStats = try repo.getMonthStats(year: 2024, month: 1)
        XCTAssertEqual(janStats.count, 3)

        let febStats = try repo.getMonthStats(year: 2024, month: 2)
        XCTAssertEqual(febStats.count, 1)
    }

    func testUpdateStatus() throws {
        let status = makeStatus(date: "2024-01-15", status: .green)
        try repo.createStatus(status)

        var toUpdate = status
        toUpdate.status = .red
        toUpdate.notes = "Migraine hit"
        let updated = try repo.updateStatus(toUpdate)

        XCTAssertEqual(updated.status, .red)
        XCTAssertGreaterThanOrEqual(updated.updatedAt, status.updatedAt)

        let fetched = try repo.getStatusById(status.id)
        XCTAssertEqual(fetched?.status, .red)
        XCTAssertEqual(fetched?.notes, "Migraine hit")
    }

    func testDeleteStatus() throws {
        let status = makeStatus(date: "2024-01-15")
        try repo.createStatus(status)

        try repo.deleteStatus(status.id)

        let fetched = try repo.getStatusById(status.id)
        XCTAssertNil(fetched)
    }

    func testCreateDuplicateDateRejects() throws {
        let s1 = makeStatus(date: "2024-01-15", status: .green)
        try repo.createStatus(s1)

        let s2 = makeStatus(date: "2024-01-15", status: .red)
        XCTAssertThrowsError(try repo.createStatus(s2)) { error in
            // Should fail due to UNIQUE constraint on date
            XCTAssertTrue("\(error)".contains("UNIQUE") || "\(error)".lowercased().contains("unique"))
        }
    }

    func testPromptedField() throws {
        let status = makeStatus(date: "2024-01-15", prompted: true)
        try repo.createStatus(status)

        let fetched = try repo.getStatusById(status.id)
        XCTAssertEqual(fetched?.prompted, true)
    }

    func testYellowDayTypeConstraint() throws {
        // Green days should not have a statusType persisted due to CHECK constraint
        // The schema has: CHECK(status = 'yellow' OR status_type IS NULL)
        let status = makeStatus(date: "2024-01-15", status: .green, statusType: .prodrome)
        XCTAssertThrowsError(try repo.createStatus(status))
    }
}
