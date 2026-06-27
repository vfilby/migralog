import XCTest
@testable import MigraLog

@MainActor
final class OnboardingChecklistViewModelTests: XCTestCase {
    private var episodeRepo: MockEpisodeRepository!
    private var medRepo: MockMedicationRepository!
    private var statusRepo: MockDailyStatusRepository!
    private var defaults: UserDefaults!
    private var suiteName: String!

    override func setUp() {
        super.setUp()
        episodeRepo = MockEpisodeRepository()
        medRepo = MockMedicationRepository()
        statusRepo = MockDailyStatusRepository()
        // Isolated UserDefaults per test so dismissed/visited flags don't leak.
        suiteName = "onboarding-tests-\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suiteName)
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suiteName)
        super.tearDown()
    }

    private func makeSUT() -> OnboardingChecklistViewModel {
        OnboardingChecklistViewModel(
            episodeRepository: episodeRepo,
            medicationRepository: medRepo,
            dailyStatusRepository: statusRepo,
            defaults: defaults
        )
    }

    // MARK: - Fresh user

    func testFreshUser_showsCardWithAllItemsIncomplete() {
        let sut = makeSUT()
        sut.refresh()

        XCTAssertTrue(sut.shouldShow)
        XCTAssertEqual(sut.completedCount, 0)
        // Trends is locked with no episodes, so the count excludes it.
        XCTAssertEqual(sut.totalCount, 4)
        for item in OnboardingChecklistViewModel.Item.allCases {
            XCTAssertFalse(sut.isCompleted(item), "\(item) should start incomplete")
        }
    }

    // MARK: - Item completion is derived from data

    func testFirstEpisode_completesWhenAnEpisodeExists() {
        episodeRepo.episodes = [TestFixtures.makeEpisode(id: "ep-1")]
        let sut = makeSUT()
        sut.refresh()

        XCTAssertTrue(sut.isCompleted(.firstEpisode))
    }

    func testPreventativeAndRescue_completeFromMedicationType() {
        medRepo.medications = [
            TestFixtures.makeMedication(id: "prev", type: .preventative, category: nil),
            TestFixtures.makeMedication(id: "resc", type: .rescue)
        ]
        let sut = makeSUT()
        sut.refresh()

        XCTAssertTrue(sut.isCompleted(.preventative))
        XCTAssertTrue(sut.isCompleted(.rescue))
    }

    func testRescueIncomplete_whenOnlyPreventativeAdded() {
        medRepo.medications = [
            TestFixtures.makeMedication(id: "prev", type: .preventative, category: nil)
        ]
        let sut = makeSUT()
        sut.refresh()

        XCTAssertTrue(sut.isCompleted(.preventative))
        XCTAssertFalse(sut.isCompleted(.rescue))
    }

    func testTrackDay_completesOnlyWithExplicitDailyStatus() {
        statusRepo.statuses = [TestFixtures.makeDailyStatus(id: "ds-1", date: "2025-06-01", status: .green)]
        let sut = makeSUT()
        sut.refresh()

        XCTAssertTrue(sut.isCompleted(.trackDay))
    }

    func testTrackDay_notCompletedByEpisodesAlone() {
        // Episodes drive the calendar's red days on the fly but never write a
        // DailyStatusLog, so "Track a day" must stay incomplete.
        episodeRepo.episodes = [TestFixtures.makeEpisode(id: "ep-1")]
        let sut = makeSUT()
        sut.refresh()

        XCTAssertTrue(sut.isCompleted(.firstEpisode))
        XCTAssertFalse(sut.isCompleted(.trackDay))
    }

    // MARK: - Trends gating

    func testTrends_lockedBelowThreshold() {
        episodeRepo.episodes = (1...2).map { TestFixtures.makeEpisode(id: "ep-\($0)") }
        let sut = makeSUT()
        sut.refresh()

        XCTAssertFalse(sut.isUnlocked(.trends))
        XCTAssertEqual(sut.totalCount, 4)
        XCTAssertNotNil(sut.lockHint(for: .trends))
    }

    func testTrends_unlocksAtThresholdAndIsCounted() {
        episodeRepo.episodes = (1...OnboardingChecklistViewModel.trendsUnlockThreshold)
            .map { TestFixtures.makeEpisode(id: "ep-\($0)") }
        let sut = makeSUT()
        sut.refresh()

        XCTAssertTrue(sut.isUnlocked(.trends))
        XCTAssertEqual(sut.totalCount, 5)
        XCTAssertNil(sut.lockHint(for: .trends))
        // Unlocked but not yet visited.
        XCTAssertFalse(sut.isCompleted(.trends))
    }

    func testMarkTrendsVisited_completesAndPersists() {
        episodeRepo.episodes = (1...OnboardingChecklistViewModel.trendsUnlockThreshold)
            .map { TestFixtures.makeEpisode(id: "ep-\($0)") }
        let sut = makeSUT()
        sut.refresh()

        sut.markTrendsVisited()
        XCTAssertTrue(sut.isCompleted(.trends))

        // Persisted across instances.
        let reloaded = makeSUT()
        reloaded.refresh()
        XCTAssertTrue(reloaded.isCompleted(.trends))
    }

    // MARK: - Dismiss & auto-retire

    func testDismiss_hidesCardAndPersists() {
        let sut = makeSUT()
        sut.refresh()
        XCTAssertTrue(sut.shouldShow)

        sut.dismiss()
        XCTAssertFalse(sut.shouldShow)

        let reloaded = makeSUT()
        reloaded.refresh()
        XCTAssertFalse(reloaded.shouldShow)
    }

    func testAutoRetire_whenAllUnlockedItemsComplete() {
        // All four early items done, still below the trends threshold.
        episodeRepo.episodes = [TestFixtures.makeEpisode(id: "ep-1")]
        medRepo.medications = [
            TestFixtures.makeMedication(id: "prev", type: .preventative, category: nil),
            TestFixtures.makeMedication(id: "resc", type: .rescue)
        ]
        statusRepo.statuses = [TestFixtures.makeDailyStatus(id: "ds-1", date: "2025-06-01")]
        let sut = makeSUT()
        sut.refresh()

        XCTAssertTrue(sut.isDismissed)
        XCTAssertFalse(sut.shouldShow)
    }

    func testRetire_isStickyWhenTrendsLaterUnlocks() {
        // Finish the four early items at one episode → card retires.
        episodeRepo.episodes = [TestFixtures.makeEpisode(id: "ep-1")]
        medRepo.medications = [
            TestFixtures.makeMedication(id: "prev", type: .preventative, category: nil),
            TestFixtures.makeMedication(id: "resc", type: .rescue)
        ]
        statusRepo.statuses = [TestFixtures.makeDailyStatus(id: "ds-1", date: "2025-06-01")]
        let sut = makeSUT()
        sut.refresh()
        XCTAssertFalse(sut.shouldShow)

        // More episodes arrive, unlocking trends — the card must not resurrect.
        episodeRepo.episodes = (1...OnboardingChecklistViewModel.trendsUnlockThreshold)
            .map { TestFixtures.makeEpisode(id: "ep-\($0)") }
        sut.refresh()
        XCTAssertFalse(sut.shouldShow)
    }
}
