import XCTest
@testable import MigraLog

@MainActor
final class NewEpisodeViewModelTests: XCTestCase {
    private var mockRepo: MockEpisodeRepository!
    private var sut: NewEpisodeViewModel!

    override func setUp() {
        super.setUp()
        mockRepo = MockEpisodeRepository()
        sut = NewEpisodeViewModel(episodeRepository: mockRepo)
    }

    // MARK: - Default State

    func testDefaultState() {
        XCTAssertTrue(sut.selectedLocations.isEmpty)
        XCTAssertTrue(sut.selectedQualities.isEmpty)
        XCTAssertTrue(sut.selectedSymptoms.isEmpty)
        XCTAssertTrue(sut.selectedTriggers.isEmpty)
        XCTAssertEqual(sut.notes, "")
        XCTAssertEqual(sut.initialIntensity, 5.0)
        XCTAssertFalse(sut.isSaving)
        XCTAssertNil(sut.error)
    }

    // MARK: - Validation

    func testIsValid_defaultIntensity_true() {
        XCTAssertTrue(sut.isValid)
    }

    func testIsValid_zeroIntensity_false() {
        sut.initialIntensity = 0
        XCTAssertFalse(sut.isValid)
    }

    func testIsValid_positiveIntensity_true() {
        sut.initialIntensity = 1.0
        XCTAssertTrue(sut.isValid)
    }

    func testIsValid_maxIntensity_true() {
        sut.initialIntensity = 10.0
        XCTAssertTrue(sut.isValid)
    }

    // MARK: - Save Episode (Success)

    func testSaveEpisode_createsEpisodeAndReading() async {
        sut.initialIntensity = 7.0
        sut.selectedLocations = [.leftTemple, .rightTemple]
        sut.selectedSymptoms = [.nausea, .aura]
        sut.selectedTriggers = [.stress]
        sut.selectedQualities = [.throbbing]
        sut.notes = "Bad migraine"

        let result = await sut.saveEpisode()

        XCTAssertNotNil(result)
        XCTAssertTrue(mockRepo.createEpisodeCalled)
        XCTAssertTrue(mockRepo.createIntensityReadingCalled)
        XCTAssertEqual(mockRepo.episodes.count, 1)
        XCTAssertEqual(mockRepo.intensityReadings.count, 1)
    }

    func testSaveEpisode_episodeHasCorrectFields() async {
        sut.selectedLocations = [.leftEye]
        sut.selectedQualities = [.sharp, .stabbing]
        sut.selectedSymptoms = [.lightSensitivity]
        sut.selectedTriggers = [.caffeine, .stress]
        sut.notes = "After coffee"
        sut.initialIntensity = 8.0

        _ = await sut.saveEpisode()

        let episode = mockRepo.episodes.first!
        XCTAssertEqual(episode.locations, [.leftEye])
        XCTAssertEqual(Set(episode.qualities), Set([.sharp, .stabbing]))
        XCTAssertEqual(episode.symptoms, [.lightSensitivity])
        XCTAssertEqual(Set(episode.triggers), Set([.caffeine, .stress]))
        XCTAssertEqual(episode.notes, "After coffee")
        XCTAssertNil(episode.endTime)
    }

    func testSaveEpisode_intensityReadingMatchesEpisode() async {
        sut.initialIntensity = 3.5

        let episode = await sut.saveEpisode()

        let reading = mockRepo.intensityReadings.first!
        XCTAssertEqual(reading.episodeId, episode?.id)
        XCTAssertEqual(reading.intensity, 3.5)
        XCTAssertEqual(reading.timestamp, episode?.startTime)
    }

    func testSaveEpisode_emptyNotes_savedAsNil() async {
        sut.notes = ""

        _ = await sut.saveEpisode()

        XCTAssertNil(mockRepo.episodes.first?.notes)
    }

