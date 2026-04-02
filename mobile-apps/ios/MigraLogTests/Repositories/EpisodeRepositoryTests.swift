import XCTest
@testable import MigraLog

final class EpisodeRepositoryTests: XCTestCase {
    var dbManager: DatabaseManager!
    var repo: EpisodeRepository!

    override func setUpWithError() throws {
        dbManager = try DatabaseManager(inMemory: true)
        repo = EpisodeRepository(dbManager: dbManager)
    }

    override func tearDownWithError() throws {
        dbManager = nil
        repo = nil
    }

    // MARK: - Helpers

    private func makeEpisode(
        id: String = UUID().uuidString,
        startTime: Int64 = 1_700_000_000_000,
        endTime: Int64? = nil,
        locations: [PainLocation] = [.leftTemple],
        qualities: [PainQuality] = [.throbbing],
        symptoms: [Symptom] = [.nausea],
        triggers: [Trigger] = [.stress],
        notes: String? = nil
    ) -> Episode {
        let now = TimestampHelper.now
        return Episode(
            id: id,
            startTime: startTime,
            endTime: endTime,
            locations: locations,
            qualities: qualities,
            symptoms: symptoms,
            triggers: triggers,
            notes: notes,
            latitude: nil,
            longitude: nil,
            locationAccuracy: nil,
            locationTimestamp: nil,
            createdAt: now,
            updatedAt: now
        )
    }

    private func makeReading(
        id: String = UUID().uuidString,
        episodeId: String,
        timestamp: Int64 = 1_700_000_000_000,
        intensity: Double = 5.0
    ) -> IntensityReading {
        let now = TimestampHelper.now
        return IntensityReading(
            id: id,
            episodeId: episodeId,
            timestamp: timestamp,
            intensity: intensity,
            createdAt: now,
            updatedAt: now
        )
    }

    private func makeSymptomLog(
        id: String = UUID().uuidString,
        episodeId: String,
        symptom: Symptom = .nausea,
        onsetTime: Int64 = 1_700_000_000_000
    ) -> SymptomLog {
        SymptomLog(
            id: id,
            episodeId: episodeId,
            symptom: symptom,
            onsetTime: onsetTime,
            resolutionTime: nil,
            severity: 5.0,
            createdAt: TimestampHelper.now
        )
    }

    private func makePainLocationLog(
        id: String = UUID().uuidString,
        episodeId: String,
        timestamp: Int64 = 1_700_000_000_000,
        painLocations: [PainLocation] = [.leftTemple, .rightTemple]
    ) -> PainLocationLog {
        let now = TimestampHelper.now
        return PainLocationLog(
            id: id,
            episodeId: episodeId,
            timestamp: timestamp,
            painLocations: painLocations,
            createdAt: now,
            updatedAt: now
        )
    }

    private func makeNote(
        id: String = UUID().uuidString,
        episodeId: String,
        timestamp: Int64 = 1_700_000_000_000,
        note: String = "Test note"
    ) -> EpisodeNote {
        EpisodeNote(
            id: id,
            episodeId: episodeId,
            timestamp: timestamp,
            note: note,
            createdAt: TimestampHelper.now
        )
    }

    // MARK: - Episode CRUD Tests

    func testCreateEpisodeWithValidData() throws {
        let episode = makeEpisode()
        let created = try repo.createEpisode(episode)

        XCTAssertEqual(created.id, episode.id)
        XCTAssertEqual(created.startTime, episode.startTime)
        XCTAssertTrue(created.createdAt > 0)
        XCTAssertTrue(created.updatedAt > 0)
    }

