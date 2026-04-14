import XCTest
@testable import MigraLog

@MainActor
final class DashboardViewModelTests: XCTestCase {
    private var mockEpisodeRepo: MockEpisodeRepository!
    private var mockMedRepo: MockMedicationRepository!
    private var mockStatusRepo: MockDailyStatusRepository!
    private var sut: DashboardViewModel!

    override func setUp() {
        super.setUp()
        mockEpisodeRepo = MockEpisodeRepository()
        mockMedRepo = MockMedicationRepository()
        mockStatusRepo = MockDailyStatusRepository()
        sut = DashboardViewModel(
            episodeRepository: mockEpisodeRepo,
            medicationRepository: mockMedRepo,
            dailyStatusRepository: mockStatusRepo
        )
    }

    // MARK: - Load Data

    func testLoadData_populatesCurrentEpisode() async throws {
        let activeEpisode = TestFixtures.makeEpisode(id: "ep-1")
        mockEpisodeRepo.episodes = [activeEpisode]

        await sut.loadData()

        XCTAssertNotNil(sut.currentEpisode)
        XCTAssertEqual(sut.currentEpisode?.id, "ep-1")
        XCTAssertFalse(sut.isLoading)
        XCTAssertNil(sut.error)
    }

    func testLoadData_noActiveEpisode_currentEpisodeNil() async throws {
        let endedEpisode = TestFixtures.makeEpisode(id: "ep-1", endTime: TimestampHelper.now)
        mockEpisodeRepo.episodes = [endedEpisode]

        await sut.loadData()

        XCTAssertNil(sut.currentEpisode)
    }

    func testLoadData_loadsMedications() async throws {
        let med = TestFixtures.makeMedication(id: "med-1")
        let schedule = TestFixtures.makeSchedule(id: "s-1", medicationId: "med-1")
        mockMedRepo.medications = [med]
        mockMedRepo.schedules = [schedule]

        await sut.loadData()

        XCTAssertEqual(sut.todaysMedications.count, 1)
        XCTAssertEqual(sut.todaysMedications.first?.medication.name, "Ibuprofen")
        XCTAssertTrue(sut.todaysMedications.first!.isPending)
    }

    func testLoadData_loadsYesterdayStatus() async throws {
        let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: Date())!
        let dateString = TimestampHelper.dateString(from: yesterday)
        let status = TestFixtures.makeDailyStatus(id: "ds-1", date: dateString, status: .green)
        mockStatusRepo.statuses = [status]

        await sut.loadData()

