import Foundation
import GRDB

// MARK: - Model

/// Which pick list a tracking option belongs to.
enum TrackingOptionCategory: String, CaseIterable, Identifiable, Sendable {
    case painQuality = "pain_quality"
    case symptom
    case trigger

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .painQuality: return "Pain Qualities"
        case .symptom: return "Symptoms"
        case .trigger: return "Triggers"
        }
    }

    /// Raw values of the options that ship with the app, in display order.
    var builtInValues: [String] {
        switch self {
        case .painQuality: return PainQuality.allCases.map(\.rawValue)
        case .symptom: return Symptom.allCases.map(\.rawValue)
        case .trigger: return Trigger.allCases.map(\.rawValue)
        }
    }

    /// Display name for a raw option value in this category.
    func displayName(forValue value: String) -> String {
        switch self {
        case .painQuality: return PainQuality(rawValue: value).displayName
        case .symptom: return Symptom(rawValue: value).displayName
        case .trigger: return Trigger(rawValue: value).displayName
        }
    }
}

/// A row in `tracking_options`: either a user-created custom option, or a
/// visibility override that hides one of the built-in options. Built-in
/// options have no row at all while visible — only deviations from the
/// defaults are stored (and synced).
///
/// `value` is the raw string written into episode JSON arrays and
/// symptom_logs. For built-in overrides it is the built-in's snake_case
/// raw value; for custom options it is the user's text verbatim.
struct TrackingOption: Identifiable, Equatable, Sendable {
    let id: String
    let category: TrackingOptionCategory
    let value: String
    let isBuiltIn: Bool
    var isHidden: Bool
    let createdAt: Int64
    var updatedAt: Int64?

    var displayName: String { category.displayName(forValue: value) }
}

// MARK: - Protocol

protocol TrackingOptionRepositoryProtocol: Sendable {
    /// All override/custom rows, across categories.
    func getAllOptions() throws -> [TrackingOption]

    /// The raw values to offer in pickers for a category: built-ins (minus
    /// hidden ones) in their canonical order, then visible custom values
    /// sorted by creation time.
    func getActiveValues(category: TrackingOptionCategory) throws -> [String]

    /// Add a user-defined option. Throws TrackingOptionError.duplicateValue
    /// when the trimmed value collides (case-insensitively) with a built-in
    /// or an existing custom option in the same category.
    @discardableResult
    func addCustomOption(category: TrackingOptionCategory, value: String) throws -> TrackingOption

    /// Hide or show an option. For built-ins this inserts or deletes the
    /// override row; for custom options it updates `is_hidden` in place.
    func setHidden(category: TrackingOptionCategory, value: String, hidden: Bool) throws

    /// Delete a custom option row. Episodes that already reference the value
    /// keep it — history is never rewritten.
    func deleteCustomOption(id: String) throws
}

enum TrackingOptionError: Error, Equatable {
    case emptyValue
    case duplicateValue
}

// MARK: - Implementation

final class TrackingOptionRepository: TrackingOptionRepositoryProtocol {
    private let dbManager: DatabaseManager

    init(dbManager: DatabaseManager) {
        self.dbManager = dbManager
    }