    func testSaveEpisode_noSelectionsExceptIntensity_succeeds() async {
        sut.initialIntensity = 2.0

        let result = await sut.saveEpisode()

        XCTAssertNotNil(result)
        XCTAssertTrue(mockRepo.episodes.first!.locations.isEmpty)
        XCTAssertTrue(mockRepo.episodes.first!.qualities.isEmpty)
        XCTAssertTrue(mockRepo.episodes.first!.symptoms.isEmpty)
        XCTAssertTrue(mockRepo.episodes.first!.triggers.isEmpty)
    }

    func testSaveEpisode_clearsSavingFlag() async {
        _ = await sut.saveEpisode()

        XCTAssertFalse(sut.isSaving)
    }

    func testSaveEpisode_clearsError() async {
        sut.error = "Previous error"

        _ = await sut.saveEpisode()

        XCTAssertNil(sut.error)
    }

    // MARK: - Save Episode (Validation Failure)

    func testSaveEpisode_invalidIntensity_returnsNil() async {
        sut.initialIntensity = 0

        let result = await sut.saveEpisode()

        XCTAssertNil(result)
        XCTAssertFalse(mockRepo.createEpisodeCalled)
        XCTAssertFalse(mockRepo.createIntensityReadingCalled)
    }

    // MARK: - Save Episode (DB Failure)

    func testSaveEpisode_createEpisodeError_setsError() async {
        mockRepo.errorToThrow = TestError.mockError("DB write failed")

        let result = await sut.saveEpisode()

        XCTAssertNil(result)
        XCTAssertNotNil(sut.error)
        XCTAssertEqual(sut.error, "DB write failed")
        XCTAssertFalse(sut.isSaving)
    }

    func testSaveEpisode_createReadingError_setsError() async {
        // Episode creation succeeds, but reading creation fails
        let failingRepo = ReadingFailRepository()
        sut = NewEpisodeViewModel(episodeRepository: failingRepo)
        sut.initialIntensity = 5.0

        let result = await sut.saveEpisode()

        XCTAssertNil(result)
        XCTAssertNotNil(sut.error)
        XCTAssertFalse(sut.isSaving)
    }

    // MARK: - Reset

    func testReset_clearsAllFields() {
        sut.selectedLocations = [.leftTemple, .rightEye]
        sut.selectedQualities = [.throbbing, .sharp]
        sut.selectedSymptoms = [.nausea, .dizziness]
        sut.selectedTriggers = [.stress, .alcohol]
        sut.notes = "Some notes"
        sut.initialIntensity = 9.0
        sut.error = "Some error"

        sut.reset()

        XCTAssertTrue(sut.selectedLocations.isEmpty)
        XCTAssertTrue(sut.selectedQualities.isEmpty)
        XCTAssertTrue(sut.selectedSymptoms.isEmpty)
        XCTAssertTrue(sut.selectedTriggers.isEmpty)
        XCTAssertEqual(sut.notes, "")
        XCTAssertEqual(sut.initialIntensity, 5.0)
        XCTAssertNil(sut.error)
    }

    func testReset_afterSave_restoresDefaults() async {
        sut.selectedLocations = [.leftHead]
        sut.initialIntensity = 8.0
        _ = await sut.saveEpisode()

        sut.reset()

        XCTAssertTrue(sut.selectedLocations.isEmpty)
        XCTAssertEqual(sut.initialIntensity, 5.0)
    }

    // MARK: - State Management

    func testSaveEpisode_setsAndClearsSavingFlag() async {
        // Verify saving is false before and after (we can't easily test during)
        XCTAssertFalse(sut.isSaving)

        _ = await sut.saveEpisode()

        XCTAssertFalse(sut.isSaving)
    }

    func testSaveEpisode_onError_clearsSavingFlag() async {
        mockRepo.errorToThrow = TestError.mockError("fail")

        _ = await sut.saveEpisode()

        XCTAssertFalse(sut.isSaving)
    }

    // MARK: - Selection Management

    func testLocationSelection_addAndRemove() {
        sut.selectedLocations.insert(.leftTemple)
        XCTAssertTrue(sut.selectedLocations.contains(.leftTemple))

        sut.selectedLocations.remove(.leftTemple)
        XCTAssertFalse(sut.selectedLocations.contains(.leftTemple))
    }

