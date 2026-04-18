import XCTest
import GRDB
@testable import MigraLog

final class CategorySafetyRulesMigrationTests: XCTestCase {

    /// Starts with a v27 DB containing one category_usage_limits row, runs migrator
    /// through v28, and asserts the row moved into category_safety_rules as a
    /// period_limit row with hours-based period.
    func test_v28_migrates_existing_limit_to_period_limit_row() throws {
        let queue = try DatabaseQueue()

        // Build a v27-era DB manually — category_usage_limits exists with one row.
        try queue.write { db in
            try db.execute(sql: """
                CREATE TABLE category_usage_limits (
                    category TEXT PRIMARY KEY,
                    max_days INTEGER NOT NULL,
                    window_days INTEGER NOT NULL
                )
                """)
            try db.execute(
                sql: "INSERT INTO category_usage_limits (category, max_days, window_days) VALUES (?, ?, ?)",
                arguments: ["nsaid", 15, 30]
            )
        }

        // Apply only v28 (the migration under test).
        var migrator = DatabaseMigrator()
        migrator.registerMigration("v28") { db in
            try DatabaseManager.migrateToCategorySafetyRules(in: db)
        }
        try migrator.migrate(queue)

        try queue.read { db in
            // Old table gone
            let oldExists = try Bool.fetchOne(
                db,
                sql: "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type = 'table' AND name = 'category_usage_limits'"
            ) ?? false
            XCTAssertFalse(oldExists, "category_usage_limits should be dropped")

            // New table has the migrated row
            let rows = try Row.fetchAll(
                db,
                sql: "SELECT category, type, period_hours, max_count FROM category_safety_rules"
            )
            XCTAssertEqual(rows.count, 1)
            XCTAssertEqual(rows[0]["category"] as String?, "nsaid")
            XCTAssertEqual(rows[0]["type"] as String?, "period_limit")
            XCTAssertEqual(rows[0]["period_hours"] as Double?, 720.0)   // 30 days * 24
            XCTAssertEqual(rows[0]["max_count"] as Int?, 15)
        }
    }

    /// Fresh install (no old table) should still succeed and produce an empty new table.
    func test_v28_handles_fresh_install_with_no_existing_data() throws {
        let queue = try DatabaseQueue()

        var migrator = DatabaseMigrator()
        migrator.registerMigration("v28") { db in
            try DatabaseManager.migrateToCategorySafetyRules(in: db)
        }
        try migrator.migrate(queue)

        try queue.read { db in
            let exists = try Bool.fetchOne(
                db,
                sql: "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type = 'table' AND name = 'category_safety_rules'"
            ) ?? false
            XCTAssertTrue(exists)

            let count = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM category_safety_rules") ?? -1
            XCTAssertEqual(count, 0)
        }
    }
}