    func getAllOptions() throws -> [TrackingOption] {
        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: """
                    SELECT id, category, value, is_built_in, is_hidden, created_at, updated_at
                    FROM tracking_options
                    ORDER BY category, created_at
                    """
            )
            return rows.compactMap { Self.optionFromRow($0) }
        }
    }

    func getActiveValues(category: TrackingOptionCategory) throws -> [String] {
        let options = try getOptions(category: category)
        let hiddenBuiltIns = Set(options.filter { $0.isBuiltIn && $0.isHidden }.map(\.value))
        let visibleCustoms = options
            .filter { !$0.isBuiltIn && !$0.isHidden }
            .map(\.value)
        return category.builtInValues.filter { !hiddenBuiltIns.contains($0) } + visibleCustoms
    }

    @discardableResult
    func addCustomOption(category: TrackingOptionCategory, value: String) throws -> TrackingOption {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw TrackingOptionError.emptyValue }

        let existing = category.builtInValues
            + (try getOptions(category: category).map(\.value))
        let collides = existing.contains {
            $0.caseInsensitiveCompare(trimmed) == .orderedSame
                || category.displayName(forValue: $0).caseInsensitiveCompare(trimmed) == .orderedSame
        }
        guard !collides else { throw TrackingOptionError.duplicateValue }

        let option = TrackingOption(
            id: UUID().uuidString,
            category: category,
            value: trimmed,
            isBuiltIn: false,
            isHidden: false,
            createdAt: TimestampHelper.now,
            updatedAt: TimestampHelper.now
        )
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: """
                    INSERT INTO tracking_options
                        (id, category, value, is_built_in, is_hidden, created_at, updated_at)
                    VALUES (?, ?, ?, 0, 0, ?, ?)
                    """,
                arguments: [option.id, category.rawValue, option.value, option.createdAt, option.updatedAt]
            )
        }
        return option
    }

    func setHidden(category: TrackingOptionCategory, value: String, hidden: Bool) throws {
        let now = TimestampHelper.now
        let isBuiltIn = category.builtInValues.contains(value)
        try dbManager.dbQueue.write { db in
            if isBuiltIn {
                if hidden {
                    try db.execute(
                        sql: """
                            INSERT INTO tracking_options
                                (id, category, value, is_built_in, is_hidden, created_at, updated_at)
                            VALUES (?, ?, ?, 1, 1, ?, ?)
                            ON CONFLICT(category, value) DO UPDATE SET
                                is_hidden = 1,
                                updated_at = excluded.updated_at
                            """,
                        arguments: [UUID().uuidString, category.rawValue, value, now, now]
                    )
                } else {
                    // A visible built-in is the default state — drop the override
                    // row entirely rather than storing is_hidden = 0.
                    try db.execute(
                        sql: "DELETE FROM tracking_options WHERE category = ? AND value = ? AND is_built_in = 1",
                        arguments: [category.rawValue, value]
                    )
                }
            } else {
                try db.execute(
                    sql: """
                        UPDATE tracking_options SET is_hidden = ?, updated_at = ?
                        WHERE category = ? AND value = ? AND is_built_in = 0
                        """,
                    arguments: [hidden ? 1 : 0, now, category.rawValue, value]
                )
            }
        }
    }

    func deleteCustomOption(id: String) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: "DELETE FROM tracking_options WHERE id = ? AND is_built_in = 0",
                arguments: [id]
            )
        }
    }

    // MARK: - Helpers

    private func getOptions(category: TrackingOptionCategory) throws -> [TrackingOption] {
        try dbManager.dbQueue.read { db in
            let rows = try Row.fetchAll(
                db,
                sql: """
                    SELECT id, category, value, is_built_in, is_hidden, created_at, updated_at
                    FROM tracking_options
                    WHERE category = ?
                    ORDER BY created_at
                    """,
                arguments: [category.rawValue]
            )
            return rows.compactMap { Self.optionFromRow($0) }
        }
    }

    // MARK: - Row Mapping

    private static func optionFromRow(_ row: Row) -> TrackingOption? {
        guard let id = row["id"] as String?,
              let rawCategory = row["category"] as String?,
              let category = TrackingOptionCategory(rawValue: rawCategory),
              let value = row["value"] as String?,
              let createdAt = row["created_at"] as Int64? else {
            return nil
        }
        return TrackingOption(
            id: id,
            category: category,
            value: value,
            isBuiltIn: (row["is_built_in"] as Int64? ?? 0) == 1,
            isHidden: (row["is_hidden"] as Int64? ?? 0) == 1,
            createdAt: createdAt,
            updatedAt: row["updated_at"] as Int64?
        )
    }
}