    func testCreateEpisodeWithAllFields() throws {
        let episode = Episode(
            id: UUID().uuidString,
            startTime: 1_700_000_000_000,
            endTime: 1_700_003_600_000,
            locations: [.leftTemple, .rightEye],
            qualities: [.throbbing, .sharp],
            symptoms: [.nausea, .aura],
            triggers: [.stress, .caffeine],
            notes: "Severe episode",
            latitude: 45.0,
            longitude: -122.0,
            locationAccuracy: 10.0,
            locationTimestamp: 1_700_000_000_000,
            createdAt: TimestampHelper.now,
            updatedAt: TimestampHelper.now
        )
        let created = try repo.createEpisode(episode)

        let fetched = try repo.getEpisodeById(created.id)
        XCTAssertNotNil(fetched)
        XCTAssertEqual(fetched?.endTime, 1_700_003_600_000)
        XCTAssertEqual(fetched?.locations, [.leftTemple, .rightEye])
        XCTAssertEqual(fetched?.qualities, [.throbbing, .sharp])
        XCTAssertEqual(fetched?.symptoms, [.nausea, .aura])
        XCTAssertEqual(fetched?.triggers, [.stress, .caffeine])
        XCTAssertEqual(fetched?.notes, "Severe episode")
        XCTAssertEqual(fetched?.latitude, 45.0)
        XCTAssertEqual(fetched?.longitude, -122.0)
    }

    func testGetEpisodeByIdExists() throws {
        let episode = makeEpisode()
        try repo.createEpisode(episode)

        let fetched = try repo.getEpisodeById(episode.id)
        XCTAssertNotNil(fetched)
        XCTAssertEqual(fetched?.id, episode.id)
    }

    func testGetEpisodeByIdNotFound() throws {
        let fetched = try repo.getEpisodeById("nonexistent")
        XCTAssertNil(fetched)
    }

    func testGetAllEpisodesSortedByStartTimeDesc() throws {
        let e1 = makeEpisode(startTime: 1_700_000_000_000)
        let e2 = makeEpisode(startTime: 1_700_001_000_000)
        let e3 = makeEpisode(startTime: 1_700_002_000_000)
        try repo.createEpisode(e1)
        try repo.createEpisode(e2)
        try repo.createEpisode(e3)

        let all = try repo.getAllEpisodes()
        XCTAssertEqual(all.count, 3)
        XCTAssertEqual(all[0].id, e3.id)
        XCTAssertEqual(all[1].id, e2.id)
        XCTAssertEqual(all[2].id, e1.id)
    }

    func testGetEpisodesByDateRange() throws {
        let e1 = makeEpisode(startTime: 1_700_000_000_000)
        let e2 = makeEpisode(startTime: 1_700_001_000_000)
        let e3 = makeEpisode(startTime: 1_700_010_000_000)
        try repo.createEpisode(e1)
        try repo.createEpisode(e2)
        try repo.createEpisode(e3)

        let results = try repo.getEpisodesByDateRange(
            start: 1_699_999_000_000,
            end: 1_700_002_000_000
        )
        XCTAssertEqual(results.count, 2)
    }

    func testGetCurrentEpisodeActive() throws {
        let active = makeEpisode(endTime: nil)
        try repo.createEpisode(active)

        let current = try repo.getCurrentEpisode()
        XCTAssertNotNil(current)
        XCTAssertEqual(current?.id, active.id)
        XCTAssertNil(current?.endTime)
    }

    func testGetCurrentEpisodeNoneActive() throws {
        let ended = makeEpisode(endTime: 1_700_003_600_000)
        try repo.createEpisode(ended)

        let current = try repo.getCurrentEpisode()
        XCTAssertNil(current)
    }

    func testUpdateEpisodeFields() throws {
        let episode = makeEpisode()
        try repo.createEpisode(episode)

        var toUpdate = episode
        toUpdate.endTime = 1_700_003_600_000
        toUpdate.notes = "Updated notes"
        let updated = try repo.updateEpisode(toUpdate)

        XCTAssertEqual(updated.endTime, 1_700_003_600_000)
        XCTAssertGreaterThanOrEqual(updated.updatedAt, episode.updatedAt)

        let fetched = try repo.getEpisodeById(episode.id)
        XCTAssertEqual(fetched?.endTime, 1_700_003_600_000)
        XCTAssertEqual(fetched?.notes, "Updated notes")
    }

    func testDeleteEpisode() throws {
        let episode = makeEpisode()
        try repo.createEpisode(episode)

        try repo.deleteEpisode(episode.id)

        let fetched = try repo.getEpisodeById(episode.id)
        XCTAssertNil(fetched)
    }

