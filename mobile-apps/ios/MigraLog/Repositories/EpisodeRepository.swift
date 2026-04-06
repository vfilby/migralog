import Foundation
import GRDB

// MARK: - Implementation

final class EpisodeRepository: EpisodeRepositoryProtocol {
    private let dbManager: DatabaseManager

    init(dbManager: DatabaseManager) {
        self.dbManager = dbManager
    }

    // MARK: - Episode CRUD

    func createEpisode(_ episode: Episode) throws -> Episode {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO episodes (id, start_time, end_time, locations, qualities, symptoms, triggers, notes,
                        latitude, longitude, location_accuracy, location_timestamp, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                arguments: [
                    episode.id,
                    episode.startTime,
                    episode.endTime,
                    JSONHelper.encode(episode.locations.map(\.rawValue)),
                    JSONHelper.encode(episode.qualities.map(\.rawValue)),
                    JSONHelper.encode(episode.symptoms.map(\.rawValue)),
                    JSONHelper.encode(episode.triggers.map(\.rawValue)),
                    episode.notes,
                    episode.latitude,
                    episode.longitude,
                    episode.locationAccuracy,
                    episode.locationTimestamp,
                    episode.createdAt,
                    episode.updatedAt
                ]
            )
        }
        return episode
    }

    func getEpisodeById(_ id: String) throws -> Episode? {
        try dbManager.dbQueue.read { db in
            let row = try Row.fetchOne(db, sql: "SELECT * FROM episodes WHERE id = ?", arguments: [id])
            return row.map { Self.episodeFromRow($0) }
        }
    }

    func getAllEpisodes() throws -> [Episode] {
        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(db, sql: "SELECT * FROM episodes ORDER BY start_time DESC")
            return rows.map { Self.episodeFromRow($0) }
        }
    }

    func getEpisodesByDateRange(start: Int64, end: Int64) throws -> [Episode] {
        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: """
                    SELECT * FROM episodes
                    WHERE start_time >= ? AND start_time <= ?
                    ORDER BY start_time DESC
                    """,
                arguments: [start, end]
            )
            return rows.map { Self.episodeFromRow($0) }
        }
    }

    func getCurrentEpisode() throws -> Episode? {
        try dbManager.dbQueue.read { db in
            let row = try Row.fetchOne(
                db,
                sql: "SELECT * FROM episodes WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1"
            )
            return row.map { Self.episodeFromRow($0) }
        }
    }

    func getEpisodeByTimestamp(_ timestamp: Int64) throws -> Episode? {
        try dbManager.dbQueue.read { db in
            let row = try Row.fetchOne(
                db,
                sql: """
                    SELECT * FROM episodes
                    WHERE start_time <= ?
                    AND (end_time IS NULL OR end_time >= ?)
                    ORDER BY start_time DESC
                    LIMIT 1
                    """,
                arguments: [timestamp, timestamp]
            )
            return row.map { Self.episodeFromRow($0) }
        }
    }

    func updateEpisode(_ episode: Episode) throws -> Episode {
        let now = TimestampHelper.now
        var updated = episode
        updated.updatedAt = now
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    UPDATE episodes SET
                        start_time = ?, end_time = ?, locations = ?, qualities = ?,
                        symptoms = ?, triggers = ?, notes = ?,
                        latitude = ?, longitude = ?, location_accuracy = ?, location_timestamp = ?,
                        updated_at = ?
                    WHERE id = ?
                    """,
                arguments: [
                    updated.startTime,
                    updated.endTime,
                    JSONHelper.encode(updated.locations.map(\.rawValue)),
                    JSONHelper.encode(updated.qualities.map(\.rawValue)),
                    JSONHelper.encode(updated.symptoms.map(\.rawValue)),
                    JSONHelper.encode(updated.triggers.map(\.rawValue)),
                    updated.notes,
                    updated.latitude,
                    updated.longitude,
                    updated.locationAccuracy,
                    updated.locationTimestamp,
                    updated.updatedAt,
                    updated.id
                ]
            )
        }
        return updated
    }

    func updateEpisodeTimestamps(episodeId: String, offset: Int64) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    UPDATE episodes SET
                        start_time = start_time + ?,
                        end_time = CASE WHEN end_time IS NOT NULL THEN end_time + ? ELSE NULL END,
                        updated_at = ?
                    WHERE id = ?
                    """,
                arguments: [offset, offset, TimestampHelper.now, episodeId]
            )
        }
    }

    func deleteEpisode(_ id: String) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(sql: "DELETE FROM episodes WHERE id = ?", arguments: [id])
        }
    }

    func deleteAllEpisodes() throws {
        try dbManager.dbQueue.write { db in
            try db.execute(sql: "DELETE FROM episodes")
        }
    }

    // MARK: - Intensity Reading CRUD

    func createIntensityReading(_ reading: IntensityReading) throws -> IntensityReading {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO intensity_readings (id, episode_id, timestamp, intensity, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                arguments: [
                    reading.id,
                    reading.episodeId,
                    reading.timestamp,
                    reading.intensity,
                    reading.createdAt,
                    reading.updatedAt
                ]
            )
        }
        return reading
    }

    func getReadingsByEpisodeId(_ episodeId: String) throws -> [IntensityReading] {
        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: "SELECT * FROM intensity_readings WHERE episode_id = ? ORDER BY timestamp ASC",
                arguments: [episodeId]
            )
            return rows.map { Self.readingFromRow($0) }
        }
    }

    func getReadingsByMultipleEpisodeIds(_ episodeIds: [String]) throws -> [String: [IntensityReading]] {
        guard !episodeIds.isEmpty else { return [:] }
        let placeholders = episodeIds.map { _ in "?" }.joined(separator: ", ")
        return try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: "SELECT * FROM intensity_readings WHERE episode_id IN (\(placeholders)) ORDER BY timestamp ASC",
                arguments: StatementArguments(episodeIds)
            )
            var result: [String: [IntensityReading]] = [:]
            for row in rows {
                let reading = Self.readingFromRow(row)
                result[reading.episodeId, default: []].append(reading)
            }
            return result
        }
    }

    func updateReading(_ reading: IntensityReading) throws -> IntensityReading {
        let now = TimestampHelper.now
        var updated = reading
        updated.updatedAt = now
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    UPDATE intensity_readings SET
                        timestamp = ?, intensity = ?, updated_at = ?
                    WHERE id = ?
                    """,
                arguments: [updated.timestamp, updated.intensity, updated.updatedAt, updated.id]
            )
        }
        return updated
    }

    func updateReadingTimestamps(episodeId: String, offset: Int64) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    UPDATE intensity_readings SET
                        timestamp = timestamp + ?, updated_at = ?
                    WHERE episode_id = ?
                    """,
                arguments: [offset, TimestampHelper.now, episodeId]
            )
        }
    }

    func deleteReading(_ id: String) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(sql: "DELETE FROM intensity_readings WHERE id = ?", arguments: [id])
        }
    }

    // MARK: - Symptom Log CRUD

    func createSymptomLog(_ log: SymptomLog) throws -> SymptomLog {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO symptom_logs (id, episode_id, symptom, onset_time, resolution_time, severity, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                arguments: [
                    log.id,
                    log.episodeId,
                    log.symptom.rawValue,
                    log.onsetTime,
                    log.resolutionTime,
                    log.severity,
                    log.createdAt
                ]
            )
        }
        return log
    }

    func getSymptomLogsByEpisodeId(_ episodeId: String) throws -> [SymptomLog] {
        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: "SELECT * FROM symptom_logs WHERE episode_id = ? ORDER BY onset_time ASC",
                arguments: [episodeId]
            )
            return rows.map { Self.symptomLogFromRow($0) }
        }
    }

    func updateSymptomLog(_ log: SymptomLog) throws -> SymptomLog {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    UPDATE symptom_logs SET
                        symptom = ?, onset_time = ?, resolution_time = ?, severity = ?
                    WHERE id = ?
                    """,
                arguments: [
                    log.symptom.rawValue,
                    log.onsetTime,
                    log.resolutionTime,
                    log.severity,
                    log.id
                ]
            )
        }
        return log
    }

    func deleteSymptomLog(_ id: String) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(sql: "DELETE FROM symptom_logs WHERE id = ?", arguments: [id])
        }
    }

    // MARK: - Pain Location Log CRUD

    func createPainLocationLog(_ log: PainLocationLog) throws -> PainLocationLog {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO pain_location_logs (id, episode_id, timestamp, pain_locations, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                arguments: [
                    log.id,
                    log.episodeId,
                    log.timestamp,
                    JSONHelper.encode(log.painLocations.map(\.rawValue)),
                    log.createdAt,
                    log.updatedAt
                ]
            )
        }
        return log
    }

    func getLocationLogsByEpisodeId(_ episodeId: String) throws -> [PainLocationLog] {
        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: "SELECT * FROM pain_location_logs WHERE episode_id = ? ORDER BY timestamp ASC",
                arguments: [episodeId]
            )
            return rows.map { Self.painLocationLogFromRow($0) }
        }
    }

    func updatePainLocationLog(_ log: PainLocationLog) throws -> PainLocationLog {
        let now = TimestampHelper.now
        var updated = log
        updated.updatedAt = now
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    UPDATE pain_location_logs SET
                        timestamp = ?, pain_locations = ?, updated_at = ?
                    WHERE id = ?
                    """,
                arguments: [
                    updated.timestamp,
                    JSONHelper.encode(updated.painLocations.map(\.rawValue)),
                    updated.updatedAt,
                    updated.id
                ]
            )
        }
        return updated
    }

    func deletePainLocationLog(_ id: String) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(sql: "DELETE FROM pain_location_logs WHERE id = ?", arguments: [id])
        }
    }

    // MARK: - Episode Note CRUD

    func createEpisodeNote(_ note: EpisodeNote) throws -> EpisodeNote {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO episode_notes (id, episode_id, timestamp, note, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                arguments: [
                    note.id,
                    note.episodeId,
                    note.timestamp,
                    note.note,
                    note.createdAt
                ]
            )
        }
        return note
    }

    func getNotesByEpisodeId(_ episodeId: String) throws -> [EpisodeNote] {
        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: "SELECT * FROM episode_notes WHERE episode_id = ? ORDER BY timestamp ASC",
                arguments: [episodeId]
            )
            return rows.map { Self.noteFromRow($0) }
        }
    }

    func updateEpisodeNote(_ note: EpisodeNote) throws -> EpisodeNote {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    UPDATE episode_notes SET
                        timestamp = ?, note = ?
                    WHERE id = ?
                    """,
                arguments: [note.timestamp, note.note, note.id]
            )
        }
        return note
    }

    func updateNoteTimestamps(episodeId: String, offset: Int64) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    UPDATE episode_notes SET
                        timestamp = timestamp + ?
                    WHERE episode_id = ?
                    """,
                arguments: [offset, episodeId]
            )
        }
    }

    func deleteEpisodeNote(_ id: String) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(sql: "DELETE FROM episode_notes WHERE id = ?", arguments: [id])
        }
    }

    // MARK: - Row Mapping

    static func episodeFromRow(_ row: Row) -> Episode {
        Episode(
            id: row["id"],
            startTime: row["start_time"],
            endTime: row["end_time"],
            locations: JSONHelper.decodeArray(String.self, from: row["locations"] as String?)
                .compactMap { PainLocation(rawValue: $0) },
            qualities: JSONHelper.decodeArray(String.self, from: row["qualities"] as String?)
                .compactMap { PainQuality(rawValue: $0) },
            symptoms: JSONHelper.decodeArray(String.self, from: row["symptoms"] as String?)
                .compactMap { Symptom(rawValue: $0) },
            triggers: JSONHelper.decodeArray(String.self, from: row["triggers"] as String?)
                .compactMap { Trigger(rawValue: $0) },
            notes: row["notes"],
            latitude: row["latitude"],
            longitude: row["longitude"],
            locationAccuracy: row["location_accuracy"],
            locationTimestamp: row["location_timestamp"],
            createdAt: row["created_at"],
            updatedAt: row["updated_at"]
        )
    }

    static func readingFromRow(_ row: Row) -> IntensityReading {
        IntensityReading(
            id: row["id"],
            episodeId: row["episode_id"],
            timestamp: row["timestamp"],
            intensity: row["intensity"],
            createdAt: row["created_at"],
            updatedAt: row["updated_at"]
        )
    }

    static func symptomLogFromRow(_ row: Row) -> SymptomLog {
        SymptomLog(
            id: row["id"],
            episodeId: row["episode_id"],
            symptom: Symptom(rawValue: row["symptom"]) ?? .nausea,
            onsetTime: row["onset_time"],
            resolutionTime: row["resolution_time"],
            severity: row["severity"],
            createdAt: row["created_at"]
        )
    }

    static func painLocationLogFromRow(_ row: Row) -> PainLocationLog {
        PainLocationLog(
            id: row["id"],
            episodeId: row["episode_id"],
            timestamp: row["timestamp"],
            painLocations: JSONHelper.decodeArray(String.self, from: row["pain_locations"] as String?)
                .compactMap { PainLocation(rawValue: $0) },
            createdAt: row["created_at"],
            updatedAt: row["updated_at"]
        )
    }

    static func noteFromRow(_ row: Row) -> EpisodeNote {
        EpisodeNote(
            id: row["id"],
            episodeId: row["episode_id"],
            timestamp: row["timestamp"],
            note: row["note"],
            createdAt: row["created_at"]
        )
    }
}
