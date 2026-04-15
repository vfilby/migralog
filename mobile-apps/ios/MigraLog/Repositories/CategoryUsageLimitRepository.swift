import Foundation
import GRDB

// MARK: - Model

/// A configured limit on medication usage for a given category, used to surface
/// MOH (medication overuse headache) risk warnings. For example: "NSAID — max 15
/// days in any rolling 30-day window."
struct CategoryUsageLimit: Identifiable, Equatable, Sendable {
    let category: MedicationCategory
    var maxDays: Int
    var windowDays: Int
    var id: String { category.rawValue }
}

// MARK: - Implementation

final class CategoryUsageLimitRepository: CategoryUsageLimitRepositoryProtocol {
    private let dbManager: DatabaseManager

    init(dbManager: DatabaseManager) {
        self.dbManager = dbManager
    }

    func getAllLimits() throws -> [CategoryUsageLimit] {
        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: "SELECT category, max_days, window_days FROM category_usage_limits"
            )
            return rows.compactMap { Self.limitFromRow($0) }
        }
    }

    func getLimit(for category: MedicationCategory) throws -> CategoryUsageLimit? {
        try dbManager.dbQueue.read { db in
            let row = try Row.fetchOne(
                db,
                sql: "SELECT category, max_days, window_days FROM category_usage_limits WHERE category = ?",
                arguments: [category.rawValue]
            )
            return row.flatMap { Self.limitFromRow($0) }
        }
    }

    func setLimit(_ limit: CategoryUsageLimit) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO category_usage_limits (category, max_days, window_days)
                    VALUES (?, ?, ?)
                    ON CONFLICT(category) DO UPDATE SET
                        max_days = excluded.max_days,
                        window_days = excluded.window_days
                    """,
                arguments: [limit.category.rawValue, limit.maxDays, limit.windowDays]
            )
        }
    }

    func clearLimit(for category: MedicationCategory) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: "DELETE FROM category_usage_limits WHERE category = ?",
                arguments: [category.rawValue]
            )
        }
    }

    func countUsageDays(category: MedicationCategory, windowDays: Int, now: Date) throws -> Int {
        // Compute the start of the window (inclusive): now - windowDays days.
        // We count distinct local calendar days with any taken dose for a
        // medication in the given category.
        let windowStart = now.addingTimeInterval(-Double(windowDays) * 24 * 3600)
        let startTs = TimestampHelper.fromDate(windowStart)
        let endTs = TimestampHelper.fromDate(now)
        return try dbManager.dbQueue.read { db in
            let row = try Row.fetchOne(
                db,
                sql: """
                    SELECT COUNT(DISTINCT strftime('%Y-%m-%d', d.timestamp / 1000, 'unixepoch', 'localtime')) AS day_count
                    FROM medication_doses d
                    INNER JOIN medications m ON m.id = d.medication_id
                    WHERE m.category = ?
                      AND d.status = 'taken'
                      AND d.timestamp >= ?
                      AND d.timestamp <= ?
                    """,
                arguments: [category.rawValue, startTs, endTs]
            )
            return row?["day_count"] ?? 0
        }
    }

    // MARK: - Row Mapping

    private static func limitFromRow(_ row: Row) -> CategoryUsageLimit? {
        guard let rawCategory = row["category"] as String?,
              let category = MedicationCategory(rawValue: rawCategory) else {
            return nil
        }
        return CategoryUsageLimit(
            category: category,
            maxDays: row["max_days"],
            windowDays: row["window_days"]
        )
    }
}
