import XCTest
@testable import MigraLog

@MainActor
final class EpisodeDetailViewModelTests: XCTestCase {
    private var mockRepo: MockEpisodeRepository!
    private var sut: EpisodeDetailViewModel!
    private var testEpisode: Episode!

    override func setUp() {
        super.setUp()
        mockRepo = MockEpisodeRepository()
        testEpisode = TestFixtures.makeEpisode(id: "ep-1")
        mockRepo.episodes = [testEpisode]
        mockRepo.intensityReadings = [
            TestFixtures.makeReading(id: "r-1", episodeId: "ep-1", intensity: 6.0)
        ]
        sut = EpisodeDetailViewModel(episodeId: "ep-1", episodeRepository: mockRepo)
    }

    // MARK: - Load

    func testLoadEpisode_populatesDetails() async throws {
        await sut.loadEpisode()

        XCTAssertNotNil(sut.details)
        XCTAssertEqual(sut.episode?.id, "ep-1")
        XCTAssertEqual(sut.intensityReadings.count, 1)
        XCTAssertFalse(sut.isLoading)
        XCTAssertNil(sut.error)
        XCTAssertTrue(mockRepo.getEpisodeByIdCalled)
    }

    func testLoadEpisode_notFound_detailsNil() async throws {
        sut = EpisodeDetailViewModel(episodeId: "nonexistent", episodeRepository: mockRepo)
        await sut.loadEpisode()

        XCTAssertNil(sut.details)
        XCTAssertFalse(sut.isLoading)
    }

    func testLoadEpisode_error_setsError() async throws {
        mockRepo.errorToThrow = TestError.mockError("DB error")
        await sut.loadEpisode()

        XCTAssertNil(sut.details)
        XCTAssertNotNil(sut.error)
        XCTAssertFalse(sut.isLoading)
    }

    // MARK: - End Episode

    func testEndEpisode_setsEndTime() async throws {
        await sut.loadEpisode()
        XCTAssertTrue(sut.episode!.isActive)

        await sut.endEpisode()

        XCTAssertNotNil(sut.episode?.endTime)
        XCTAssertFalse(sut.episode!.isActive)
        XCTAssertTrue(mockRepo.updateEpisodeCalled)
    }

    func testEndEpisode_alreadyEnded_noOp() async throws {
        mockRepo.episodes = [TestFixtures.makeEpisode(id: "ep-1", endTime: TimestampHelper.now)]
        await sut.loadEpisode()

        await sut.endEpisode()

        // Should not call update since episode is already ended
        XCTAssertFalse(mockRepo.updateEpisodeCalled)
    }

    // MARK: - Reopen Episode

    func testReopenEpisode_clearsEndTime() async throws {
        mockRepo.episodes = [TestFixtures.makeEpisode(id: "ep-1", endTime: TimestampHelper.now)]
        await sut.loadEpisode()
        XCTAssertFalse(sut.episode!.isActive)

        await sut.reopenEpisode()

        XCTAssertNil(sut.episode?.endTime)
        XCTAssertTrue(sut.episode!.isActive)
        XCTAssertTrue(mockRepo.updateEpisodeCalled)
    }

    func testReopenEpisode_alreadyActive_noOp() async throws {
        await sut.loadEpisode()
        XCTAssertTrue(sut.episode!.isActive)

        await sut.reopenEpisode()

        XCTAssertFalse(mockRepo.updateEpisodeCalled)
    }

    // MARK: - Add Intensity Reading

    func testAddIntensityReading_addsToDetails() async throws {
        await sut.loadEpisode()
        let initialCount = sut.intensityReadings.count

        await sut.addIntensityReading(intensity: 8.0)

        XCTAssertEqual(sut.intensityReadings.count, initialCount + 1)
        XCTAssertEqual(sut.intensityReadings.last?.intensity, 8.0)
        XCTAssertTrue(mockRepo.createIntensityReadingCalled)
    }

    func testAddIntensityReading_customTimestamp() async throws {
        await sut.loadEpisode()
        let ts: Int64 = 1700000000000

        await sut.addIntensityReading(intensity: 3.0, timestamp: ts)

        let reading = sut.intensityReadings.first { $0.timestamp == ts }
        XCTAssertNotNil(reading)
        XCTAssertEqual(reading?.intensity, 3.0)
    }

    // MARK: - Update Reading

    func testUpdateReading_updatesInDetails() async throws {
        await sut.loadEpisode()
        var reading = sut.intensityReadings[0]
        reading.intensity = 9.0

        await sut.updateReading(reading)

        XCTAssertEqual(sut.intensityReadings[0].intensity, 9.0)
        XCTAssertTrue(mockRepo.updateIntensityReadingCalled)
    }

    // MARK: - Delete Reading

    func testDeleteReading_removesFromDetails() async throws {
        await sut.loadEpisode()
        let readingId = sut.intensityReadings[0].id

        await sut.deleteReading(readingId)

        XCTAssertTrue(sut.intensityReadings.isEmpty)
        XCTAssertTrue(mockRepo.deleteIntensityReadingCalled)
    }

    // MARK: - Symptom Logs

    func testAddSymptomLog_addsToDetails() async throws {
        await sut.loadEpisode()

        await sut.addSymptomLog(symptom: .nausea, severity: 7.0)

        XCTAssertEqual(sut.symptomLogs.count, 1)
        XCTAssertEqual(sut.symptomLogs.first?.symptom, .nausea)
        XCTAssertTrue(mockRepo.createSymptomLogCalled)
    }

    func testDeleteSymptomLog_removesFromDetails() async throws {
        let log = SymptomLog(
            id: "sl-1", episodeId: "ep-1", symptom: .aura,
            onsetTime: TimestampHelper.now, resolutionTime: nil,
            severity: nil, createdAt: TimestampHelper.now
        )
        mockRepo.symptomLogs = [log]
        await sut.loadEpisode()

        await sut.deleteSymptomLog("sl-1")

        XCTAssertTrue(sut.symptomLogs.isEmpty)
        XCTAssertTrue(mockRepo.deleteSymptomLogCalled)
    }

    // MARK: - Episode Notes

    func testAddEpisodeNote_addsToDetails() async throws {
        await sut.loadEpisode()

        await sut.addEpisodeNote(note: "Felt better after rest")

        XCTAssertEqual(sut.episodeNotes.count, 1)
        XCTAssertEqual(sut.episodeNotes.first?.note, "Felt better after rest")
        XCTAssertTrue(mockRepo.createEpisodeNoteCalled)
    }

    func testDeleteNote_removesFromDetails() async throws {
        let note = EpisodeNote(
            id: "n-1", episodeId: "ep-1",
            timestamp: TimestampHelper.now,
            note: "Test note", createdAt: TimestampHelper.now
        )
        mockRepo.episodeNotes = [note]
        await sut.loadEpisode()

        await sut.deleteNote("n-1")

        XCTAssertTrue(sut.episodeNotes.isEmpty)
        XCTAssertTrue(mockRepo.deleteEpisodeNoteCalled)
    }

    // MARK: - Pain Location Logs

    func testAddPainLocationLog_addsToDetails() async throws {
        await sut.loadEpisode()

        await sut.addPainLocationLog(locations: [.leftTemple, .rightTemple])

        XCTAssertEqual(sut.painLocationLogs.count, 1)
        XCTAssertEqual(sut.painLocationLogs.first?.painLocations, [.leftTemple, .rightTemple])
        XCTAssertTrue(mockRepo.createPainLocationLogCalled)
    }
}