    func testDeleteAllEpisodes() throws {
        try repo.createEpisode(makeEpisode())
        try repo.createEpisode(makeEpisode())
        try repo.createEpisode(makeEpisode())

        try repo.deleteAllEpisodes()

        let all = try repo.getAllEpisodes()
        XCTAssertTrue(all.isEmpty)
    }

    // MARK: - Intensity Reading Tests

    func testCreateReadingForEpisode() throws {
        let episode = makeEpisode()
        try repo.createEpisode(episode)

        let reading = makeReading(episodeId: episode.id, intensity: 7.0)
        let created = try repo.createIntensityReading(reading)
        XCTAssertEqual(created.id, reading.id)
        XCTAssertEqual(created.intensity, 7.0)
    }

    func testGetReadingsByEpisodeIdSortedByTimestamp() throws {
        let episode = makeEpisode()
        try repo.createEpisode(episode)

        let r1 = makeReading(episodeId: episode.id, timestamp: 1_700_000_100_000, intensity: 3.0)
        let r2 = makeReading(episodeId: episode.id, timestamp: 1_700_000_200_000, intensity: 7.0)
        let r3 = makeReading(episodeId: episode.id, timestamp: 1_700_000_050_000, intensity: 5.0)
        try repo.createIntensityReading(r1)
        try repo.createIntensityReading(r2)
        try repo.createIntensityReading(r3)

        let readings = try repo.getReadingsByEpisodeId(episode.id)
        XCTAssertEqual(readings.count, 3)
        XCTAssertEqual(readings[0].id, r3.id) // earliest timestamp first
        XCTAssertEqual(readings[1].id, r1.id)
        XCTAssertEqual(readings[2].id, r2.id)
    }

    func testGetReadingsByMultipleEpisodeIds() throws {
        let e1 = makeEpisode()
        let e2 = makeEpisode()
        try repo.createEpisode(e1)
        try repo.createEpisode(e2)

        try repo.createIntensityReading(makeReading(episodeId: e1.id))
        try repo.createIntensityReading(makeReading(episodeId: e1.id, timestamp: 1_700_000_001_000))
        try repo.createIntensityReading(makeReading(episodeId: e2.id))

        let grouped = try repo.getReadingsByMultipleEpisodeIds([e1.id, e2.id])
        XCTAssertEqual(grouped[e1.id]?.count, 2)
        XCTAssertEqual(grouped[e2.id]?.count, 1)
    }

    func testUpdateReadingIntensity() throws {
        let episode = makeEpisode()
        try repo.createEpisode(episode)
        let reading = makeReading(episodeId: episode.id, intensity: 5.0)
        try repo.createIntensityReading(reading)

        var toUpdate = reading
        toUpdate.intensity = 8.0
        let updated = try repo.updateReading(toUpdate)
        XCTAssertEqual(updated.intensity, 8.0)

        let fetched = try repo.getReadingsByEpisodeId(episode.id)
        XCTAssertEqual(fetched.first?.intensity, 8.0)
    }

    func testUpdateReadingTimestamps() throws {
        let episode = makeEpisode()
        try repo.createEpisode(episode)
        let reading = makeReading(episodeId: episode.id, timestamp: 1_700_000_000_000)
        try repo.createIntensityReading(reading)

        let offset: Int64 = 3_600_000 // 1 hour
        try repo.updateReadingTimestamps(episodeId: episode.id, offset: offset)

        let readings = try repo.getReadingsByEpisodeId(episode.id)
        XCTAssertEqual(readings.first?.timestamp, 1_700_000_000_000 + offset)
    }

    func testDeleteReading() throws {
        let episode = makeEpisode()
        try repo.createEpisode(episode)
        let reading = makeReading(episodeId: episode.id)
        try repo.createIntensityReading(reading)

        try repo.deleteReading(reading.id)

        let readings = try repo.getReadingsByEpisodeId(episode.id)
        XCTAssertTrue(readings.isEmpty)
    }

