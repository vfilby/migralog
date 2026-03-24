import Foundation
import GRDB

// MARK: - Implementation

final class OverlayRepository: CalendarOverlayRepositoryProtocol {
    private let dbManager: DatabaseManager

    init(dbManager: DatabaseManager) {
        self.dbManager = dbManager
    }

    func createOverlay(_ overlay: CalendarOverlay) throws -> CalendarOverlay {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO calendar_overlays (id, start_date, end_date, label, notes,
                        exclude_from_stats, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                arguments: [
                    overlay.id,
                    overlay.startDate,
                    overlay.endDate,
                    overlay.label,
                    overlay.notes,
                    overlay.excludeFromStats ? 1 : 0,
                    overlay.createdAt,
                    overlay.updatedAt
                ]
            )
        }
        return overlay
    }

    func getAllOverlays() throws -> [CalendarOverlay] {
        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: "SELECT * FROM calendar_overlays ORDER BY start_date ASC"
            )
            return rows.map { Self.overlayFromRow($0) }
        }
    }

    func getOverlaysByDateRange(start: String, end: String) throws -> [CalendarOverlay] {
        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: """
                    SELECT * FROM calendar_overlays
                    WHERE start_date <= ? AND (end_date IS NULL OR end_date >= ?)
                    ORDER BY start_date ASC
                    """,
                arguments: [end, start]
            )
            return rows.map { Self.overlayFromRow($0) }
        }
    }

    func getOverlaysForDate(_ date: String) throws -> [CalendarOverlay] {
        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: """
                    SELECT * FROM calendar_overlays
                    WHERE start_date <= ? AND (end_date IS NULL OR end_date >= ?)
                    ORDER BY start_date ASC
                    """,
                arguments: [date, date]
            )
            return rows.map { Self.overlayFromRow($0) }
        }
    }

    func updateOverlay(_ overlay: CalendarOverlay) throws -> CalendarOverlay {
        let now = TimestampHelper.now
        var updated = overlay
        updated.updatedAt = now
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    UPDATE calendar_overlays SET
                        start_date = ?, end_date = ?, label = ?, notes = ?,
                        exclude_from_stats = ?, updated_at = ?
                    WHERE id = ?
                    """,
                arguments: [
                    updated.startDate,
                    updated.endDate,
                    updated.label,
                    updated.notes,
                    updated.excludeFromStats ? 1 : 0,
                    updated.updatedAt,
                    updated.id
                ]
            )
        }
        return updated
    }

    func deleteOverlay(_ id: String) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(sql: "DELETE FROM calendar_overlays WHERE id = ?", arguments: [id])
        }
    }

    // MARK: - Row Mapping

    static func overlayFromRow(_ row: Row) -> CalendarOverlay {
        CalendarOverlay(
            id: row["id"],
            startDate: row["start_date"],
            endDate: row["end_date"],
            label: row["label"],
            notes: row["notes"],
            excludeFromStats: (row["exclude_from_stats"] as Int) != 0,
            createdAt: row["created_at"],
            updatedAt: row["updated_at"]
        )
    }
}
