import XCTest
@testable import MigraLog

@MainActor
final class OverlayViewModelTests: XCTestCase {
    private var mockRepo: MockCalendarOverlayRepository!
    private var sut: OverlayViewModel!

    override func setUp() {
        super.setUp()
        mockRepo = MockCalendarOverlayRepository()
        sut = OverlayViewModel(overlayRepository: mockRepo)
    }

    // MARK: - Helpers

    private func makeOverlay(
        id: String = UUID().uuidString,
        startDate: String = "2025-01-15",
        endDate: String? = "2025-01-20",
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

    // MARK: - Load Overlays

    func testLoadOverlays_populatesState() async {
        mockRepo.overlays = [
            makeOverlay(id: "o-1", startDate: "2025-01-10", label: "Trip"),
            makeOverlay(id: "o-2", startDate: "2025-02-01", label: "Holiday")
        ]

        await sut.loadOverlays()

        XCTAssertEqual(sut.overlays.count, 2)
        XCTAssertFalse(sut.isLoading)
        XCTAssertNil(sut.error)
    }

    func testLoadOverlays_emptyRepo_returnsEmpty() async {
        await sut.loadOverlays()

        XCTAssertTrue(sut.overlays.isEmpty)
        XCTAssertFalse(sut.isLoading)
        XCTAssertNil(sut.error)
    }

    func testLoadOverlays_error_setsError() async {
        mockRepo.errorToThrow = TestError.mockError("DB read failed")

        await sut.loadOverlays()

        XCTAssertNotNil(sut.error)
        XCTAssertTrue(sut.overlays.isEmpty)
        XCTAssertFalse(sut.isLoading)
    }

    // MARK: - Create Overlay

    func testCreateOverlay_appendsToList() async {
        await sut.createOverlay(
            startDate: "2025-03-01",
            endDate: "2025-03-05",
            label: "Conference"
        )

        XCTAssertEqual(sut.overlays.count, 1)
        XCTAssertEqual(sut.overlays.first?.label, "Conference")
        XCTAssertEqual(sut.overlays.first?.startDate, "2025-03-01")
        XCTAssertEqual(sut.overlays.first?.endDate, "2025-03-05")
        XCTAssertNil(sut.error)
    }

    func testCreateOverlay_withAllFields() async {
        await sut.createOverlay(
            startDate: "2025-04-01",
            endDate: nil,
            label: "Medication Change",
            notes: "Switched to new preventive",
            excludeFromStats: true
        )

        XCTAssertEqual(sut.overlays.count, 1)
        let overlay = sut.overlays.first!
        XCTAssertNil(overlay.endDate)
        XCTAssertEqual(overlay.notes, "Switched to new preventive")
        XCTAssertTrue(overlay.excludeFromStats)
    }

    func testCreateOverlay_persistsToRepo() async {
        await sut.createOverlay(startDate: "2025-03-01", label: "Test")

        XCTAssertEqual(mockRepo.overlays.count, 1)
        XCTAssertEqual(mockRepo.overlays.first?.label, "Test")
    }

    func testCreateOverlay_error_setsError() async {
        mockRepo.errorToThrow = TestError.mockError("Insert failed")

        await sut.createOverlay(startDate: "2025-03-01", label: "Test")

        XCTAssertNotNil(sut.error)
        XCTAssertTrue(sut.overlays.isEmpty)
    }

    // MARK: - Update Overlay

    func testUpdateOverlay_updatesInList() async {
        let original = makeOverlay(id: "o-1", label: "Old Label")
        mockRepo.overlays = [original]
        await sut.loadOverlays()

        var updated = original
        updated.label = "New Label"
        await sut.updateOverlay(updated)

        XCTAssertEqual(sut.overlays.count, 1)
        XCTAssertEqual(sut.overlays.first?.label, "New Label")
        XCTAssertNil(sut.error)
    }

    func testUpdateOverlay_persistsToRepo() async {
        let original = makeOverlay(id: "o-1", label: "Old")
        mockRepo.overlays = [original]
        await sut.loadOverlays()

        var updated = original
        updated.label = "Updated"
        await sut.updateOverlay(updated)

        XCTAssertEqual(mockRepo.overlays.first?.label, "Updated")
    }

    func testUpdateOverlay_error_setsError() async {
        let original = makeOverlay(id: "o-1")
        mockRepo.overlays = [original]
        await sut.loadOverlays()

        mockRepo.errorToThrow = TestError.mockError("Update failed")
        var updated = original
        updated.label = "Changed"
        await sut.updateOverlay(updated)

        XCTAssertNotNil(sut.error)
        // Original stays in the list since update failed
        XCTAssertEqual(sut.overlays.first?.label, "Vacation")
    }

    // MARK: - Delete Overlay

    func testDeleteOverlay_removesFromList() async {
        let overlay = makeOverlay(id: "o-1")
        mockRepo.overlays = [overlay]
        await sut.loadOverlays()
        XCTAssertEqual(sut.overlays.count, 1)

        await sut.deleteOverlay("o-1")

        XCTAssertTrue(sut.overlays.isEmpty)
        XCTAssertNil(sut.error)
    }

    func testDeleteOverlay_removesFromRepo() async {
        let overlay = makeOverlay(id: "o-1")
        mockRepo.overlays = [overlay]
        await sut.loadOverlays()

        await sut.deleteOverlay("o-1")

        XCTAssertTrue(mockRepo.overlays.isEmpty)
    }

    func testDeleteOverlay_onlyRemovesTargeted() async {
        mockRepo.overlays = [
            makeOverlay(id: "o-1", label: "First"),
            makeOverlay(id: "o-2", label: "Second")
        ]
        await sut.loadOverlays()

        await sut.deleteOverlay("o-1")

        XCTAssertEqual(sut.overlays.count, 1)
        XCTAssertEqual(sut.overlays.first?.id, "o-2")
    }

    func testDeleteOverlay_error_setsError() async {
        let overlay = makeOverlay(id: "o-1")
        mockRepo.overlays = [overlay]
        await sut.loadOverlays()

        mockRepo.errorToThrow = TestError.mockError("Delete failed")
        await sut.deleteOverlay("o-1")

        XCTAssertNotNil(sut.error)
        // Overlay stays since delete failed
        XCTAssertEqual(sut.overlays.count, 1)
    }
}