    // MARK: - Symptom Log Tests

    func testCreateSymptomLog() throws {
        let episode = makeEpisode()
        try repo.createEpisode(episode)
        let log = makeSymptomLog(episodeId: episode.id, symptom: .aura)

        let created = try repo.createSymptomLog(log)
        XCTAssertEqual(created.symptom, .aura)
    }

    func testGetSymptomLogsByEpisodeId() throws {
        let episode = makeEpisode()
        try repo.createEpisode(episode)
        try repo.createSymptomLog(makeSymptomLog(episodeId: episode.id, symptom: .nausea))
        try repo.createSymptomLog(makeSymptomLog(episodeId: episode.id, symptom: .aura, onsetTime: 1_700_000_001_000))

        let logs = try repo.getSymptomLogsByEpisodeId(episode.id)
        XCTAssertEqual(logs.count, 2)
    }

    func testUpdateSymptomLog() throws {
        let episode = makeEpisode()
        try repo.createEpisode(episode)
        let log = makeSymptomLog(episodeId: episode.id, symptom: .nausea)
        try repo.createSymptomLog(log)

        var toUpdate = log
        toUpdate.symptom = .dizziness
        let updated = try repo.updateSymptomLog(toUpdate)
        XCTAssertEqual(updated.symptom, .dizziness)

        let fetched = try repo.getSymptomLogsByEpisodeId(episode.id)
        XCTAssertEqual(fetched.first?.symptom, .dizziness)
    }

    func testDeleteSymptomLog() throws {
        let episode = makeEpisode()
        try repo.createEpisode(episode)
        let log = makeSymptomLog(episodeId: episode.id)
        try repo.createSymptomLog(log)

        try repo.deleteSymptomLog(log.id)

        let logs = try repo.getSymptomLogsByEpisodeId(episode.id)
        XCTAssertTrue(logs.isEmpty)
    }

    // MARK: - Pain Location Log Tests

    func testCreatePainLocationLog() throws {
        let episode = makeEpisode()
        try repo.createEpisode(episode)
        let log = makePainLocationLog(episodeId: episode.id, painLocations: [.leftTemple, .rightEye])

        let created = try repo.createPainLocationLog(log)
        XCTAssertEqual(created.painLocations, [.leftTemple, .rightEye])
    }

    func testGetLocationLogsByEpisodeId() throws {
        let episode = makeEpisode()
        try repo.createEpisode(episode)
        try repo.createPainLocationLog(makePainLocationLog(episodeId: episode.id))
        try repo.createPainLocationLog(makePainLocationLog(episodeId: episode.id, timestamp: 1_700_000_001_000))

        let logs = try repo.getLocationLogsByEpisodeId(episode.id)
        XCTAssertEqual(logs.count, 2)
    }

    func testUpdatePainLocationLog() throws {
        let episode = makeEpisode()
        try repo.createEpisode(episode)
        let log = makePainLocationLog(episodeId: episode.id, painLocations: [.leftTemple])
        try repo.createPainLocationLog(log)

        var toUpdate = log
        toUpdate.painLocations = [.rightEye, .leftNeck]
        let updated = try repo.updatePainLocationLog(toUpdate)

        let fetched = try repo.getLocationLogsByEpisodeId(episode.id)
        XCTAssertEqual(fetched.first?.painLocations, [.rightEye, .leftNeck])
        XCTAssertGreaterThanOrEqual(updated.updatedAt, log.updatedAt)
    }

    func testDeletePainLocationLog() throws {
        let episode = makeEpisode()
        try repo.createEpisode(episode)
        let log = makePainLocationLog(episodeId: episode.id)
        try repo.createPainLocationLog(log)

        try repo.deletePainLocationLog(log.id)

        let logs = try repo.getLocationLogsByEpisodeId(episode.id)
        XCTAssertTrue(logs.isEmpty)
    }

    // MARK: - Episode Note Tests

    func testCreateEpisodeNote() throws {
        let episode = makeEpisode()
        try repo.createEpisode(episode)
        let note = makeNote(episodeId: episode.id, note: "First note")

        let created = try repo.createEpisodeNote(note)
        XCTAssertEqual(created.note, "First note")
    }

