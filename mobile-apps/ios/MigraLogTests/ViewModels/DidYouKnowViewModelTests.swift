import XCTest
@testable import MigraLog

final class TipSelectionTests: XCTestCase {
    func testNewUser_noTip() {
        // Nothing logged yet → the slot is empty (tips are surgical, not a daily
        // rotation; setup is handled by the checklist).
        XCTAssertNil(Tip.select(context: TipContext(), dismissed: []))
    }

    func testEpisodeButNoTrackedDay_picksTrackADay() {
        let ctx = TipContext(episodeCount: 1)
        XCTAssertEqual(Tip.select(context: ctx, dismissed: []), .trackADay)
    }

    func testTrackADayWinsOverTrends_whenBothEligible() {
        // 3 episodes (trends eligible) but never tracked a day → trackADay first.
        let ctx = TipContext(episodeCount: Tip.trendsEpisodeThreshold)
        XCTAssertEqual(Tip.select(context: ctx, dismissed: []), .trackADay)
    }

    func testThreeEpisodesAndTracked_picksSeeTrends() {
        let ctx = TipContext(episodeCount: Tip.trendsEpisodeThreshold, hasTrackedDay: true)
        XCTAssertEqual(Tip.select(context: ctx, dismissed: []), .seeTrends)
    }

    func testThirtyDaysHistory_picksDoctorSummary() {
        // Tracked + only 1 episode → trackADay and seeTrends both ineligible.
        let ctx = TipContext(episodeCount: 1, hasTrackedDay: true, daysOfHistory: Tip.doctorSummaryDayThreshold)
        XCTAssertEqual(Tip.select(context: ctx, dismissed: []), .doctorSummary)
    }

    func testDismissedTipExcluded() {
        let ctx = TipContext(episodeCount: Tip.trendsEpisodeThreshold)
        XCTAssertEqual(Tip.select(context: ctx, dismissed: ["trackADay"]), .seeTrends)
    }
}

@MainActor
final class DidYouKnowViewModelTests: XCTestCase {
    private var episodeRepo: MockEpisodeRepository!
    private var statusRepo: MockDailyStatusRepository!
    private var defaults: UserDefaults!
    private var suiteName: String!

    override func setUp() {
        super.setUp()
        episodeRepo = MockEpisodeRepository()
        statusRepo = MockDailyStatusRepository()
        suiteName = "didyouknow-tests-\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suiteName)
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suiteName)
        super.tearDown()
    }

    private func makeSUT(today: @escaping () -> String = { "2026-06-26" }) -> DidYouKnowViewModel {
        DidYouKnowViewModel(
            episodeRepository: episodeRepo,
            dailyStatusRepository: statusRepo,
            defaults: defaults,
            today: today
        )
    }

    private func episode(daysAgo: Int) -> Episode {
        let ms = TimestampHelper.now - Int64(daysAgo) * 24 * 60 * 60 * 1000
        return TestFixtures.makeEpisode(id: "ep-\(daysAgo)-\(UUID().uuidString)", startTime: ms)
    }

    func testNewUser_noTip() {
        let sut = makeSUT()
        sut.refresh()
        XCTAssertNil(sut.currentTip)
    }

    func testContextDerivation_picksTrackADay() {
        episodeRepo.episodes = [episode(daysAgo: 1)]
        let sut = makeSUT()
        sut.refresh()
        XCTAssertEqual(sut.currentTip, .trackADay)
    }

    func testDismiss_notReplacedSameDay_thenNextDayShowsNext() {
        // Episode 31 days old, no tracked day → trackADay + doctorSummary eligible.
        episodeRepo.episodes = [episode(daysAgo: 31)]
        var day = "2026-06-26"
        let sut = makeSUT(today: { day })
        sut.refresh()
        XCTAssertEqual(sut.currentTip, .trackADay)

        // Dismiss → slot stays empty the rest of today (no same-day replacement).
        sut.dismiss(.trackADay)
        XCTAssertNil(sut.currentTip)
        sut.refresh()
        XCTAssertNil(sut.currentTip)

        // Next day → the next eligible tip surfaces.
        day = "2026-06-27"
        sut.refresh()
        XCTAssertEqual(sut.currentTip, .doctorSummary)
    }

    func testRegisterAction_dismissesSeeTrends() {
        episodeRepo.episodes = (1...Tip.trendsEpisodeThreshold).map { _ in episode(daysAgo: 1) }
        statusRepo.statuses = [TestFixtures.makeDailyStatus(id: "d", date: "2026-06-01")]
        let sut = makeSUT()
        sut.refresh()
        XCTAssertEqual(sut.currentTip, .seeTrends)

        sut.registerAction(on: .seeTrends)
        XCTAssertTrue(sut.isDismissed(.seeTrends))
    }

    func testRestore_liftsDismissAndDailyCap() {
        episodeRepo.episodes = [episode(daysAgo: 1)]
        let sut = makeSUT()
        sut.refresh()
        sut.dismiss(.trackADay)
        XCTAssertTrue(sut.isDismissed(.trackADay))

        sut.restore(.trackADay)
        XCTAssertFalse(sut.isDismissed(.trackADay))
        // Cap lifted → tip shows again immediately on refresh.
        sut.refresh()
        XCTAssertEqual(sut.currentTip, .trackADay)
    }

    func testRestoreAll() {
        let sut = makeSUT()
        sut.dismiss(.trackADay)
        sut.dismiss(.seeTrends)
        XCTAssertTrue(sut.hasDismissedTips)

        sut.restoreAll()
        XCTAssertFalse(sut.hasDismissedTips)
    }
}
