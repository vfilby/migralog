import XCTest
@testable import MigraLog

final class OverlayRepositoryTests: XCTestCase {
    var dbManager: DatabaseManager!
    var repo: OverlayRepository!

    override func setUpWithError() throws {
        dbManager = try DatabaseManager(inMemory: true)
        repo = OverlayRepository(dbManager: dbManager)
    }

    override func tearDownWithError() throws {
        dbManager = nil
        repo = nil
    }

    // MARK: - Helpers

    private func makeOverlay(
        id: String = UUID().uuidString,
        startDate: String = "2024-01-01",
        endDate: String? = "2024-01-31",
        label: String = "Vacation",
        notes: String? = nil,
        excludeFromStats: Bool = false
    ) -> CalendarOverlay {
        let now = TimestampHelper.now
        return CalendarOverlay(
            id: id,
            startDate: startDate,
            endDate: endDate,
            label: label,
            notes: notes,
            excludeFromStats: excludeFromStats,
            createdAt: now,
            updatedAt: now
        )
    }

    // MARK: - CRUD Tests

    func testCreateOverlay() throws {
        let overlay = makeOverlay(label: "Travel")
        let created = try repo.createOverlay(overlay)

        XCTAssertEqual(created.id, overlay.id)
        XCTAssertEqual(created.label, "Travel")
    }

    func testCreateOverlayWithAllFields() throws {
        let overlay = makeOverlay(
            startDate: "2024-03-01",
            endDate: "2024-03-15",
            label: "Spring Break",
            notes: "Visited family",
            excludeFromStats: true
        )
        try repo.createOverlay(overlay)

        let all = try repo.getAllOverlays()
        XCTAssertEqual(all.count, 1)
        XCTAssertEqual(all.first?.notes, "Visited family")
        XCTAssertEqual(all.first?.excludeFromStats, true)
    }

    func testCreateOngoingOverlay() throws {
        let overlay = makeOverlay(startDate: "2024-06-01", endDate: nil, label: "New medication trial")
        try repo.createOverlay(overlay)

        let all = try repo.getAllOverlays()
        XCTAssertEqual(all.count, 1)
        XCTAssertNil(all.first?.endDate)
    }

    func testGetAllOverlaysSortedByStartDate() throws {
        try repo.createOverlay(makeOverlay(startDate: "2024-03-01", endDate: "2024-03-31", label: "March"))
        try repo.createOverlay(makeOverlay(startDate: "2024-01-01", endDate: "2024-01-31", label: "January"))
        try repo.createOverlay(makeOverlay(startDate: "2024-02-01", endDate: "2024-02-28", label: "February"))

        let all = try repo.getAllOverlays()
        XCTAssertEqual(all.count, 3)
        XCTAssertEqual(all[0].label, "January")
        XCTAssertEqual(all[1].label, "February")
        XCTAssertEqual(all[2].label, "March")
    }

    func testGetOverlaysByDateRange() throws {
        try repo.createOverlay(makeOverlay(startDate: "2024-01-01", endDate: "2024-01-31", label: "January"))
        try repo.createOverlay(makeOverlay(startDate: "2024-02-01", endDate: "2024-02-28", label: "February"))
        try repo.createOverlay(makeOverlay(startDate: "2024-03-01", endDate: "2024-03-31", label: "March"))

        // Query for overlays that overlap with Feb 15 - Feb 28
        let results = try repo.getOverlaysByDateRange(start: "2024-02-15", end: "2024-02-28")
        XCTAssertEqual(results.count, 1)
        XCTAssertEqual(results.first?.label, "February")
    }

    func testGetOverlaysByDateRangeIncludesOngoing() throws {
        try repo.createOverlay(makeOverlay(startDate: "2024-01-01", endDate: nil, label: "Ongoing"))
        try repo.createOverlay(makeOverlay(startDate: "2024-06-01", endDate: "2024-06-30", label: "June"))

        let results = try repo.getOverlaysByDateRange(start: "2024-03-01", end: "2024-03-31")
        XCTAssertEqual(results.count, 1)
        XCTAssertEqual(results.first?.label, "Ongoing")
    }

    func testGetOverlaysForDate() throws {
        try repo.createOverlay(makeOverlay(startDate: "2024-01-01", endDate: "2024-01-31", label: "January"))
        try repo.createOverlay(makeOverlay(startDate: "2024-01-15", endDate: "2024-02-15", label: "Cross-month"))
        try repo.createOverlay(makeOverlay(startDate: "2024-03-01", endDate: "2024-03-31", label: "March"))

        let results = try repo.getOverlaysForDate("2024-01-20")
        XCTAssertEqual(results.count, 2)
    }

    func testGetOverlaysForDateIncludesOngoing() throws {
        try repo.createOverlay(makeOverlay(startDate: "2024-01-01", endDate: nil, label: "Ongoing"))

        let results = try repo.getOverlaysForDate("2024-12-25")
        XCTAssertEqual(results.count, 1)
        XCTAssertEqual(results.first?.label, "Ongoing")
    }

    func testUpdateOverlay() throws {
        let overlay = makeOverlay(label: "Original")
        try repo.createOverlay(overlay)

        var toUpdate = overlay
        toUpdate.label = "Updated Label"
        toUpdate.notes = "Added notes"
        toUpdate.excludeFromStats = true
        let updated = try repo.updateOverlay(toUpdate)

        XCTAssertGreaterThanOrEqual(updated.updatedAt, overlay.updatedAt)

        let all = try repo.getAllOverlays()
        XCTAssertEqual(all.first?.label, "Updated Label")
        XCTAssertEqual(all.first?.notes, "Added notes")
        XCTAssertEqual(all.first?.excludeFromStats, true)
    }

    func testDeleteOverlay() throws {
        let overlay = makeOverlay()
        try repo.createOverlay(overlay)

        try repo.deleteOverlay(overlay.id)

        let all = try repo.getAllOverlays()
        XCTAssertTrue(all.isEmpty)
    }

    func testEndDateConstraint() throws {
        // end_date must be >= start_date per CHECK constraint
        let overlay = makeOverlay(startDate: "2024-03-15", endDate: "2024-03-01", label: "Invalid")
        XCTAssertThrowsError(try repo.createOverlay(overlay))
    }
}
