import Foundation
import GRDB

// MARK: - Model

/// A free-standing diary note (beta diary notes feature, FeatureFlags.diaryNotes).
/// Unlike `EpisodeNote`, an entry has no episode relationship — it lives in its
/// own `diary_entries` table so diary content stays completely separate from
/// episode timeline data.
struct DiaryEntry: Identifiable, Equatable, Sendable {
    let id: String
    var timestamp: Int64
    var note: String
    let createdAt: Int64
    var updatedAt: Int64

    var date: Date {
        Date(timeIntervalSince1970: Double(timestamp) / 1000.0)
    }
}

// MARK: - Protocol

protocol DiaryEntryRepositoryProtocol: Sendable {
    @discardableResult
    func createEntry(_ entry: DiaryEntry) throws -> DiaryEntry
    func getEntryById(_ id: String) throws -> DiaryEntry?
    func getAllEntries() throws -> [DiaryEntry]
    /// Entries with `start <= timestamp < end` (epoch millis), oldest first.
    func getEntriesByDateRange(start: Int64, end: Int64) throws -> [DiaryEntry]
    @discardableResult
    func updateEntry(_ entry: DiaryEntry) throws -> DiaryEntry
    func deleteEntry(_ id: String) throws
}

// MARK: - Implementation

final class DiaryEntryRepository: DiaryEntryRepositoryProtocol {
    private let dbManager: DatabaseManager

    init(dbManager: DatabaseManager) {
        self.dbManager = dbManager
    }

    @discardableResult
    func createEntry(_ entry: DiaryEntry) throws -> DiaryEntry {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO diary_entries (id, timestamp, note, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                arguments: [entry.id, entry.timestamp, entry.note, entry.createdAt, entry.updatedAt]
            )
        }
        return entry
    }

    func getEntryById(_ id: String) throws -> DiaryEntry? {
        try dbManager.dbQueue.read { db in
            let row = try Row.fetchOne(
                db,
                sql: "SELECT * FROM diary_entries WHERE id = ?",
                arguments: [id]
            )
            return row.flatMap { Self.entryFromRow($0) }
        }
    }

    func getAllEntries() throws -> [DiaryEntry] {
        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: "SELECT * FROM diary_entries ORDER BY timestamp"
            )
            return rows.compactMap { Self.entryFromRow($0) }
        }
    }

    func getEntriesByDateRange(start: Int64, end: Int64) throws -> [DiaryEntry] {
        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: """
                    SELECT * FROM diary_entries
                    WHERE timestamp >= ? AND timestamp < ?
                    ORDER BY timestamp
                    """,
                arguments: [start, end]
            )
            return rows.compactMap { Self.entryFromRow($0) }
        }
    }

    @discardableResult
    func updateEntry(_ entry: DiaryEntry) throws -> DiaryEntry {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    UPDATE diary_entries
                    SET timestamp = ?, note = ?, updated_at = ?
                    WHERE id = ?
                    """,
                arguments: [entry.timestamp, entry.note, entry.updatedAt, entry.id]
            )
        }
        return entry
    }

    func deleteEntry(_ id: String) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: "DELETE FROM diary_entries WHERE id = ?",
                arguments: [id]
            )
        }
    }

    // MARK: - Row Mapping

    private static func entryFromRow(_ row: Row) -> DiaryEntry? {
        guard let id = row["id"] as String?,
              let timestamp = row["timestamp"] as Int64?,
              let note = row["note"] as String?,
              let createdAt = row["created_at"] as Int64? else {
            return nil
        }
        return DiaryEntry(
            id: id,
            timestamp: timestamp,
            note: note,
            createdAt: createdAt,
            updatedAt: row["updated_at"] as Int64? ?? createdAt
        )
    }
}
