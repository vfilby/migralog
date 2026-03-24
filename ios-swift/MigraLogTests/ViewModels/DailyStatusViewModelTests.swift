import XCTest
@testable import MigraLog

@MainActor
final class DailyStatusViewModelTests: XCTestCase {
    private var mockRepo: MockDailyStatusRepository!
    private var sut: DailyStatusViewModel!

    override func setUp() {
        super.setUp()
        mockRepo = MockDailyStatusRepository()
        sut = DailyStatusViewModel(dailyStatusRepository: mockRepo)
    }

    // MARK: - Load Status

    func testLoadStatusForDate_existingStatus_populatesState() async throws {
        let existing = TestFixtures.makeDailyStatus(
            id: "ds-1",
            date: "2025-01-15",
            status: .yellow,
            statusType: .prodrome,
            notes: "Felt off"
        )
        mockRepo.statuses = [existing]

        let date = TimestampHelper.dateFromString("2025-01-15")!
        await sut.loadStatusForDate(date)

        XCTAssertNotNil(sut.currentStatus)
        XCTAssertEqual(sut.selectedStatus, .yellow)
        XCTAssertEqual(sut.selectedType, .prodrome)
        XCTAssertEqual(sut.notes, "Felt off")
        XCTAssertFalse(sut.isLoading)
        XCTAssertTrue(mockRepo.getStatusByDateCalled)
    }

    func testLoadStatusForDate_noStatus_resetsToDefaults() async throws {
        let date = TimestampHelper.dateFromString("2025-01-15")!
        await sut.loadStatusForDate(date)

        XCTAssertNil(sut.currentStatus)
        XCTAssertEqual(sut.selectedStatus, .green)
        XCTAssertNil(sut.selectedType)
        XCTAssertEqual(sut.notes, "")
    }

    func testLoadStatusForDate_error_setsError() async throws {
        mockRepo.errorToThrow = TestError.mockError("DB error")
        let date = TimestampHelper.dateFromString("2025-01-15")!
        await sut.loadStatusForDate(date)

        XCTAssertNotNil(sut.error)
        XCTAssertFalse(sut.isLoading)
    }

    // MARK: - Log Status

    func testLogStatus_createsNewStatus() async throws {
        sut.selectedStatus = .green
        sut.notes = ""

        let date = TimestampHelper.dateFromString("2025-01-15")!
        await sut.logStatus(for: date)

        XCTAssertNotNil(sut.currentStatus)
        XCTAssertEqual(sut.currentStatus?.status, .green)
        XCTAssertNil(sut.currentStatus?.statusType)
        XCTAssertTrue(mockRepo.createStatusCalled)
    }

    func testLogStatus_yellowWithType() async throws {
        sut.selectedStatus = .yellow
        sut.selectedType = .postdrome
        sut.notes = "Recovering"

        let date = TimestampHelper.dateFromString("2025-01-15")!
        await sut.logStatus(for: date)

        XCTAssertEqual(sut.currentStatus?.status, .yellow)
        XCTAssertEqual(sut.currentStatus?.statusType, .postdrome)
        XCTAssertEqual(sut.currentStatus?.notes, "Recovering")
    }

    func testLogStatus_nonYellow_clearsType() async throws {
        sut.selectedStatus = .red
        sut.selectedType = .prodrome // Should be ignored for non-yellow

        let date = TimestampHelper.dateFromString("2025-01-15")!
        await sut.logStatus(for: date)

        XCTAssertEqual(sut.currentStatus?.status, .red)
        XCTAssertNil(sut.currentStatus?.statusType)
    }

    // MARK: - Update Status

    func testUpdateStatus_updatesExisting() async throws {
        let existing = TestFixtures.makeDailyStatus(id: "ds-1", date: "2025-01-15", status: .green)
        mockRepo.statuses = [existing]
        let date = TimestampHelper.dateFromString("2025-01-15")!
        await sut.loadStatusForDate(date)

        sut.selectedStatus = .red
        sut.notes = "Bad day"
        await sut.updateStatus()

        XCTAssertEqual(sut.currentStatus?.status, .red)
        XCTAssertEqual(sut.currentStatus?.notes, "Bad day")
        XCTAssertTrue(mockRepo.updateStatusCalled)
    }

    func testUpdateStatus_noExisting_noOp() async throws {
        sut.selectedStatus = .red
        await sut.updateStatus()

        XCTAssertFalse(mockRepo.updateStatusCalled)
    }

    // MARK: - Delete Status

    func testDeleteStatus_removesAndResets() async throws {
        let existing = TestFixtures.makeDailyStatus(id: "ds-1", date: "2025-01-15", status: .yellow, statusType: .anxiety)
        mockRepo.statuses = [existing]
        let date = TimestampHelper.dateFromString("2025-01-15")!
        await sut.loadStatusForDate(date)
        XCTAssertNotNil(sut.currentStatus)

        await sut.deleteStatus()

        XCTAssertNil(sut.currentStatus)
        XCTAssertEqual(sut.selectedStatus, .green)
        XCTAssertNil(sut.selectedType)
        XCTAssertEqual(sut.notes, "")
        XCTAssertTrue(mockRepo.deleteStatusCalled)
    }

    func testDeleteStatus_noExisting_noOp() async throws {
        await sut.deleteStatus()

        XCTAssertFalse(mockRepo.deleteStatusCalled)
    }

    // MARK: - Computed

    func testHasExistingStatus_true() async throws {
        let existing = TestFixtures.makeDailyStatus(id: "ds-1", date: "2025-01-15")
        mockRepo.statuses = [existing]
        let date = TimestampHelper.dateFromString("2025-01-15")!
        await sut.loadStatusForDate(date)

        XCTAssertTrue(sut.hasExistingStatus)
    }

    func testHasExistingStatus_false() async throws {
        XCTAssertFalse(sut.hasExistingStatus)
    }
}