    func testGetNotesByEpisodeIdSortedByTimestamp() throws {
        let episode = makeEpisode()
        try repo.createEpisode(episode)
        let n1 = makeNote(episodeId: episode.id, timestamp: 1_700_000_200_000, note: "Second")
        let n2 = makeNote(episodeId: episode.id, timestamp: 1_700_000_100_000, note: "First")
        try repo.createEpisodeNote(n1)
        try repo.createEpisodeNote(n2)

        let notes = try repo.getNotesByEpisodeId(episode.id)
        XCTAssertEqual(notes.count, 2)
        XCTAssertEqual(notes[0].note, "First")
        XCTAssertEqual(notes[1].note, "Second")
    }

    func testUpdateEpisodeNote() throws {
        let episode = makeEpisode()
        try repo.createEpisode(episode)
        let note = makeNote(episodeId: episode.id, note: "Original")
        try repo.createEpisodeNote(note)

        var toUpdate = note
        toUpdate.note = "Updated text"
        try repo.updateEpisodeNote(toUpdate)

        let fetched = try repo.getNotesByEpisodeId(episode.id)
        XCTAssertEqual(fetched.first?.note, "Updated text")
    }

    func testUpdateNoteTimestamps() throws {
        let episode = makeEpisode()
        try repo.createEpisode(episode)
        let note = makeNote(episodeId: episode.id, timestamp: 1_700_000_000_000)
        try repo.createEpisodeNote(note)

        let offset: Int64 = 3_600_000
        try repo.updateNoteTimestamps(episodeId: episode.id, offset: offset)

        let notes = try repo.getNotesByEpisodeId(episode.id)
        XCTAssertEqual(notes.first?.timestamp, 1_700_000_000_000 + offset)
    }

    func testDeleteEpisodeNote() throws {
        let episode = makeEpisode()
        try repo.createEpisode(episode)
        let note = makeNote(episodeId: episode.id)
        try repo.createEpisodeNote(note)

        try repo.deleteEpisodeNote(note.id)

        let notes = try repo.getNotesByEpisodeId(episode.id)
        XCTAssertTrue(notes.isEmpty)
    }

    // MARK: - Cascade Delete Tests

    func testDeleteEpisodeCascadesReadings() throws {
        let episode = makeEpisode()
        try repo.createEpisode(episode)
        try repo.createIntensityReading(makeReading(episodeId: episode.id))
        try repo.createSymptomLog(makeSymptomLog(episodeId: episode.id))
        try repo.createPainLocationLog(makePainLocationLog(episodeId: episode.id))
        try repo.createEpisodeNote(makeNote(episodeId: episode.id))

        try repo.deleteEpisode(episode.id)

        XCTAssertTrue(try repo.getReadingsByEpisodeId(episode.id).isEmpty)
        XCTAssertTrue(try repo.getSymptomLogsByEpisodeId(episode.id).isEmpty)
        XCTAssertTrue(try repo.getLocationLogsByEpisodeId(episode.id).isEmpty)
        XCTAssertTrue(try repo.getNotesByEpisodeId(episode.id).isEmpty)
    }

    // MARK: - JSON Serialization Tests

    func testEpisodeJsonArrayColumnsRoundtrip() throws {
        let episode = makeEpisode(
            locations: [.leftTemple, .rightEye, .leftNeck],
            qualities: [.throbbing, .sharp],
            symptoms: [.nausea, .aura, .dizziness],
            triggers: [.stress, .caffeine]
        )
        try repo.createEpisode(episode)

        let fetched = try repo.getEpisodeById(episode.id)
        XCTAssertEqual(fetched?.locations, [.leftTemple, .rightEye, .leftNeck])
        XCTAssertEqual(fetched?.qualities, [.throbbing, .sharp])
        XCTAssertEqual(fetched?.symptoms, [.nausea, .aura, .dizziness])
        XCTAssertEqual(fetched?.triggers, [.stress, .caffeine])
    }
}
