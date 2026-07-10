import XCTest
@testable import MigraLog

@MainActor
final class DashboardViewModelTests: XCTestCase {
    private var mockEpisodeRepo: MockEpisodeRepository!
    private var mockMedRepo: MockMedicationRepository!
    private var mockStatusRepo: MockDailyStatusRepository!
    private var mockCategoryLimitRepo: MockCategorySafetyRuleRepository!
    private var sut: DashboardViewModel!

    override func setUp() {
        super.setUp()
        mockEpisodeRepo = MockEpisodeRepository()
        mockMedRepo = MockMedicationRepository()
        mockStatusRepo = MockDailyStatusRepository()
        mockCategoryLimitRepo = MockCategorySafetyRuleRepository()
        sut = DashboardViewModel(
            episodeRepository: mockEpisodeRepo,
            medicationRepository: mockMedRepo,
            dailyStatusRepository: mockStatusRepo,
            categoryLimitRepository: mockCategoryLimitRepo,
            doseLogger: MedicationDoseLogger(
                medicationRepo: mockMedRepo,
                notificationService: MockMedicationNotificationService()
            )
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

    // MARK: - Category Usage

    func testLoadData_populatesCategoryUsageForMedsWithLimit() async throws {
        let med = TestFixtures.makeMedication(id: "med-1", category: .nsaid)
        let schedule = TestFixtures.makeSchedule(id: "s-1", medicationId: "med-1")
        mockMedRepo.medications = [med]
        mockMedRepo.schedules = [schedule]
        let rule = CategorySafetyRule(
            id: "r1", category: .nsaid, type: .periodLimit,
            periodHours: 720, maxCount: 15, createdAt: Date()
        )
        try? mockCategoryLimitRepo.upsert(rule)
        mockCategoryLimitRepo.dayCounts[.nsaid] = 14  // approaching

        await sut.loadData()

        XCTAssertEqual(sut.categoryUsage[.nsaid], .approaching(daysUsed: 14, maxDays: 15, windowDays: 30))
    }

    func testLoadData_noLimitConfigured_categoryUsageEmpty() async throws {
        let med = TestFixtures.makeMedication(id: "med-1", category: .nsaid)
        let schedule = TestFixtures.makeSchedule(id: "s-1", medicationId: "med-1")
        mockMedRepo.medications = [med]
        mockMedRepo.schedules = [schedule]
        // No limit configured

        await sut.loadData()

        XCTAssertNil(sut.categoryUsage[.nsaid])
    }

    // MARK: - Ordering & schedule time display

    func testLoadData_ordersMedicationsByScheduleTime() async throws {
        // Alphabetical name order (Aaa, Zzz) is the opposite of schedule-time
        // order (Zzz @ 08:00, Aaa @ 20:00), so a correct result proves we sort
        // by time rather than by name.
        let evening = TestFixtures.makeMedication(id: "med-a", name: "Aaa")
        let morning = TestFixtures.makeMedication(id: "med-z", name: "Zzz")
        mockMedRepo.medications = [evening, morning]
        mockMedRepo.schedules = [
            TestFixtures.makeSchedule(id: "s-a", medicationId: "med-a", time: "20:00"),
            TestFixtures.makeSchedule(id: "s-z", medicationId: "med-z", time: "08:00"),
        ]

        await sut.loadData()

        XCTAssertEqual(sut.todaysMedications.map(\.schedule.time), ["08:00", "20:00"])
        XCTAssertEqual(sut.todaysMedications.map(\.medication.name), ["Zzz", "Aaa"])
    }

    func testLoadData_multipleSchedulesForMed_showScheduleTimeOnlyForThatMed() async throws {
        let twice = TestFixtures.makeMedication(id: "med-twice", name: "Topiramate")
        let once = TestFixtures.makeMedication(id: "med-once", name: "Amitriptyline")
        mockMedRepo.medications = [twice, once]
        mockMedRepo.schedules = [
            TestFixtures.makeSchedule(id: "s-t1", medicationId: "med-twice", time: "08:00"),
            TestFixtures.makeSchedule(id: "s-t2", medicationId: "med-twice", time: "20:00"),
            TestFixtures.makeSchedule(id: "s-o1", medicationId: "med-once", time: "12:00"),
        ]

        await sut.loadData()

        let flags = Dictionary(
            uniqueKeysWithValues: sut.todaysMedications.map { ($0.schedule.id, $0.showScheduleTime) }
        )
        // The twice-daily med surfaces its time on both rows; the once-daily med does not.
        XCTAssertEqual(flags["s-t1"], true)
        XCTAssertEqual(flags["s-t2"], true)
        XCTAssertEqual(flags["s-o1"], false)
    }

    // MARK: - Per-schedule dose matching (issue #592)

    /// Local timestamp for today at the given hour/minute, so the mock's
    /// today-range dose fetch includes it.
    private func todayAt(_ hour: Int, _ minute: Int = 0) -> Int64 {
        let calendar = Calendar.current
        let date = calendar.date(
            bySettingHour: hour, minute: minute, second: 0,
            of: calendar.startOfDay(for: Date())
        )!
        return TimestampHelper.fromDate(date)
    }

    func testLoadData_multiScheduleMed_oneDose_marksOnlyNearestRowTaken() async throws {
        // Twice-daily med; only the morning dose is logged. The evening row must
        // stay pending rather than flipping to taken with it.
        let med = TestFixtures.makeMedication(id: "med-1", name: "Topiramate")
        mockMedRepo.medications = [med]
        mockMedRepo.schedules = [
            TestFixtures.makeSchedule(id: "s-am", medicationId: "med-1", time: "08:00"),
            TestFixtures.makeSchedule(id: "s-pm", medicationId: "med-1", time: "20:00"),
        ]
        mockMedRepo.doses = [
            TestFixtures.makeDose(id: "d-am", medicationId: "med-1", timestamp: todayAt(8, 5), status: .taken),
        ]

        await sut.loadData()

        let byId = Dictionary(uniqueKeysWithValues: sut.todaysMedications.map { ($0.schedule.id, $0) })
        XCTAssertEqual(byId["s-am"]?.isTaken, true)
        XCTAssertEqual(byId["s-pm"]?.isPending, true)
    }

    func testLoadData_multiScheduleMed_bothDoses_markBothRowsByTime() async throws {
        let med = TestFixtures.makeMedication(id: "med-1", name: "Topiramate")
        mockMedRepo.medications = [med]
        mockMedRepo.schedules = [
            TestFixtures.makeSchedule(id: "s-am", medicationId: "med-1", time: "08:00"),
            TestFixtures.makeSchedule(id: "s-pm", medicationId: "med-1", time: "20:00"),
        ]
        // Evening dose was skipped, morning taken — each must land on its own row.
        mockMedRepo.doses = [
            TestFixtures.makeDose(id: "d-am", medicationId: "med-1", timestamp: todayAt(7, 45), status: .taken),
            TestFixtures.makeDose(id: "d-pm", medicationId: "med-1", timestamp: todayAt(21, 0), status: .skipped),
        ]

        await sut.loadData()

        let byId = Dictionary(uniqueKeysWithValues: sut.todaysMedications.map { ($0.schedule.id, $0) })
        XCTAssertEqual(byId["s-am"]?.dose?.id, "d-am")
        XCTAssertEqual(byId["s-am"]?.isTaken, true)
        XCTAssertEqual(byId["s-pm"]?.dose?.id, "d-pm")
        XCTAssertEqual(byId["s-pm"]?.isSkipped, true)
    }

    func testMatchDosesToSchedules_bindsClosestFirstAndUsesEachOnce() {
        let schedules = [
            TestFixtures.makeSchedule(id: "s-am", medicationId: "med-1", time: "08:00"),
            TestFixtures.makeSchedule(id: "s-pm", medicationId: "med-1", time: "20:00"),
        ]
        let doses = [
            TestFixtures.makeDose(id: "d-pm", medicationId: "med-1", timestamp: todayAt(19, 30)),
            TestFixtures.makeDose(id: "d-am", medicationId: "med-1", timestamp: todayAt(8, 30)),
        ]

        let result = DashboardViewModel.matchDosesToSchedules(schedules: schedules, doses: doses)

        XCTAssertEqual(result["s-am"]?.id, "d-am")
        XCTAssertEqual(result["s-pm"]?.id, "d-pm")
    }

    func testMatchDosesToSchedules_fewerDosesThanSchedules_leavesExtraRowUnmatched() {
        let schedules = [
            TestFixtures.makeSchedule(id: "s-am", medicationId: "med-1", time: "08:00"),
            TestFixtures.makeSchedule(id: "s-pm", medicationId: "med-1", time: "20:00"),
        ]
        let doses = [
            TestFixtures.makeDose(id: "d-1", medicationId: "med-1", timestamp: todayAt(19, 45)),
        ]

        let result = DashboardViewModel.matchDosesToSchedules(schedules: schedules, doses: doses)

        XCTAssertNil(result["s-am"])
        XCTAssertEqual(result["s-pm"]?.id, "d-1")
    }
}