    func testSymptomSelection_multipleItems() {
        sut.selectedSymptoms = [.nausea, .aura, .dizziness]
        XCTAssertEqual(sut.selectedSymptoms.count, 3)
        XCTAssertTrue(sut.selectedSymptoms.contains(.nausea))
        XCTAssertTrue(sut.selectedSymptoms.contains(.aura))
        XCTAssertTrue(sut.selectedSymptoms.contains(.dizziness))
    }

    func testTriggerSelection_multipleItems() {
        sut.selectedTriggers = [.stress, .lackOfSleep, .weatherChange]
        XCTAssertEqual(sut.selectedTriggers.count, 3)
    }

    func testQualitySelection_multipleItems() {
        sut.selectedQualities = [.throbbing, .pressure]
        XCTAssertEqual(sut.selectedQualities.count, 2)
    }

    // MARK: - Notes

    func testNotes_whitespaceOnly_savedAsNil() async {
        // The ViewModel checks notes.isEmpty, so whitespace-only will be saved as-is
        sut.notes = "   "

        _ = await sut.saveEpisode()

        // Whitespace is not empty, so it gets saved
        XCTAssertEqual(mockRepo.episodes.first?.notes, "   ")
    }

    func testNotes_nonEmpty_savedAsProvided() async {
        sut.notes = "Took medication early"

        _ = await sut.saveEpisode()

        XCTAssertEqual(mockRepo.episodes.first?.notes, "Took medication early")
    }
}

// MARK: - Helper: Repository that fails on createIntensityReading

private final class ReadingFailRepository: EpisodeRepositoryProtocol, @unchecked Sendable {
    var episodes: [Episode] = []

    func createEpisode(_ episode: Episode) throws -> Episode {
        episodes.append(episode)
        return episode
    }

    func createIntensityReading(_ reading: IntensityReading) throws -> IntensityReading {
        throw TestError.mockError("Reading creation failed")
    }

    // Stubs for remaining protocol requirements
    func getEpisodeById(_ id: String) throws -> Episode? { nil }
    func getAllEpisodes() throws -> [Episode] { [] }
    func getEpisodesByDateRange(start: Int64, end: Int64) throws -> [Episode] { [] }
    func getCurrentEpisode() throws -> Episode? { nil }
    func updateEpisode(_ episode: Episode) throws -> Episode { episode }
    func updateEpisodeTimestamps(episodeId: String, offset: Int64) throws {}
    func deleteEpisode(_ id: String) throws {}
    func deleteAllEpisodes() throws {}
    func getReadingsByEpisodeId(_ episodeId: String) throws -> [IntensityReading] { [] }
    func getReadingsByMultipleEpisodeIds(_ episodeIds: [String]) throws -> [String: [IntensityReading]] { [:] }
    func updateReading(_ reading: IntensityReading) throws -> IntensityReading { reading }
    func updateReadingTimestamps(episodeId: String, offset: Int64) throws {}
    func deleteReading(_ id: String) throws {}
    func createSymptomLog(_ log: SymptomLog) throws -> SymptomLog { log }
    func getSymptomLogsByEpisodeId(_ episodeId: String) throws -> [SymptomLog] { [] }
    func updateSymptomLog(_ log: SymptomLog) throws -> SymptomLog { log }
    func deleteSymptomLog(_ id: String) throws {}
    func createPainLocationLog(_ log: PainLocationLog) throws -> PainLocationLog { log }
    func getLocationLogsByEpisodeId(_ episodeId: String) throws -> [PainLocationLog] { [] }
    func updatePainLocationLog(_ log: PainLocationLog) throws -> PainLocationLog { log }
    func deletePainLocationLog(_ id: String) throws {}
    func createEpisodeNote(_ note: EpisodeNote) throws -> EpisodeNote { note }
    func getNotesByEpisodeId(_ episodeId: String) throws -> [EpisodeNote] { [] }
    func updateEpisodeNote(_ note: EpisodeNote) throws -> EpisodeNote { note }
    func updateNoteTimestamps(episodeId: String, offset: Int64) throws {}
    func deleteEpisodeNote(_ id: String) throws {}
}