        XCTAssertNotNil(sut.yesterdayStatus)
        XCTAssertEqual(sut.yesterdayStatus?.status, .green)
    }

    func testLoadData_noYesterdayStatus_nil() async throws {
        await sut.loadData()

        XCTAssertNil(sut.yesterdayStatus)
    }

    // MARK: - Yesterday Prompt Visibility

    func testLoadData_noStatusNoEpisode_showsPrompt() async throws {
        await sut.loadData()

        XCTAssertNil(sut.yesterdayStatus)
        XCTAssertTrue(sut.shouldShowYesterdayPrompt)
    }

    func testLoadData_yesterdayHasEpisode_hidesPrompt() async throws {
        let calendar = Calendar.current
        let yesterday = calendar.date(byAdding: .day, value: -1, to: Date())!
        let dayStart = calendar.startOfDay(for: yesterday)
        let startMs = TimestampHelper.fromDate(dayStart)
        let endMs = startMs + 3_600_000 // +1 hour, squarely within yesterday
        let episode = TestFixtures.makeEpisode(id: "ep-y", startTime: startMs, endTime: endMs)
        mockEpisodeRepo.episodes = [episode]

        await sut.loadData()

        XCTAssertNil(sut.yesterdayStatus)
        XCTAssertFalse(sut.shouldShowYesterdayPrompt)
    }

    func testLoadData_yesterdayStatusLogged_hidesPrompt() async throws {
        let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: Date())!
        let dateString = TimestampHelper.dateString(from: yesterday)
        mockStatusRepo.statuses = [TestFixtures.makeDailyStatus(id: "ds-1", date: dateString, status: .green)]

        await sut.loadData()

        XCTAssertNotNil(sut.yesterdayStatus)
        XCTAssertFalse(sut.shouldShowYesterdayPrompt)
    }

    func testLoadData_episodeSpansOvernightIntoYesterday_hidesPrompt() async throws {
        // Episode started two days ago, still ongoing — overlaps yesterday.
        let calendar = Calendar.current
        let twoDaysAgo = calendar.date(byAdding: .day, value: -2, to: Date())!
        let startMs = TimestampHelper.fromDate(calendar.startOfDay(for: twoDaysAgo))
        let episode = TestFixtures.makeEpisode(id: "ep-long", startTime: startMs, endTime: nil)
        mockEpisodeRepo.episodes = [episode]

        await sut.loadData()

        XCTAssertFalse(sut.shouldShowYesterdayPrompt)
    }

    func testLoadData_error_setsError() async throws {
        mockEpisodeRepo.errorToThrow = TestError.mockError("DB error")

        await sut.loadData()

        XCTAssertNotNil(sut.error)
        XCTAssertFalse(sut.isLoading)
    }

    // MARK: - Log Dose

    func testLogDose_createsTakenDose() async throws {
        let med = TestFixtures.makeMedication(id: "med-1")
        let schedule = TestFixtures.makeSchedule(id: "s-1", medicationId: "med-1")
        mockMedRepo.medications = [med]
        mockMedRepo.schedules = [schedule]
        await sut.loadData()

        let item = sut.todaysMedications[0]
        XCTAssertTrue(item.isPending)

        await sut.logDose(scheduleItem: item)

        XCTAssertTrue(mockMedRepo.createDoseCalled)
        XCTAssertTrue(sut.todaysMedications[0].isTaken)
        XCTAssertFalse(sut.todaysMedications[0].isPending)
    }

    // MARK: - Skip Dose

    func testSkipDose_createsSkippedDose() async throws {
        let med = TestFixtures.makeMedication(id: "med-1")
        let schedule = TestFixtures.makeSchedule(id: "s-1", medicationId: "med-1")
        mockMedRepo.medications = [med]
        mockMedRepo.schedules = [schedule]
        await sut.loadData()

        let item = sut.todaysMedications[0]
        await sut.skipDose(scheduleItem: item)

        XCTAssertTrue(mockMedRepo.createDoseCalled)
        XCTAssertTrue(sut.todaysMedications[0].isSkipped)
    }

    // MARK: - Undo Dose

    func testUndoDose_removesDose() async throws {
        let med = TestFixtures.makeMedication(id: "med-1")
        let schedule = TestFixtures.makeSchedule(id: "s-1", medicationId: "med-1")
        mockMedRepo.medications = [med]
        mockMedRepo.schedules = [schedule]
        await sut.loadData()

        // First log a dose
        await sut.logDose(scheduleItem: sut.todaysMedications[0])
        XCTAssertTrue(sut.todaysMedications[0].isTaken)

        // Then undo it
        await sut.undoDose(scheduleItem: sut.todaysMedications[0])

        XCTAssertTrue(mockMedRepo.deleteDoseCalled)
        XCTAssertTrue(sut.todaysMedications[0].isPending)
    }

    func testUndoDose_noDose_noOp() async throws {
        let med = TestFixtures.makeMedication(id: "med-1")
        let schedule = TestFixtures.makeSchedule(id: "s-1", medicationId: "med-1")
        mockMedRepo.medications = [med]
        mockMedRepo.schedules = [schedule]
        await sut.loadData()

        let item = sut.todaysMedications[0]
        await sut.undoDose(scheduleItem: item)

        XCTAssertFalse(mockMedRepo.deleteDoseCalled)
    }

    // MARK: - Yesterday Status

    func testLogYesterdayStatus_createsStatus() async throws {
        await sut.logYesterdayStatus(.green)

        XCTAssertNotNil(sut.yesterdayStatus)
        XCTAssertEqual(sut.yesterdayStatus?.status, .green)
        XCTAssertTrue(sut.yesterdayStatus!.prompted)
        XCTAssertTrue(mockStatusRepo.createStatusCalled)
    }

    func testLogYesterdayStatus_yellowWithType() async throws {
        await sut.logYesterdayStatus(.yellow, type: .prodrome, notes: "A little off")

        XCTAssertEqual(sut.yesterdayStatus?.status, .yellow)
        XCTAssertEqual(sut.yesterdayStatus?.statusType, .prodrome)
        XCTAssertEqual(sut.yesterdayStatus?.notes, "A little off")
    }

    func testUndoYesterdayStatus_removesStatus() async throws {
        await sut.logYesterdayStatus(.green)
        XCTAssertNotNil(sut.yesterdayStatus)

        await sut.undoYesterdayStatus()

        XCTAssertNil(sut.yesterdayStatus)
        XCTAssertTrue(mockStatusRepo.deleteStatusCalled)
    }

    func testUndoYesterdayStatus_noStatus_noOp() async throws {
        await sut.undoYesterdayStatus()

        XCTAssertFalse(mockStatusRepo.deleteStatusCalled)
    }
}
