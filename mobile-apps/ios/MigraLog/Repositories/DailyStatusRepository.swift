import Foundation
import GRDB

// MARK: - Implementation

final class DailyStatusRepository: DailyStatusRepositoryProtocol {
    private let dbManager: DatabaseManager

    init(dbManager: DatabaseManager) {
        self.dbManager = dbManager
    }

    func createStatus(_ status: DailyStatusLog) throws -> DailyStatusLog {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO daily_status_logs (id, date, status, status_type, notes, prompted, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                arguments: [
                    status.id,
                    status.date,
                    status.status.rawValue,
                    status.statusType?.rawValue,
                    status.notes,
                    status.prompted ? 1 : 0,
                    status.createdAt,
                    status.updatedAt
                ]
            )
        }
        return status
    }

    func getStatusById(_ id: String) throws -> DailyStatusLog? {
        try dbManager.dbQueue.read { db in
            let row = try Row.fetchOne(db, sql: "SELECT * FROM daily_status_logs WHERE id = ?", arguments: [id])
            return row.map { Self.statusFromRow($0) }
        }
    }

    func getStatusByDate(_ date: String) throws -> DailyStatusLog? {
        try dbManager.dbQueue.read { db in
            let row = try Row.fetchOne(
                db,
                sql: "SELECT * FROM daily_status_logs WHERE date = ?",
                arguments: [date]
            )
            return row.map { Self.statusFromRow($0) }
        }
    }

    func getStatusesByDateRange(start: String, end: String) throws -> [DailyStatusLog] {
        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: """
                    SELECT * FROM daily_status_logs
                    WHERE date >= ? AND date <= ?
                    ORDER BY date ASC
                    """,
                arguments: [start, end]
            )
            return rows.map { Self.statusFromRow($0) }
        }
    }

    func getMonthStats(year: Int, month: Int) throws -> [DailyStatusLog] {
        let monthStr = String(format: "%04d-%02d", year, month)
        return try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: """
                    SELECT * FROM daily_status_logs
                    WHERE date LIKE ? || '%'
                    ORDER BY date ASC
                    """,
                arguments: [monthStr]
            )
            return rows.map { Self.statusFromRow($0) }
        }
    }

    func updateStatus(_ status: DailyStatusLog) throws -> DailyStatusLog {
        let now = TimestampHelper.now
        var updated = status
        updated.updatedAt = now
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    UPDATE daily_status_logs SET
                        date = ?, status = ?, status_type = ?, notes = ?,
                        prompted = ?, updated_at = ?
                    WHERE id = ?
                    """,
                arguments: [
                    updated.date,
                    updated.status.rawValue,
                    updated.statusType?.rawValue,
                    updated.notes,
                    updated.prompted ? 1 : 0,
                    updated.updatedAt,
                    updated.id
                ]
            )
        }
        return updated
    }

    func deleteStatus(_ id: String) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(sql: "DELETE FROM daily_status_logs WHERE id = ?", arguments: [id])
        }
    }

    // MARK: - Row Mapping

    static func statusFromRow(_ row: Row) -> DailyStatusLog {
        DailyStatusLog(
            id: row["id"],
            date: row["date"],
            status: DayStatus(rawValue: row["status"]) ?? .green,
            statusType: (row["status_type"] as String?).flatMap { YellowDayType(rawValue: $0) },
            notes: row["notes"],
            prompted: (row["prompted"] as Int) != 0,
            createdAt: row["created_at"],
            updatedAt: row["updated_at"]
        )
    }
}
