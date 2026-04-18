import Foundation
import GRDB

// MARK: - Model

enum CategorySafetyRuleType: String, CaseIterable, Equatable, Sendable {
    case cooldown
    case periodLimit = "period_limit"
}

/// A single safety rule applied to a medication category. Two rule types
/// currently exist:
///
/// - `.cooldown`: Minimum time between any dose in the category, any medication.
///   `periodHours` is the gap; `maxCount` is nil.
/// - `.periodLimit`: MOH-style day-count cap ("max N days in a rolling window").
///   `periodHours` is the window length (days * 24); `maxCount` is N.
struct CategorySafetyRule: Identifiable, Equatable, Sendable {
    let id: String
    let category: MedicationCategory
    let type: CategorySafetyRuleType
    let periodHours: Double
    let maxCount: Int?
    let createdAt: Date

    /// Window length in whole days, for period_limit rules. Rounds to nearest
    /// integer day because the UI only exposes day-granularity.
    var windowDays: Int { Int((periodHours / 24.0).rounded()) }
}

// MARK: - Implementation

final class CategorySafetyRuleRepository: CategorySafetyRuleRepositoryProtocol {
    private let dbManager: DatabaseManager

    init(dbManager: DatabaseManager) {
        self.dbManager = dbManager
    }

    func getAllRules() throws -> [CategorySafetyRule] {
        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: "SELECT id, category, type, period_hours, max_count, created_at FROM category_safety_rules"
            )
            return rows.compactMap { Self.ruleFromRow($0) }
        }
    }

    func getRules(for category: MedicationCategory) throws -> [CategorySafetyRule] {
        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: "SELECT id, category, type, period_hours, max_count, created_at FROM category_safety_rules WHERE category = ?",
                arguments: [category.rawValue]
            )
            return rows.compactMap { Self.ruleFromRow($0) }
        }
    }

    func getRule(category: MedicationCategory, type: CategorySafetyRuleType) throws -> CategorySafetyRule? {
        try dbManager.dbQueue.read { db in
            let row = try Row.fetchOne(
                db,
                sql: """
                    SELECT id, category, type, period_hours, max_count, created_at
                    FROM category_safety_rules
                    WHERE category = ? AND type = ?
                    """,
                arguments: [category.rawValue, type.rawValue]
            )
            return row.flatMap { Self.ruleFromRow($0) }
        }
    }

    func upsert(_ rule: CategorySafetyRule) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO category_safety_rules
                        (id, category, type, period_hours, max_count, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(category, type) DO UPDATE SET
                        period_hours = excluded.period_hours,
                        max_count = excluded.max_count
                    """,
                arguments: [
                    rule.id,
                    rule.category.rawValue,
                    rule.type.rawValue,
                    rule.periodHours,
                    rule.maxCount,
                    Int64(rule.createdAt.timeIntervalSince1970 * 1000)
                ]
            )
        }
    }

    func delete(id: String) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: "DELETE FROM category_safety_rules WHERE id = ?",
                arguments: [id]
            )
        }
    }

    func countUsageDays(category: MedicationCategory, windowDays: Int, now: Date) throws -> Int {
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

    private static func ruleFromRow(_ row: Row) -> CategorySafetyRule? {
        guard let rawCategory = row["category"] as String?,
              let category = MedicationCategory(rawValue: rawCategory),
              let rawType = row["type"] as String?,
              let type = CategorySafetyRuleType(rawValue: rawType),
              let id = row["id"] as String?,
              let periodHours = row["period_hours"] as Double?,
              let createdAtMillis = row["created_at"] as Int64? else {
            return nil
        }
        return CategorySafetyRule(
            id: id,
            category: category,
            type: type,
            periodHours: periodHours,
            maxCount: row["max_count"] as Int?,
            createdAt: Date(timeIntervalSince1970: TimeInterval(createdAtMillis) / 1000.0)
        )
    }
}
