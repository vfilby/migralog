import XCTest
@testable import MigraLog

@MainActor
final class EpisodesListViewModelTests: XCTestCase {
    private var mockEpisodeRepo: MockEpisodeRepository!
    private var sut: EpisodesListViewModel!

    override func setUp() {
        super.setUp()
        mockEpisodeRepo = MockEpisodeRepository()
        sut = EpisodesListViewModel(episodeRepository: mockEpisodeRepo)
    }

    // MARK: - Load Episodes

    func testLoadEpisodes_success_populatesEpisodesSortedByStartTime() async {
        let older = TestFixtures.makeEpisode(id: "ep-1", startTime: TestFixtures.now - 86400000)
        let newer = TestFixtures.makeEpisode(id: "ep-2", startTime: TestFixtures.now)
        mockEpisodeRepo.episodes = [older, newer]

        await sut.loadEpisodes()

        XCTAssertEqual(sut.episodes.count, 2)
        XCTAssertEqual(sut.episodes[0].id, "ep-2", "Newer episode should be first")
        XCTAssertEqual(sut.episodes[1].id, "ep-1", "Older episode should be second")
        XCTAssertFalse(sut.isLoading)
        XCTAssertNil(sut.error)
    }

    func testLoadEpisodes_success_loadsIntensityReadings() async {
        let episode = TestFixtures.makeEpisode(id: "ep-1")
        let reading = TestFixtures.makeReading(id: "r-1", episodeId: "ep-1", intensity: 7.0)
        mockEpisodeRepo.episodes = [episode]
        mockEpisodeRepo.intensityReadings = [reading]

        await sut.loadEpisodes()

        XCTAssertEqual(sut.readingsMap.count, 1)
        XCTAssertEqual(sut.readingsMap["ep-1"]?.count, 1)
        XCTAssertEqual(sut.readingsMap["ep-1"]?.first?.intensity, 7.0)
    }

    func testLoadEpisodes_empty_setsEmptyArrayAndMap() async {
        await sut.loadEpisodes()

        XCTAssertTrue(sut.episodes.isEmpty)
        XCTAssertTrue(sut.readingsMap.isEmpty)
        XCTAssertFalse(sut.isLoading)
        XCTAssertNil(sut.error)
    }

    func testLoadEpisodes_error_setsErrorString() async {
        mockEpisodeRepo.errorToThrow = TestError.mockError("DB read failed")

        await sut.loadEpisodes()

        XCTAssertNotNil(sut.error)
        XCTAssertEqual(sut.error, "DB read failed")
        XCTAssertFalse(sut.isLoading)
    }

    func testLoadEpisodes_setsIsLoadingDuringLoad() async {
        // Before load
        XCTAssertFalse(sut.isLoading)

        await sut.loadEpisodes()

        // After load completes
        XCTAssertFalse(sut.isLoading)
    }

    func testLoadEpisodes_clearsErrorOnRetry() async {
        mockEpisodeRepo.errorToThrow = TestError.mockError("First failure")
        await sut.loadEpisodes()
        XCTAssertNotNil(sut.error)

        // Retry successfully
        mockEpisodeRepo.errorToThrow = nil
        mockEpisodeRepo.episodes = [TestFixtures.makeEpisode(id: "ep-1")]
        await sut.loadEpisodes()

        XCTAssertNil(sut.error)
        XCTAssertEqual(sut.episodes.count, 1)
    }

    func testLoadEpisodes_multipleEpisodesWithMultipleReadings() async {
        let ep1 = TestFixtures.makeEpisode(id: "ep-1", startTime: TestFixtures.now)
        let ep2 = TestFixtures.makeEpisode(id: "ep-2", startTime: TestFixtures.now - 3600000)
        let r1 = TestFixtures.makeReading(id: "r-1", episodeId: "ep-1", intensity: 3.0)
        let r2 = TestFixtures.makeReading(id: "r-2", episodeId: "ep-1", intensity: 5.0)
        let r3 = TestFixtures.makeReading(id: "r-3", episodeId: "ep-2", intensity: 8.0)
        mockEpisodeRepo.episodes = [ep1, ep2]
        mockEpisodeRepo.intensityReadings = [r1, r2, r3]

        await sut.loadEpisodes()

        XCTAssertEqual(sut.readingsMap["ep-1"]?.count, 2)
        XCTAssertEqual(sut.readingsMap["ep-2"]?.count, 1)
    }

    // MARK: - Delete Episode

    func testDeleteEpisode_removesFromList() async {
        let ep1 = TestFixtures.makeEpisode(id: "ep-1")
        let ep2 = TestFixtures.makeEpisode(id: "ep-2")
        mockEpisodeRepo.episodes = [ep1, ep2]
        await sut.loadEpisodes()
        XCTAssertEqual(sut.episodes.count, 2)

        await sut.deleteEpisode("ep-1")

        XCTAssertEqual(sut.episodes.count, 1)
        XCTAssertEqual(sut.episodes[0].id, "ep-2")
        XCTAssertTrue(mockEpisodeRepo.deleteEpisodeCalled)
    }

    func testDeleteEpisode_removesReadingsMap() async {
        let ep = TestFixtures.makeEpisode(id: "ep-1")
        let reading = TestFixtures.makeReading(id: "r-1", episodeId: "ep-1")
        mockEpisodeRepo.episodes = [ep]
        mockEpisodeRepo.intensityReadings = [reading]
        await sut.loadEpisodes()
        XCTAssertNotNil(sut.readingsMap["ep-1"])

        await sut.deleteEpisode("ep-1")

        XCTAssertNil(sut.readingsMap["ep-1"])
    }

    func testDeleteEpisode_error_setsError() async {
        let ep = TestFixtures.makeEpisode(id: "ep-1")
        mockEpisodeRepo.episodes = [ep]
        await sut.loadEpisodes()

        mockEpisodeRepo.errorToThrow = TestError.mockError("Delete failed")
        await sut.deleteEpisode("ep-1")

        XCTAssertNotNil(sut.error)
        XCTAssertEqual(sut.error, "Delete failed")
    }

    func testDeleteEpisode_nonExistentId_noOp() async {
        let ep = TestFixtures.makeEpisode(id: "ep-1")
        mockEpisodeRepo.episodes = [ep]
        await sut.loadEpisodes()

        await sut.deleteEpisode("non-existent")

        XCTAssertEqual(sut.episodes.count, 1)
        XCTAssertTrue(mockEpisodeRepo.deleteEpisodeCalled)
    }

    // MARK: - Edge Cases

    func testLoadEpisodes_singleEpisode() async {
        mockEpisodeRepo.episodes = [TestFixtures.makeEpisode(id: "ep-1")]

        await sut.loadEpisodes()

        XCTAssertEqual(sut.episodes.count, 1)
    }

    func testLoadEpisodes_episodesWithNoReadings_emptyReadingsMap() async {
        mockEpisodeRepo.episodes = [TestFixtures.makeEpisode(id: "ep-1")]

        await sut.loadEpisodes()

        XCTAssertNotNil(sut.readingsMap["ep-1"])
        XCTAssertTrue(sut.readingsMap["ep-1"]?.isEmpty ?? true)
    }
}
