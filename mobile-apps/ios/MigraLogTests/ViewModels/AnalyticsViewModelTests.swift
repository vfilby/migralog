import XCTest
@testable import MigraLog

@MainActor
final class AnalyticsViewModelTests: XCTestCase {
    private var mockEpisodeRepo: MockEpisodeRepository!
    private var mockStatusRepo: MockDailyStatusRepository!
    private var mockMedicationRepo: MockMedicationRepository!
    private var sut: AnalyticsViewModel!

    override func setUp() {
        super.setUp()
        // Clear cache between tests
        CacheManager.shared.clearAll()

        mockEpisodeRepo = MockEpisodeRepository()
        mockStatusRepo = MockDailyStatusRepository()
        mockMedicationRepo = MockMedicationRepository()
        sut = AnalyticsViewModel(
            episodeRepository: mockEpisodeRepo,
            dailyStatusRepository: mockStatusRepo,
            medicationRepository: mockMedicationRepo
        )
    }

    override func tearDown() {
        CacheManager.shared.clearAll()
        super.tearDown()
    }

    // MARK: - Set Date Range

    func testSetDateRange_updatesSelectedRange() async throws {
        await sut.setDateRange(.sevenDays)

        XCTAssertEqual(sut.selectedRange, .sevenDays)
    }

    func testSetDateRange_fetchesData() async throws {
        let ep = TestFixtures.makeEpisode(id: "ep-1", startTime: TimestampHelper.now - 86400000)
        mockEpisodeRepo.episodes = [ep]
        mockEpisodeRepo.intensityReadings = [
            TestFixtures.makeReading(episodeId: "ep-1", intensity: 7.0, timestamp: TimestampHelper.now - 86400000)
        ]

        await sut.setDateRange(.sevenDays)

        XCTAssertEqual(sut.episodes.count, 1)
        XCTAssertFalse(sut.isLoading)
    }

    func testSetDateRange_thirtyDays_default() async throws {
        XCTAssertEqual(sut.selectedRange, .thirtyDays)
    }

    // MARK: - Fetch Data

    func testFetchData_populatesState() async throws {
        let now = TimestampHelper.now
        let ep = TestFixtures.makeEpisode(id: "ep-1", startTime: now - 3600000)
        mockEpisodeRepo.episodes = [ep]
        mockEpisodeRepo.intensityReadings = [
            TestFixtures.makeReading(episodeId: "ep-1", intensity: 5.0, timestamp: now - 3600000)
        ]
        let status = TestFixtures.makeDailyStatus(
            date: TimestampHelper.dateString(),
            status: .red
        )
        mockStatusRepo.statuses = [status]

        await sut.fetchData()

        XCTAssertEqual(sut.episodes.count, 1)
        XCTAssertEqual(sut.intensityReadings.count, 1)
        XCTAssertFalse(sut.dayStats.isEmpty)
        XCTAssertFalse(sut.isLoading)
        XCTAssertNil(sut.error)
    }

    func testFetchData_emptyData() async throws {
        await sut.fetchData()

        XCTAssertTrue(sut.episodes.isEmpty)
        XCTAssertTrue(sut.intensityReadings.isEmpty)
        XCTAssertFalse(sut.isLoading)
    }

    func testFetchData_error_setsError() async throws {
        mockEpisodeRepo.errorToThrow = TestError.mockError("DB error")

        await sut.fetchData()

        XCTAssertNotNil(sut.error)
        XCTAssertFalse(sut.isLoading)
    }

    // MARK: - Cache

    func testFetchData_usesCacheOnSecondCall() async throws {
        let ep = TestFixtures.makeEpisode(id: "ep-1", startTime: TimestampHelper.now - 3600000)
        mockEpisodeRepo.episodes = [ep]

        await sut.fetchData()
        XCTAssertEqual(sut.episodes.count, 1)

        // Add another episode to the repo
        mockEpisodeRepo.episodes.append(
            TestFixtures.makeEpisode(id: "ep-2", startTime: TimestampHelper.now - 7200000)
        )

        // Should return cached data (still 1 episode)
        await sut.fetchData()
        XCTAssertEqual(sut.episodes.count, 1)
    }

    func testRefreshData_invalidatesCache() async throws {
        let ep = TestFixtures.makeEpisode(id: "ep-1", startTime: TimestampHelper.now - 3600000)
        mockEpisodeRepo.episodes = [ep]

        await sut.fetchData()
        XCTAssertEqual(sut.episodes.count, 1)

        // Add another episode
        mockEpisodeRepo.episodes.append(
            TestFixtures.makeEpisode(id: "ep-2", startTime: TimestampHelper.now - 7200000)
        )

        // Refresh should bypass cache
        await sut.refreshData()
        XCTAssertEqual(sut.episodes.count, 2)
    }

    func testSetDateRange_differentRange_fetchesFresh() async throws {
        let ep = TestFixtures.makeEpisode(id: "ep-1", startTime: TimestampHelper.now - 3600000)
        mockEpisodeRepo.episodes = [ep]

        await sut.setDateRange(.sevenDays)
        XCTAssertEqual(sut.episodes.count, 1)

        // Switch to 90 days - different cache key
        mockEpisodeRepo.episodes.append(
            TestFixtures.makeEpisode(id: "ep-2", startTime: TimestampHelper.now - 7200000)
        )
        await sut.setDateRange(.ninetyDays)
        XCTAssertEqual(sut.episodes.count, 2)
    }

    // MARK: - Day Stats Computation

    func testDayStats_containsCorrectNumberOfDays() async throws {
        await sut.setDateRange(.sevenDays)

        // Should have roughly 7-8 days of stats (7 days back + today)
        XCTAssertGreaterThanOrEqual(sut.dayStats.count, 7)
        XCTAssertLessThanOrEqual(sut.dayStats.count, 9)
    }

    func testDayStats_includesStatusData() async throws {
        let today = TimestampHelper.dateString()
        mockStatusRepo.statuses = [
            TestFixtures.makeDailyStatus(date: today, status: .green)
        ]

        await sut.fetchData()

        let todayStat = sut.dayStats.first { $0.date == today }
        XCTAssertNotNil(todayStat)
        XCTAssertEqual(todayStat?.status, .green)
    }
}
