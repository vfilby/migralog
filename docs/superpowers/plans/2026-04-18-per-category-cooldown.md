# Per-Category Cooldown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional per-category cooldown rules (e.g., "NSAID min 4h between any dose") alongside the existing per-category MOH day-count limits, surfaced as a third banner on every dose-log UI surface.

**Architecture:** Rename `category_usage_limits` to `category_safety_rules` with a `type` discriminator column (`cooldown` | `period_limit`) so both rule kinds live in the same table as separate rows. This keeps schema stable for planned CloudKit sync (immutable schemas). A new pure-function `CategoryCooldown` evaluator mirrors the existing `MedicationCooldown`. `MedicationSafetyBanners` gains a third optional banner. The existing settings UI label ("Medication Safety Limits") is preserved; internal class and file names get renamed to `CategorySafetyRule*`.

**Tech Stack:** Swift 5.10, SwiftUI, GRDB (SQLite), XCTest. Project: `mobile-apps/ios/MigraLog/`.

**Reference spec:** `docs/superpowers/specs/2026-04-18-per-category-cooldown-design.md`.

**Working branch:** `feature/per-category-cooldown` (already created and has the spec committed).

---

## File map

### New files
- `mobile-apps/ios/MigraLog/Services/CategoryCooldown.swift`
- `mobile-apps/ios/MigraLogTests/Services/CategoryCooldownTests.swift`

### Renamed files (plus content changes)
- `Repositories/CategoryUsageLimitRepository.swift` → `Repositories/CategorySafetyRuleRepository.swift`
- `ViewModels/CategoryLimitsViewModel.swift` → `ViewModels/CategorySafetyRulesViewModel.swift`
- `Views/Settings/CategoryLimitEditorSheet.swift` → `Views/Settings/CategorySafetyRuleEditorSheet.swift`
- `Views/Settings/CategoryLimitsScreen.swift` → `Views/Settings/CategorySafetyRulesScreen.swift`
- `MigraLogTests/Repositories/CategoryUsageLimitRepositoryTests.swift` → `MigraLogTests/Repositories/CategorySafetyRuleRepositoryTests.swift`
- `MigraLogTests/ViewModels/CategoryLimitsViewModelTests.swift` → `MigraLogTests/ViewModels/CategorySafetyRulesViewModelTests.swift`

### Modified files
- `Database/DatabaseManager.swift` — add v28 migration
- `Models/Enums.swift` — add `MedicationCategory.cooldownPreset`
- `Repositories/Protocols.swift` — rename protocol, update signatures
- `Repositories/MedicationRepository.swift` — add `getLastTakenDoseInCategory`
- `Services/CategoryUsageStatus.swift` — accept `CategorySafetyRule` (period_limit variant)
- `Views/Components/MedicationSafetyBanners.swift` — add 3rd banner
- `ViewModels/DashboardViewModel.swift` — fetch category cooldown
- `ViewModels/LogMedicationViewModel.swift` — fetch category cooldown
- `ViewModels/MedicationDetailViewModel.swift` — fetch category cooldown
- `Views/Dashboard/DashboardScreen.swift` — pass banner prop
- `Views/Medications/LogMedicationScreen.swift` — pass banner prop on both row variants
- `Views/Medications/LogDoseDetailsSheet.swift` — pass banner prop
- `Views/Medications/MedicationDetailScreen.swift` — pass banner prop
- `MigraLogTests/MockRepositories.swift` — rename/extend mock

### Referenced call sites for `CategoryUsageLimit` → `CategorySafetyRule`
A project-wide grep (`grep -r CategoryUsageLimit mobile-apps/ios/MigraLog`) must return zero matches after completion. The rename is mechanical — follow the compiler.

---

## Task 1: Add v28 migration (rename table, split by rule type)

**Files:**
- Modify: `mobile-apps/ios/MigraLog/Database/DatabaseManager.swift:7` (bump `schemaVersion`)
- Modify: `mobile-apps/ios/MigraLog/Database/DatabaseManager.swift:94-128` (register v28)
- Test: `mobile-apps/ios/MigraLogTests/Database/` (create `CategorySafetyRulesMigrationTests.swift`)

**Goal:** Migrate existing `category_usage_limits` rows into the new `category_safety_rules` table, where each old row becomes a single `period_limit` row. Future cooldown rows will be inserted as additional rows.

- [ ] **Step 1: Write the failing migration test**

Create `mobile-apps/ios/MigraLogTests/Database/CategorySafetyRulesMigrationTests.swift`:

```swift
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd mobile-apps/ios && xcodebuild test \
  -project MigraLog.xcodeproj -scheme MigraLog \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0' \
  -only-testing:MigraLogTests/CategorySafetyRulesMigrationTests 2>&1 | tail -20
```

Expected: compile error — `migrateToCategorySafetyRules` does not exist.

- [ ] **Step 3: Implement the migration helper**

Edit `mobile-apps/ios/MigraLog/Database/DatabaseManager.swift`:

1. Change `schemaVersion`:
```swift
static let schemaVersion = 28
```

2. At the end of `buildMigrator()` (before `return migrator`), add:
```swift
        // v28: Rename category_usage_limits → category_safety_rules with a
        // rule-type discriminator. Existing MOH day-count rows become
        // type='period_limit' rows; cooldown rows will be added later.
        migrator.registerMigration("v28") { db in
            try DatabaseManager.migrateToCategorySafetyRules(in: db)
        }
```

3. Add a new static method `migrateToCategorySafetyRules` inside the class (near `createSchema`):
```swift
    /// Create `category_safety_rules` and migrate any existing
    /// `category_usage_limits` rows into it as period_limit entries.
    static func migrateToCategorySafetyRules(in db: Database) throws {
        try db.execute(sql: """
            CREATE TABLE IF NOT EXISTS category_safety_rules (
                id TEXT PRIMARY KEY,
                category TEXT NOT NULL,
                type TEXT NOT NULL CHECK (type IN ('cooldown','period_limit')),
                period_hours REAL NOT NULL CHECK(period_hours > 0),
                max_count INTEGER CHECK(max_count IS NULL OR max_count > 0),
                created_at INTEGER NOT NULL CHECK(created_at > 0),
                UNIQUE(category, type)
            )
            """)
        try db.execute(sql: """
            CREATE INDEX IF NOT EXISTS idx_category_safety_rules_category
            ON category_safety_rules(category)
            """)

        // If the legacy table exists, copy its rows then drop it.
        let legacyExists = try Bool.fetchOne(
            db,
            sql: "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type = 'table' AND name = 'category_usage_limits'"
        ) ?? false
        guard legacyExists else { return }

        let rows = try Row.fetchAll(
            db,
            sql: "SELECT category, max_days, window_days FROM category_usage_limits"
        )
        let nowMillis = TimestampHelper.now
        for row in rows {
            let category: String = row["category"]
            let maxDays: Int = row["max_days"]
            let windowDays: Int = row["window_days"]
            let periodHours = Double(windowDays) * 24.0
            try db.execute(
                sql: """
                    INSERT OR IGNORE INTO category_safety_rules
                        (id, category, type, period_hours, max_count, created_at)
                    VALUES (?, ?, 'period_limit', ?, ?, ?)
                    """,
                arguments: [UUID().uuidString, category, periodHours, maxDays, nowMillis]
            )
        }
        try db.execute(sql: "DROP TABLE category_usage_limits")
    }
```

4. Also update `resetDatabase()` to reference the new table name:
```swift
            try db.execute(sql: "DELETE FROM category_safety_rules")
```

(Replace the existing `DELETE FROM category_usage_limits` line.)

5. `createSchema` intentionally keeps the legacy `category_usage_limits` CREATE so fresh installs still run through v25→v28 faithfully; the v28 migration will rename it. Do not remove the legacy CREATE in this task.

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd mobile-apps/ios && xcodebuild test \
  -project MigraLog.xcodeproj -scheme MigraLog \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0' \
  -only-testing:MigraLogTests/CategorySafetyRulesMigrationTests 2>&1 | tail -10
```

Expected: `Test Suite 'CategorySafetyRulesMigrationTests' passed`.

- [ ] **Step 5: Commit**

```bash
git add mobile-apps/ios/MigraLog/Database/DatabaseManager.swift \
        mobile-apps/ios/MigraLogTests/Database/CategorySafetyRulesMigrationTests.swift
git commit -m "feat(ios): add v28 migration for category_safety_rules table"
```

---

## Task 2: Add `CategorySafetyRule` model + rename protocol

**Files:**
- Modify: `mobile-apps/ios/MigraLog/Repositories/CategoryUsageLimitRepository.swift` (model lives at top of this file; will be renamed in Task 3)
- Modify: `mobile-apps/ios/MigraLog/Repositories/Protocols.swift:83-95`

**Goal:** Replace `CategoryUsageLimit` with `CategorySafetyRule` + `CategorySafetyRuleType` at the model layer so later tasks can compile against the new shape. The repository impl itself is updated in Task 3; for now it adapts to compile.

- [ ] **Step 1: Define the new model (compile-first; tests come with Task 3)**

Edit `mobile-apps/ios/MigraLog/Repositories/CategoryUsageLimitRepository.swift`. Replace the existing `// MARK: - Model` section (the entire `struct CategoryUsageLimit` block) with:

```swift
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
```

- [ ] **Step 2: Update the protocol**

Edit `mobile-apps/ios/MigraLog/Repositories/Protocols.swift:83-95`. Replace the entire `// MARK: - Category Usage Limit Repository Protocol` block with:

```swift
// MARK: - Category Safety Rule Repository Protocol

protocol CategorySafetyRuleRepositoryProtocol: Sendable {
    func getAllRules() throws -> [CategorySafetyRule]
    func getRules(for category: MedicationCategory) throws -> [CategorySafetyRule]
    func getRule(category: MedicationCategory, type: CategorySafetyRuleType) throws -> CategorySafetyRule?
    func upsert(_ rule: CategorySafetyRule) throws
    func delete(id: String) throws
    /// Distinct calendar days (local time) on which ANY medication in the given
    /// category had a dose with status 'taken' in the last `windowDays`.
    func countUsageDays(category: MedicationCategory, windowDays: Int, now: Date) throws -> Int
}
```

- [ ] **Step 3: Leave the existing repo class temporarily broken**

The class `CategoryUsageLimitRepository` now has methods (`getAllLimits`, `setLimit`, `clearLimit`, `getLimit`) that no longer match the protocol. That is intentional — we fix it in Task 3 by replacing the whole class. Do not attempt to keep both APIs alive.

Do not build yet. This task is staged groundwork; it compiles at the end of Task 3.

- [ ] **Step 4: Commit (model + protocol change)**

```bash
git add mobile-apps/ios/MigraLog/Repositories/CategoryUsageLimitRepository.swift \
        mobile-apps/ios/MigraLog/Repositories/Protocols.swift
git commit -m "feat(ios): introduce CategorySafetyRule model and protocol"
```

---

## Task 3: Rename + rewrite repository implementation

**Files:**
- Rename: `CategoryUsageLimitRepository.swift` → `CategorySafetyRuleRepository.swift`
- Rename: `MigraLogTests/Repositories/CategoryUsageLimitRepositoryTests.swift` → `CategorySafetyRuleRepositoryTests.swift`
- Modify: `mobile-apps/ios/MigraLog.xcodeproj/project.pbxproj` (via `project.yml` regeneration if xcodegen is used, or manual edit — see note below)

**Note on project file:** This project uses `project.yml` + XcodeGen (see `mobile-apps/ios/project.yml`). After renaming files on disk, regenerate with:
```bash
cd mobile-apps/ios && xcodegen generate
```
If `xcodegen` is not installed or fails, edit `MigraLog.xcodeproj/project.pbxproj` manually by find-and-replace of the old basename to the new one. Verify by opening the project in Xcode.

- [ ] **Step 1: Rename the files on disk**

```bash
git mv mobile-apps/ios/MigraLog/Repositories/CategoryUsageLimitRepository.swift \
       mobile-apps/ios/MigraLog/Repositories/CategorySafetyRuleRepository.swift
git mv mobile-apps/ios/MigraLogTests/Repositories/CategoryUsageLimitRepositoryTests.swift \
       mobile-apps/ios/MigraLogTests/Repositories/CategorySafetyRuleRepositoryTests.swift
```

- [ ] **Step 2: Regenerate the project file**

```bash
cd mobile-apps/ios && xcodegen generate && cd -
```
If xcodegen is unavailable, run:
```bash
grep -l CategoryUsageLimitRepository mobile-apps/ios/MigraLog.xcodeproj/project.pbxproj
```
…and manually replace `CategoryUsageLimitRepository` with `CategorySafetyRuleRepository` in `project.pbxproj`.

- [ ] **Step 3: Write the failing repository tests**

Replace the contents of `mobile-apps/ios/MigraLogTests/Repositories/CategorySafetyRuleRepositoryTests.swift` with:

```swift
import XCTest
@testable import MigraLog

final class CategorySafetyRuleRepositoryTests: XCTestCase {
    private var dbManager: DatabaseManager!
    private var repo: CategorySafetyRuleRepository!

    override func setUpWithError() throws {
        dbManager = try DatabaseManager(inMemory: true)
        repo = CategorySafetyRuleRepository(dbManager: dbManager)
    }

    override func tearDown() {
        dbManager = nil
        repo = nil
    }

    func test_upsert_and_getRule_roundtrips() throws {
        let rule = CategorySafetyRule(
            id: UUID().uuidString,
            category: .nsaid,
            type: .cooldown,
            periodHours: 4.0,
            maxCount: nil,
            createdAt: Date(timeIntervalSince1970: 1_700_000_000)
        )
        try repo.upsert(rule)

        let fetched = try repo.getRule(category: .nsaid, type: .cooldown)
        XCTAssertEqual(fetched?.id, rule.id)
        XCTAssertEqual(fetched?.periodHours, 4.0)
        XCTAssertNil(fetched?.maxCount)
    }

    func test_upsert_replaces_existing_rule_for_same_category_and_type() throws {
        let first = CategorySafetyRule(
            id: "a", category: .nsaid, type: .cooldown,
            periodHours: 4.0, maxCount: nil, createdAt: Date()
        )
        let second = CategorySafetyRule(
            id: "b", category: .nsaid, type: .cooldown,
            periodHours: 6.0, maxCount: nil, createdAt: Date()
        )
        try repo.upsert(first)
        try repo.upsert(second)

        let all = try repo.getRules(for: .nsaid)
        XCTAssertEqual(all.count, 1)
        XCTAssertEqual(all[0].periodHours, 6.0)
    }

    func test_can_store_cooldown_and_period_limit_for_same_category() throws {
        let cooldown = CategorySafetyRule(
            id: "c", category: .nsaid, type: .cooldown,
            periodHours: 4.0, maxCount: nil, createdAt: Date()
        )
        let limit = CategorySafetyRule(
            id: "l", category: .nsaid, type: .periodLimit,
            periodHours: 720.0, maxCount: 15, createdAt: Date()
        )
        try repo.upsert(cooldown)
        try repo.upsert(limit)

        let all = try repo.getRules(for: .nsaid)
        XCTAssertEqual(all.count, 2)
        XCTAssertTrue(all.contains(where: { $0.type == .cooldown }))
        XCTAssertTrue(all.contains(where: { $0.type == .periodLimit }))
    }

    func test_delete_removes_only_target_rule() throws {
        let cooldown = CategorySafetyRule(
            id: "c", category: .nsaid, type: .cooldown,
            periodHours: 4.0, maxCount: nil, createdAt: Date()
        )
        let limit = CategorySafetyRule(
            id: "l", category: .nsaid, type: .periodLimit,
            periodHours: 720.0, maxCount: 15, createdAt: Date()
        )
        try repo.upsert(cooldown)
        try repo.upsert(limit)

        try repo.delete(id: "c")

        let all = try repo.getRules(for: .nsaid)
        XCTAssertEqual(all.count, 1)
        XCTAssertEqual(all[0].type, .periodLimit)
    }

    func test_countUsageDays_counts_distinct_local_days_of_taken_doses_for_category() throws {
        // Insert two NSAID meds and four doses across three days.
        try dbManager.dbQueue.write { db in
            try db.execute(sql: """
                INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, active,
                                          category, created_at, updated_at)
                VALUES ('m1','Advil','rescue',200,'mg',1,'nsaid',1,1),
                       ('m2','Naproxen','rescue',500,'mg',1,'nsaid',1,1),
                       ('m3','Tylenol','rescue',500,'mg',1,'otc',1,1)
                """)
            // 2026-04-10 / 2026-04-11 / 2026-04-12 at noon UTC — three distinct UTC days.
            // Local-day count depends on simulator TZ, but simulator default is UTC in CI.
            let d1 = Int64(Date(timeIntervalSince1970: 1_775_304_000).timeIntervalSince1970 * 1000) // 2026-04-11 12:00 UTC
            let d2 = d1 + 86_400_000 * 0 + 3_600_000 // same day
            let d3 = d1 + 86_400_000                 // next day
            let d4 = d1 + 2 * 86_400_000             // 2 days later
            try db.execute(
                sql: """
                    INSERT INTO medication_doses (id, medication_id, timestamp, quantity,
                                                   status, created_at, updated_at)
                    VALUES (?, 'm1', ?, 1, 'taken', 1, 1),
                           (?, 'm2', ?, 1, 'taken', 1, 1),
                           (?, 'm1', ?, 1, 'taken', 1, 1),
                           (?, 'm3', ?, 1, 'taken', 1, 1)
                    """,
                arguments: [UUID().uuidString, d1,
                            UUID().uuidString, d2,
                            UUID().uuidString, d3,
                            UUID().uuidString, d4]
            )
        }

        // NSAID rows: d1/d2 same day (counts 1), d3 = next day (counts 1). d4 is Tylenol (otc) — ignored.
        let count = try repo.countUsageDays(category: .nsaid, windowDays: 30, now: Date(timeIntervalSince1970: 1_775_500_000))
        XCTAssertEqual(count, 2)
    }
}
```

- [ ] **Step 4: Rewrite the repository class**

Open `mobile-apps/ios/MigraLog/Repositories/CategorySafetyRuleRepository.swift`. Keep the `// MARK: - Model` section already added in Task 2. Replace everything from `// MARK: - Implementation` downward with:

```swift
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
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd mobile-apps/ios && xcodebuild test \
  -project MigraLog.xcodeproj -scheme MigraLog \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0' \
  -only-testing:MigraLogTests/CategorySafetyRuleRepositoryTests 2>&1 | tail -20
```

Expected: all tests pass.

Build will still fail elsewhere (the view models still reference the old protocol name) — that's OK; subsequent tasks fix those. The repo tests themselves should compile and pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ios): rename CategoryUsageLimitRepository → CategorySafetyRuleRepository"
```

---

## Task 4: `MedicationRepository.getLastTakenDoseInCategory`

**Files:**
- Modify: `mobile-apps/ios/MigraLog/Repositories/Protocols.swift` (extend `MedicationRepositoryProtocol`)
- Modify: `mobile-apps/ios/MigraLog/Repositories/MedicationRepository.swift`
- Test: `mobile-apps/ios/MigraLogTests/Repositories/MedicationRepositoryTests.swift` (append test method)

**Goal:** New query that returns the most recent `taken` dose in a given category, along with the medication's name. Used by the category-cooldown evaluator.

- [ ] **Step 1: Write the failing test**

Open `mobile-apps/ios/MigraLogTests/Repositories/MedicationRepositoryTests.swift`. Append at the bottom of the class (before the final `}`):

```swift
    func test_getLastTakenDoseInCategory_returns_latest_dose_with_med_name() throws {
        // Two NSAIDs — Naproxen older, Advil newer. Plus an OTC med to ignore.
        try dbManager.dbQueue.write { db in
            try db.execute(sql: """
                INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, active,
                                          category, created_at, updated_at)
                VALUES ('m1','Advil','rescue',200,'mg',1,'nsaid',1,1),
                       ('m2','Naproxen','rescue',500,'mg',1,'nsaid',1,1),
                       ('m3','Tylenol','rescue',500,'mg',1,'otc',1,1)
                """)
            try db.execute(sql: """
                INSERT INTO medication_doses (id, medication_id, timestamp, quantity, status, created_at, updated_at)
                VALUES ('d1','m2',1000,1,'taken',1,1),
                       ('d2','m1',2000,1,'taken',1,1),
                       ('d3','m3',3000,1,'taken',1,1)
                """)
        }

        let result = try repo.getLastTakenDoseInCategory(.nsaid, now: Date(timeIntervalSince1970: 1_000_000))
        XCTAssertEqual(result?.medicationName, "Advil")
        XCTAssertEqual(result?.dose.medicationId, "m1")
    }

    func test_getLastTakenDoseInCategory_ignores_skipped_doses() throws {
        try dbManager.dbQueue.write { db in
            try db.execute(sql: """
                INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, active,
                                          category, created_at, updated_at)
                VALUES ('m1','Advil','rescue',200,'mg',1,'nsaid',1,1)
                """)
            try db.execute(sql: """
                INSERT INTO medication_doses (id, medication_id, timestamp, quantity, status, created_at, updated_at)
                VALUES ('d1','m1',1000,0,'skipped',1,1)
                """)
        }

        let result = try repo.getLastTakenDoseInCategory(.nsaid, now: Date(timeIntervalSince1970: 1_000_000))
        XCTAssertNil(result)
    }

    func test_getLastTakenDoseInCategory_returns_nil_when_no_doses() throws {
        let result = try repo.getLastTakenDoseInCategory(.nsaid, now: Date())
        XCTAssertNil(result)
    }
```

- [ ] **Step 2: Run test to verify failure**

```bash
cd mobile-apps/ios && xcodebuild test \
  -project MigraLog.xcodeproj -scheme MigraLog \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0' \
  -only-testing:MigraLogTests/MedicationRepositoryTests/test_getLastTakenDoseInCategory_returns_latest_dose_with_med_name 2>&1 | tail -15
```

Expected: compile error — method not found.

- [ ] **Step 3: Add the protocol method**

Edit `mobile-apps/ios/MigraLog/Repositories/Protocols.swift`. Inside `protocol MedicationRepositoryProtocol: Sendable { ... }` add at the end (just before its closing `}`):

```swift
    /// Most recent 'taken' dose in the given category (across all medications),
    /// on or before `now`. Returns the dose plus the medication's display name.
    /// Nil when there is no such dose.
    func getLastTakenDoseInCategory(
        _ category: MedicationCategory,
        now: Date
    ) throws -> (dose: MedicationDose, medicationName: String)?
```

- [ ] **Step 4: Implement on `MedicationRepository`**

Edit `mobile-apps/ios/MigraLog/Repositories/MedicationRepository.swift`. Add the following method inside the class (near other dose queries):

```swift
    func getLastTakenDoseInCategory(
        _ category: MedicationCategory,
        now: Date
    ) throws -> (dose: MedicationDose, medicationName: String)? {
        let endTs = TimestampHelper.fromDate(now)
        return try dbManager.dbQueue.read { db in
            let row = try Row.fetchOne(
                db,
                sql: """
                    SELECT d.*, m.name AS medication_name
                    FROM medication_doses d
                    INNER JOIN medications m ON m.id = d.medication_id
                    WHERE m.category = ?
                      AND d.status = 'taken'
                      AND d.timestamp <= ?
                    ORDER BY d.timestamp DESC
                    LIMIT 1
                    """,
                arguments: [category.rawValue, endTs]
            )
            guard let row else { return nil }
            guard let dose = Self.doseFromRow(row) else { return nil }
            let name: String = row["medication_name"] ?? ""
            return (dose, name)
        }
    }
```

If `Self.doseFromRow(_:)` isn't already private static on the class, use whatever the file's existing row-mapper is (look for how other dose queries decode rows; the helper is likely named `doseFromRow` or `mapDose`). If the helper is instance-scoped, call it via `self.` instead of `Self.`.

- [ ] **Step 5: Run tests**

```bash
cd mobile-apps/ios && xcodebuild test \
  -project MigraLog.xcodeproj -scheme MigraLog \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0' \
  -only-testing:MigraLogTests/MedicationRepositoryTests 2>&1 | tail -10
```

Expected: new tests pass; existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add mobile-apps/ios/MigraLog/Repositories/Protocols.swift \
        mobile-apps/ios/MigraLog/Repositories/MedicationRepository.swift \
        mobile-apps/ios/MigraLogTests/Repositories/MedicationRepositoryTests.swift
git commit -m "feat(ios): add MedicationRepository.getLastTakenDoseInCategory"
```

---

## Task 5: `CategoryCooldown` evaluator

**Files:**
- Create: `mobile-apps/ios/MigraLog/Services/CategoryCooldown.swift`
- Create: `mobile-apps/ios/MigraLogTests/Services/CategoryCooldownTests.swift`

**Goal:** Pure function mirroring `MedicationCooldown.evaluate` but for a category rule + the most recent dose-in-category.

- [ ] **Step 1: Write failing tests**

Create `mobile-apps/ios/MigraLogTests/Services/CategoryCooldownTests.swift`:

```swift
import XCTest
@testable import MigraLog

final class CategoryCooldownTests: XCTestCase {

    private func makeRule(hours: Double) -> CategorySafetyRule {
        CategorySafetyRule(
            id: "r", category: .nsaid, type: .cooldown,
            periodHours: hours, maxCount: nil, createdAt: Date()
        )
    }

    private func makeDose(at date: Date, med: String = "m1") -> MedicationDose {
        MedicationDose(
            id: UUID().uuidString,
            medicationId: med,
            timestamp: TimestampHelper.fromDate(date),
            quantity: 1,
            dosageAmount: 200,
            dosageUnit: "mg",
            status: .taken,
            episodeId: nil,
            effectivenessRating: nil,
            timeToRelief: nil,
            sideEffects: [],
            notes: nil,
            createdAt: TimestampHelper.fromDate(date),
            updatedAt: TimestampHelper.fromDate(date)
        )
    }

    func test_no_rule_returns_not_on_cooldown_with_nil_interval() {
        let status = CategoryCooldown.evaluate(
            category: .nsaid,
            lastDoseInCategory: nil,
            cooldownRule: nil
        )
        XCTAssertFalse(status.isOnCooldown)
        XCTAssertNil(status.minIntervalHours)
        XCTAssertNil(status.lastMedicationName)
    }

    func test_no_prior_dose_returns_not_on_cooldown_but_carries_interval() {
        let status = CategoryCooldown.evaluate(
            category: .nsaid,
            lastDoseInCategory: nil,
            cooldownRule: makeRule(hours: 4.0)
        )
        XCTAssertFalse(status.isOnCooldown)
        XCTAssertEqual(status.minIntervalHours, 4.0)
        XCTAssertNil(status.lastMedicationName)
        XCTAssertNil(status.hoursSinceLastDose)
    }

    func test_on_cooldown_when_recent_dose_and_rule_configured() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let dose = makeDose(at: now.addingTimeInterval(-3600)) // 1h ago
        let status = CategoryCooldown.evaluate(
            category: .nsaid,
            lastDoseInCategory: (dose, "Advil"),
            cooldownRule: makeRule(hours: 4.0),
            now: now
        )
        XCTAssertTrue(status.isOnCooldown)
        XCTAssertEqual(status.hoursSinceLastDose ?? -1, 1.0, accuracy: 0.01)
        XCTAssertEqual(status.hoursUntilNextDose, 3.0, accuracy: 0.01)
        XCTAssertEqual(status.lastMedicationName, "Advil")
    }

    func test_not_on_cooldown_when_interval_elapsed() {
        let now = Date(timeIntervalSince1970: 1_800_000_000)
        let dose = makeDose(at: now.addingTimeInterval(-5 * 3600)) // 5h ago
        let status = CategoryCooldown.evaluate(
            category: .nsaid,
            lastDoseInCategory: (dose, "Advil"),
            cooldownRule: makeRule(hours: 4.0),
            now: now
        )
        XCTAssertFalse(status.isOnCooldown)
        XCTAssertEqual(status.hoursUntilNextDose, 0)
        XCTAssertEqual(status.hoursSinceLastDose ?? -1, 5.0, accuracy: 0.01)
        XCTAssertEqual(status.lastMedicationName, "Advil")
    }

    func test_same_med_still_reports_category_cooldown() {
        // If the last dose in category IS the same med the user is about to log,
        // we still surface the category cooldown — oversharing is preferable.
        let now = Date()
        let dose = makeDose(at: now.addingTimeInterval(-1800), med: "advil-id")
        let status = CategoryCooldown.evaluate(
            category: .nsaid,
            lastDoseInCategory: (dose, "Advil"),
            cooldownRule: makeRule(hours: 4.0),
            now: now
        )
        XCTAssertTrue(status.isOnCooldown)
        XCTAssertEqual(status.lastMedicationName, "Advil")
    }
}
```

- [ ] **Step 2: Run to verify failure**

```bash
cd mobile-apps/ios && xcodebuild test \
  -project MigraLog.xcodeproj -scheme MigraLog \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0' \
  -only-testing:MigraLogTests/CategoryCooldownTests 2>&1 | tail -10
```

Expected: compile error — `CategoryCooldown` not defined.

- [ ] **Step 3: Implement `CategoryCooldown.swift`**

Create `mobile-apps/ios/MigraLog/Services/CategoryCooldown.swift`:

```swift
import Foundation

/// Pure functions for evaluating category-wide cooldown state — the minimum
/// interval between any dose in a medication category (e.g. NSAIDs). Mirrors
/// `MedicationCooldown` but across meds within a category.
enum CategoryCooldown {
    struct Status: Equatable {
        let isOnCooldown: Bool
        let hoursSinceLastDose: Double?
        let hoursUntilNextDose: Double
        let minIntervalHours: Double?
        let lastMedicationName: String?
    }

    /// Evaluate category cooldown status.
    /// - Parameters:
    ///   - category: The category being evaluated (carried for future use; not
    ///     used today but keeps the signature symmetric with MedicationCooldown).
    ///   - lastDoseInCategory: The most recent 'taken' dose in the category and
    ///     its medication's display name, or nil if none.
    ///   - cooldownRule: The configured cooldown rule (type == .cooldown) or nil.
    ///   - now: The evaluation moment. Defaults to Date().
    static func evaluate(
        category: MedicationCategory,
        lastDoseInCategory: (dose: MedicationDose, medicationName: String)?,
        cooldownRule: CategorySafetyRule?,
        now: Date = Date()
    ) -> Status {
        guard let rule = cooldownRule, rule.type == .cooldown, rule.periodHours > 0 else {
            return Status(
                isOnCooldown: false,
                hoursSinceLastDose: nil,
                hoursUntilNextDose: 0,
                minIntervalHours: nil,
                lastMedicationName: lastDoseInCategory?.medicationName
            )
        }
        guard let last = lastDoseInCategory else {
            return Status(
                isOnCooldown: false,
                hoursSinceLastDose: nil,
                hoursUntilNextDose: 0,
                minIntervalHours: rule.periodHours,
                lastMedicationName: nil
            )
        }
        let elapsed = now.timeIntervalSince(last.dose.date) / 3600.0
        let remaining = max(0, rule.periodHours - elapsed)
        return Status(
            isOnCooldown: remaining > 0,
            hoursSinceLastDose: elapsed,
            hoursUntilNextDose: remaining,
            minIntervalHours: rule.periodHours,
            lastMedicationName: last.medicationName
        )
    }
}
```

Note: `MedicationDose.date` must be a `Date` accessor on the model. If it does not exist, check `MedicationCooldown.swift` — it uses `lastDose.date`, so the accessor already exists. If for some reason it doesn't, compute it inline: `Date(timeIntervalSince1970: TimeInterval(last.dose.timestamp) / 1000.0)`.

- [ ] **Step 4: Regenerate project to include the new file**

```bash
cd mobile-apps/ios && xcodegen generate && cd -
```

- [ ] **Step 5: Run tests**

```bash
cd mobile-apps/ios && xcodebuild test \
  -project MigraLog.xcodeproj -scheme MigraLog \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0' \
  -only-testing:MigraLogTests/CategoryCooldownTests 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add mobile-apps/ios/MigraLog/Services/CategoryCooldown.swift \
        mobile-apps/ios/MigraLogTests/Services/CategoryCooldownTests.swift \
        mobile-apps/ios/MigraLog.xcodeproj/project.pbxproj
git commit -m "feat(ios): add CategoryCooldown evaluator"
```

---

## Task 6: Adapt `CategoryUsageStatus.evaluate` to take `CategorySafetyRule`

**Files:**
- Modify: `mobile-apps/ios/MigraLog/Services/CategoryUsageStatus.swift:15-24`
- Modify: `mobile-apps/ios/MigraLogTests/Services/CategoryUsageStatusTests.swift`

**Goal:** The MOH-warning evaluator currently takes `CategoryUsageLimit?`. Swap to `CategorySafetyRule?` and require `rule.type == .periodLimit` (return `.noLimit` for cooldown rules or nil).

- [ ] **Step 1: Update the existing tests for the new signature**

Open `mobile-apps/ios/MigraLogTests/Services/CategoryUsageStatusTests.swift`. Replace every construction of `CategoryUsageLimit(category: ..., maxDays: X, windowDays: Y)` with:

```swift
CategorySafetyRule(
    id: UUID().uuidString,
    category: .nsaid,
    type: .periodLimit,
    periodHours: Double(Y) * 24.0,
    maxCount: X,
    createdAt: Date()
)
```

Use the category relevant to each test where `.nsaid` is not correct. Add at least one new test:

```swift
    func test_cooldown_rule_is_not_used_for_MOH_evaluation() {
        let cooldown = CategorySafetyRule(
            id: "c", category: .nsaid, type: .cooldown,
            periodHours: 4.0, maxCount: nil, createdAt: Date()
        )
        let status = CategoryUsageStatus.evaluate(daysUsed: 14, limit: cooldown)
        XCTAssertEqual(status, .noLimit)
    }
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd mobile-apps/ios && xcodebuild test \
  -project MigraLog.xcodeproj -scheme MigraLog \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0' \
  -only-testing:MigraLogTests/CategoryUsageStatusTests 2>&1 | tail -10
```

Expected: compile errors on `limit.maxDays`/`limit.windowDays`.

- [ ] **Step 3: Update `CategoryUsageStatus.evaluate`**

Edit `mobile-apps/ios/MigraLog/Services/CategoryUsageStatus.swift`. Replace `static func evaluate` with:

```swift
    /// Thresholds:
    /// - `atOrOver` when `daysUsed >= maxDays`
    /// - `approaching` when `daysUsed >= maxDays - 2`
    /// - `ok` otherwise
    /// - `.noLimit` when `limit` is nil or is not a period_limit rule.
    static func evaluate(daysUsed: Int, limit: CategorySafetyRule?) -> CategoryUsageStatus {
        guard let limit, limit.type == .periodLimit,
              let maxDays = limit.maxCount else {
            return .noLimit
        }
        let windowDays = limit.windowDays
        if daysUsed >= maxDays {
            return .atOrOver(daysUsed: daysUsed, maxDays: maxDays, windowDays: windowDays)
        }
        if daysUsed >= maxDays - 2 {
            return .approaching(daysUsed: daysUsed, maxDays: maxDays, windowDays: windowDays)
        }
        return .ok(daysUsed: daysUsed, maxDays: maxDays, windowDays: windowDays)
    }
```

- [ ] **Step 4: Run tests**

```bash
cd mobile-apps/ios && xcodebuild test \
  -project MigraLog.xcodeproj -scheme MigraLog \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0' \
  -only-testing:MigraLogTests/CategoryUsageStatusTests 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile-apps/ios/MigraLog/Services/CategoryUsageStatus.swift \
        mobile-apps/ios/MigraLogTests/Services/CategoryUsageStatusTests.swift
git commit -m "feat(ios): CategoryUsageStatus consumes CategorySafetyRule period_limit"
```

---

## Task 7: `MedicationCategory.cooldownPreset`

**Files:**
- Modify: `mobile-apps/ios/MigraLog/Models/Enums.swift` (after existing `mohPreset` extension)

**Goal:** Auto-fill default for Triptan cooldown (2h) in the editor sheet's add flow. Other categories return nil.

- [ ] **Step 1: Add the preset**

In `mobile-apps/ios/MigraLog/Models/Enums.swift`, directly after the `mohPreset` extension, add:

```swift
extension MedicationCategory {
    /// Common cooldown-guideline defaults used to pre-fill the Add Cooldown
    /// sheet. Informational only — not medical advice. Leave nil for categories
    /// without a well-established single guideline (e.g. NSAIDs vary by drug).
    var cooldownPreset: Double? {
        switch self {
        case .triptan: return 2.0
        case .otc, .nsaid, .cgrp, .preventive, .supplement, .other:
            return nil
        }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add mobile-apps/ios/MigraLog/Models/Enums.swift
git commit -m "feat(ios): add MedicationCategory.cooldownPreset (Triptan = 2h)"
```

No direct test — exercised in editor-sheet tests in Task 9.

---

## Task 8: Rename + rewrite `CategoryLimitsViewModel`

**Files:**
- Rename: `ViewModels/CategoryLimitsViewModel.swift` → `ViewModels/CategorySafetyRulesViewModel.swift`
- Rename: `MigraLogTests/ViewModels/CategoryLimitsViewModelTests.swift` → `CategorySafetyRulesViewModelTests.swift`

**Goal:** The view model now holds a list of all rules (not a per-category map) and exposes helpers for the Add flow to know which (category, type) pairs are still addable.

- [ ] **Step 1: Rename on disk and regenerate project**

```bash
git mv mobile-apps/ios/MigraLog/ViewModels/CategoryLimitsViewModel.swift \
       mobile-apps/ios/MigraLog/ViewModels/CategorySafetyRulesViewModel.swift
git mv mobile-apps/ios/MigraLogTests/ViewModels/CategoryLimitsViewModelTests.swift \
       mobile-apps/ios/MigraLogTests/ViewModels/CategorySafetyRulesViewModelTests.swift
cd mobile-apps/ios && xcodegen generate && cd -
```

- [ ] **Step 2: Update the tests**

Replace the entire contents of `mobile-apps/ios/MigraLogTests/ViewModels/CategorySafetyRulesViewModelTests.swift` with:

```swift
import XCTest
@testable import MigraLog

@MainActor
final class CategorySafetyRulesViewModelTests: XCTestCase {
    private final class StubRepo: CategorySafetyRuleRepositoryProtocol, @unchecked Sendable {
        var rules: [CategorySafetyRule] = []

        func getAllRules() throws -> [CategorySafetyRule] { rules }
        func getRules(for category: MedicationCategory) throws -> [CategorySafetyRule] {
            rules.filter { $0.category == category }
        }
        func getRule(category: MedicationCategory, type: CategorySafetyRuleType) throws -> CategorySafetyRule? {
            rules.first { $0.category == category && $0.type == type }
        }
        func upsert(_ rule: CategorySafetyRule) throws {
            rules.removeAll { $0.category == rule.category && $0.type == rule.type }
            rules.append(rule)
        }
        func delete(id: String) throws {
            rules.removeAll { $0.id == id }
        }
        func countUsageDays(category: MedicationCategory, windowDays: Int, now: Date) throws -> Int { 0 }
    }

    func test_loadRules_populates_from_repository() async {
        let repo = StubRepo()
        repo.rules = [
            CategorySafetyRule(id: "1", category: .nsaid, type: .periodLimit,
                               periodHours: 720, maxCount: 15, createdAt: Date()),
            CategorySafetyRule(id: "2", category: .triptan, type: .cooldown,
                               periodHours: 2, maxCount: nil, createdAt: Date())
        ]
        let vm = CategorySafetyRulesViewModel(repository: repo)
        vm.loadRules()
        XCTAssertEqual(vm.rules.count, 2)
    }

    func test_addable_pairs_excludes_already_configured_types() async {
        let repo = StubRepo()
        repo.rules = [
            CategorySafetyRule(id: "1", category: .nsaid, type: .periodLimit,
                               periodHours: 720, maxCount: 15, createdAt: Date())
        ]
        let vm = CategorySafetyRulesViewModel(repository: repo)
        vm.loadRules()

        // NSAID has period_limit configured; cooldown still addable.
        let nsaidTypes = vm.addableTypes(for: .nsaid)
        XCTAssertEqual(nsaidTypes, [.cooldown])

        // Triptan has nothing configured; both types addable.
        let triptanTypes = vm.addableTypes(for: .triptan)
        XCTAssertEqual(Set(triptanTypes), Set([.cooldown, .periodLimit]))
    }

    func test_addableCategories_excludes_fully_configured_categories() async {
        let repo = StubRepo()
        repo.rules = [
            CategorySafetyRule(id: "1", category: .nsaid, type: .periodLimit,
                               periodHours: 720, maxCount: 15, createdAt: Date()),
            CategorySafetyRule(id: "2", category: .nsaid, type: .cooldown,
                               periodHours: 4, maxCount: nil, createdAt: Date())
        ]
        let vm = CategorySafetyRulesViewModel(repository: repo)
        vm.loadRules()

        XCTAssertFalse(vm.addableCategories.contains(.nsaid))
        XCTAssertTrue(vm.addableCategories.contains(.triptan))
    }

    func test_saveRule_persists_and_updates_state() async {
        let repo = StubRepo()
        let vm = CategorySafetyRulesViewModel(repository: repo)
        let rule = CategorySafetyRule(id: "x", category: .nsaid, type: .cooldown,
                                      periodHours: 4, maxCount: nil, createdAt: Date())
        vm.saveRule(rule)
        XCTAssertEqual(repo.rules.count, 1)
        XCTAssertTrue(vm.rules.contains(where: { $0.id == "x" }))
    }

    func test_deleteRule_removes_from_state_and_repo() async {
        let repo = StubRepo()
        let rule = CategorySafetyRule(id: "x", category: .nsaid, type: .cooldown,
                                      periodHours: 4, maxCount: nil, createdAt: Date())
        repo.rules = [rule]
        let vm = CategorySafetyRulesViewModel(repository: repo)
        vm.loadRules()

        vm.deleteRule(id: "x")

        XCTAssertTrue(repo.rules.isEmpty)
        XCTAssertFalse(vm.rules.contains(where: { $0.id == "x" }))
    }
}
```

- [ ] **Step 3: Rewrite the view model**

Replace the entire contents of `mobile-apps/ios/MigraLog/ViewModels/CategorySafetyRulesViewModel.swift` with:

```swift
import Foundation
import Observation

/// View model backing the Medication Safety Limits screen. Holds the full list
/// of configured category safety rules (cooldowns and period-limits). Each rule
/// is a separate list row; a category can have at most one rule of each type.
@Observable
@MainActor
final class CategorySafetyRulesViewModel {
    /// All configured rules, sorted by `(category, type)` to match the list UI.
    var rules: [CategorySafetyRule] = []
    var error: String?

    private let repository: CategorySafetyRuleRepositoryProtocol

    init(
        repository: CategorySafetyRuleRepositoryProtocol = CategorySafetyRuleRepository(dbManager: DatabaseManager.shared)
    ) {
        self.repository = repository
    }

    /// Categories with at least one rule type still unconfigured.
    var addableCategories: [MedicationCategory] {
        MedicationCategory.allCases.filter { !addableTypes(for: $0).isEmpty }
    }

    /// Rule types still addable for a given category (sorted deterministically).
    func addableTypes(for category: MedicationCategory) -> [CategorySafetyRuleType] {
        let existing = Set(rules.filter { $0.category == category }.map(\.type))
        return CategorySafetyRuleType.allCases.filter { !existing.contains($0) }
    }

    /// Whether the toolbar "+" should be enabled.
    var canAddMoreRules: Bool { !addableCategories.isEmpty }

    func loadRules() {
        do {
            let all = try repository.getAllRules()
            rules = sorted(all)
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "CategorySafetyRulesViewModel", "action": "loadRules"])
            self.error = error.localizedDescription
        }
    }

    func saveRule(_ rule: CategorySafetyRule) {
        do {
            try repository.upsert(rule)
            // Remove any existing entry with the same (category, type) before appending.
            rules.removeAll { $0.category == rule.category && $0.type == rule.type }
            rules.append(rule)
            rules = sorted(rules)
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "CategorySafetyRulesViewModel", "action": "saveRule"])
            self.error = error.localizedDescription
        }
    }

    func deleteRule(id: String) {
        do {
            try repository.delete(id: id)
            rules.removeAll { $0.id == id }
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "CategorySafetyRulesViewModel", "action": "deleteRule"])
            self.error = error.localizedDescription
        }
    }

    // MARK: - Sorting

    private func sorted(_ input: [CategorySafetyRule]) -> [CategorySafetyRule] {
        input.sorted { (a, b) in
            if a.category.rawValue != b.category.rawValue {
                // Preserve MedicationCategory.allCases ordering.
                let order = MedicationCategory.allCases
                let ai = order.firstIndex(of: a.category) ?? Int.max
                let bi = order.firstIndex(of: b.category) ?? Int.max
                return ai < bi
            }
            // Within a category: period_limit first, then cooldown.
            return a.type == .periodLimit && b.type == .cooldown
        }
    }
}
```

- [ ] **Step 4: Run tests**

```bash
cd mobile-apps/ios && xcodebuild test \
  -project MigraLog.xcodeproj -scheme MigraLog \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0' \
  -only-testing:MigraLogTests/CategorySafetyRulesViewModelTests 2>&1 | tail -15
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ios): CategorySafetyRulesViewModel holds list of rules"
```

---

## Task 9: Rewrite `CategoryLimitEditorSheet` → `CategorySafetyRuleEditorSheet`

**Files:**
- Rename: `Views/Settings/CategoryLimitEditorSheet.swift` → `Views/Settings/CategorySafetyRuleEditorSheet.swift`

**Goal:** Editor sheet now accepts rule type selection in add mode; form fields adapt to `.cooldown` vs `.periodLimit`. Applies Triptan cooldown preset on add.

- [ ] **Step 1: Rename on disk and regenerate project**

```bash
git mv mobile-apps/ios/MigraLog/Views/Settings/CategoryLimitEditorSheet.swift \
       mobile-apps/ios/MigraLog/Views/Settings/CategorySafetyRuleEditorSheet.swift
cd mobile-apps/ios && xcodegen generate && cd -
```

- [ ] **Step 2: Replace the entire file contents**

```swift
import SwiftUI

/// Modal sheet for adding or editing a single `CategorySafetyRule`.
/// In add mode the user picks a category and a rule type from the supplied
/// (category → addable types) options; the form auto-fills with the category's
/// preset for the chosen type when one exists. In edit mode both category and
/// type are locked.
struct CategorySafetyRuleEditorSheet: View {
    enum Mode: Equatable {
        case add(available: [MedicationCategory: [CategorySafetyRuleType]])
        case edit(existing: CategorySafetyRule)
    }

    let mode: Mode
    let onSave: (CategorySafetyRule) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var selectedCategory: MedicationCategory?
    @State private var selectedType: CategorySafetyRuleType?

    // period_limit fields
    @State private var maxDaysText: String = ""
    @State private var windowDaysText: String = ""
    // cooldown fields
    @State private var cooldownHoursText: String = ""

    var body: some View {
        NavigationStack {
            Form {
                categorySection
                typeSection
                if resolvedType == .periodLimit { periodLimitSection }
                if resolvedType == .cooldown { cooldownSection }
            }
            .navigationTitle(navigationTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .accessibilityIdentifier("rule-editor-cancel")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(!isValid)
                        .accessibilityIdentifier("rule-editor-save")
                }
            }
            .onAppear(perform: configureInitialState)
            .presentationDetents([.medium])
        }
    }

    // MARK: - Sections

    @ViewBuilder
    private var categorySection: some View {
        switch mode {
        case .add(let available):
            Section("Category") {
                Picker("Category", selection: $selectedCategory) {
                    Text("Select a category").tag(MedicationCategory?.none)
                    ForEach(sortedCategories(in: available), id: \.self) { category in
                        Text(category.displayName).tag(Optional(category))
                    }
                }
                .accessibilityIdentifier("rule-editor-category-picker")
                .onChange(of: selectedCategory) { _, _ in
                    // Reset type + fields when category changes.
                    selectedType = nil
                    clearFormFields()
                }
            }
        case .edit(let existing):
            Section("Category") {
                Text(existing.category.displayName)
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private var typeSection: some View {
        switch mode {
        case .add(let available):
            if let category = selectedCategory, let types = available[category], !types.isEmpty {
                Section("Rule Type") {
                    Picker("Rule Type", selection: $selectedType) {
                        Text("Select a rule type").tag(CategorySafetyRuleType?.none)
                        ForEach(types, id: \.self) { type in
                            Text(typeDisplayName(type)).tag(Optional(type))
                        }
                    }
                    .accessibilityIdentifier("rule-editor-type-picker")
                    .onChange(of: selectedType) { _, newValue in
                        applyPresetIfAvailable(category: category, type: newValue)
                    }
                }
            }
        case .edit(let existing):
            Section("Rule Type") {
                Text(typeDisplayName(existing.type))
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var periodLimitSection: some View {
        Section {
            LabeledContent("Max days taken") {
                TextField("", text: $maxDaysText, prompt: Text("e.g. 15"))
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing)
                    .accessibilityIdentifier("rule-editor-max-days")
            }
            LabeledContent("In any rolling window of") {
                HStack(spacing: 4) {
                    TextField("", text: $windowDaysText, prompt: Text("e.g. 30"))
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing)
                        .accessibilityIdentifier("rule-editor-window-days")
                    Text("days")
                        .foregroundStyle(.secondary)
                }
            }
            if let warning = periodLimitValidationWarning {
                Text(warning)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }
        } header: {
            Text("Limit")
        } footer: {
            Text("Based on common MOH (medication overuse headache) guidelines — informational only. Talk to your doctor about thresholds appropriate for your situation. This app does not provide medical advice.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    private var cooldownSection: some View {
        Section {
            LabeledContent("Minimum time between doses") {
                HStack(spacing: 4) {
                    TextField("", text: $cooldownHoursText, prompt: Text("e.g. 4"))
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.trailing)
                        .accessibilityIdentifier("rule-editor-cooldown-hours")
                    Text("hours")
                        .foregroundStyle(.secondary)
                }
            }
        } header: {
            Text("Cooldown")
        } footer: {
            Text("Warns when any medication in this category was taken recently. Any medication in the category counts — warnings are informational only.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - Derived state

    private var navigationTitle: String {
        switch mode {
        case .add: return "Add Rule"
        case .edit(let existing): return existing.category.displayName
        }
    }

    private var resolvedCategory: MedicationCategory? {
        switch mode {
        case .add:                 return selectedCategory
        case .edit(let existing):  return existing.category
        }
    }

    private var resolvedType: CategorySafetyRuleType? {
        switch mode {
        case .add:                 return selectedType
        case .edit(let existing):  return existing.type
        }
    }

    private var parsedMaxDays: Int? {
        guard let v = Int(maxDaysText), v > 0 else { return nil }
        return v
    }

    private var parsedWindowDays: Int? {
        guard let v = Int(windowDaysText), v > 0 else { return nil }
        return v
    }

    private var parsedCooldownHours: Double? {
        guard let v = Double(cooldownHoursText), v > 0 else { return nil }
        return v
    }

    private var periodLimitValidationWarning: String? {
        guard let maxDays = parsedMaxDays, let windowDays = parsedWindowDays else {
            return nil
        }
        return maxDays > windowDays ? "Max days can't exceed the window." : nil
    }

    private var isValid: Bool {
        guard resolvedCategory != nil else { return false }
        switch resolvedType {
        case .none: return false
        case .periodLimit:
            guard let maxDays = parsedMaxDays, let windowDays = parsedWindowDays else { return false }
            return maxDays <= windowDays
        case .cooldown:
            return parsedCooldownHours != nil
        }
    }

    // MARK: - Lifecycle

    private func configureInitialState() {
        if case .edit(let existing) = mode {
            switch existing.type {
            case .periodLimit:
                maxDaysText = String(existing.maxCount ?? 0)
                windowDaysText = String(existing.windowDays)
            case .cooldown:
                cooldownHoursText = formatHours(existing.periodHours)
            }
        }
    }

    private func clearFormFields() {
        maxDaysText = ""
        windowDaysText = ""
        cooldownHoursText = ""
    }

    private func applyPresetIfAvailable(category: MedicationCategory, type: CategorySafetyRuleType?) {
        clearFormFields()
        guard let type else { return }
        switch type {
        case .periodLimit:
            if let preset = category.mohPreset {
                maxDaysText = String(preset.maxDays)
                windowDaysText = String(preset.windowDays)
            }
        case .cooldown:
            if let hours = category.cooldownPreset {
                cooldownHoursText = formatHours(hours)
            }
        }
    }

    private func save() {
        guard let category = resolvedCategory, let type = resolvedType else { return }
        let createdAt: Date
        let id: String
        if case .edit(let existing) = mode {
            createdAt = existing.createdAt
            id = existing.id
        } else {
            createdAt = Date()
            id = UUID().uuidString
        }

        let rule: CategorySafetyRule
        switch type {
        case .periodLimit:
            guard let maxDays = parsedMaxDays, let windowDays = parsedWindowDays,
                  maxDays <= windowDays else { return }
            rule = CategorySafetyRule(
                id: id,
                category: category,
                type: .periodLimit,
                periodHours: Double(windowDays) * 24.0,
                maxCount: maxDays,
                createdAt: createdAt
            )
        case .cooldown:
            guard let hours = parsedCooldownHours else { return }
            rule = CategorySafetyRule(
                id: id,
                category: category,
                type: .cooldown,
                periodHours: hours,
                maxCount: nil,
                createdAt: createdAt
            )
        }

        onSave(rule)
        dismiss()
    }

    // MARK: - Helpers

    private func typeDisplayName(_ type: CategorySafetyRuleType) -> String {
        switch type {
        case .cooldown:    return "Cooldown"
        case .periodLimit: return "Usage limit"
        }
    }

    private func formatHours(_ hours: Double) -> String {
        let rounded = (hours * 10).rounded() / 10
        if rounded.truncatingRemainder(dividingBy: 1) == 0 {
            return String(Int(rounded))
        }
        return String(rounded)
    }

    private func sortedCategories(in available: [MedicationCategory: [CategorySafetyRuleType]]) -> [MedicationCategory] {
        MedicationCategory.allCases.filter { available[$0]?.isEmpty == false }
    }
}

// MARK: - Identifiable (for .sheet(item:) presentation)

extension CategorySafetyRuleEditorSheet.Mode: Identifiable {
    var id: String {
        switch self {
        case .add:                 return "add"
        case .edit(let existing):  return "edit-\(existing.id)"
        }
    }
}
```

- [ ] **Step 3: Build to confirm compile**

```bash
cd mobile-apps/ios && xcodebuild build \
  -project MigraLog.xcodeproj -scheme MigraLog \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0' 2>&1 | tail -30
```

The screen file (Task 10) is not yet updated, so expect compile errors there pointing at old symbols. That is the next task.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(ios): rewrite editor sheet as CategorySafetyRuleEditorSheet with type picker"
```

---

## Task 10: Rewrite `CategoryLimitsScreen` → `CategorySafetyRulesScreen`

**Files:**
- Rename: `Views/Settings/CategoryLimitsScreen.swift` → `Views/Settings/CategorySafetyRulesScreen.swift`

**Goal:** List now renders one row per rule (two rows per category when both types are configured), with swipe-to-delete targeting a single rule. The screen keeps its `navigationTitle("Medication Safety Limits")`.

- [ ] **Step 1: Rename on disk and regenerate project**

```bash
git mv mobile-apps/ios/MigraLog/Views/Settings/CategoryLimitsScreen.swift \
       mobile-apps/ios/MigraLog/Views/Settings/CategorySafetyRulesScreen.swift
cd mobile-apps/ios && xcodegen generate && cd -
```

- [ ] **Step 2: Replace the file contents**

```swift
import SwiftUI

/// Settings screen listing the user's configured medication safety rules
/// (cooldowns and period-limits). A category can have up to one of each; each
/// rule is its own row. Tap a row to edit; swipe to delete that rule. Add via
/// the toolbar "+".
struct CategorySafetyRulesScreen: View {
    @State private var viewModel = CategorySafetyRulesViewModel()
    @State private var editorMode: CategorySafetyRuleEditorSheet.Mode?

    var body: some View {
        Group {
            if viewModel.rules.isEmpty {
                emptyState
            } else {
                rulesList
            }
        }
        .navigationTitle("Medication Safety Limits")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    presentAddSheet()
                } label: {
                    Image(systemName: "plus")
                }
                .disabled(!viewModel.canAddMoreRules)
                .accessibilityIdentifier("category-rules-add")
            }
        }
        .sheet(item: $editorMode) { mode in
            CategorySafetyRuleEditorSheet(mode: mode) { rule in
                viewModel.saveRule(rule)
            }
        }
        .task {
            viewModel.loadRules()
        }
    }

    // MARK: - Empty state

    private var emptyState: some View {
        ContentUnavailableView {
            Label("No Rules Configured", systemImage: "shield.lefthalf.filled")
        } description: {
            Text("Optional warnings for medication-overuse headache risk and minimum dose spacing. These are informational only — talk to your doctor before relying on them.")
        } actions: {
            Button {
                presentAddSheet()
            } label: {
                Text("Add Rule")
                    .fontWeight(.semibold)
            }
            .buttonStyle(.borderedProminent)
            .accessibilityIdentifier("category-rules-empty-add")
        }
    }

    // MARK: - List

    private var rulesList: some View {
        List {
            Section {
                ForEach(viewModel.rules) { rule in
                    Button {
                        editorMode = .edit(existing: rule)
                    } label: {
                        ruleRow(rule)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("rule-row-\(rule.id)")
                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                        Button(role: .destructive) {
                            viewModel.deleteRule(id: rule.id)
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                        .accessibilityIdentifier("rule-row-delete-\(rule.id)")
                    }
                }
            } footer: {
                Text("Informational warnings only — not medical advice. The app will not block you from logging doses. Talk to your doctor about appropriate thresholds. Common guidelines: NSAIDs 15/30 days, Triptans 10/30 days and 2 h between doses.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func ruleRow(_ rule: CategorySafetyRule) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(rule.category.displayName)
                    .font(.body)
                Text(summary(for: rule))
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.footnote)
                .foregroundStyle(.tertiary)
                .accessibilityHidden(true)
        }
        .contentShape(Rectangle())
    }

    // MARK: - Helpers

    private func summary(for rule: CategorySafetyRule) -> String {
        switch rule.type {
        case .periodLimit:
            let maxDays = rule.maxCount ?? 0
            return "\(maxDays) days in any \(rule.windowDays) days"
        case .cooldown:
            return "\(formatHours(rule.periodHours)) between doses"
        }
    }

    private func formatHours(_ hours: Double) -> String {
        if hours.truncatingRemainder(dividingBy: 1) == 0 {
            return "\(Int(hours))h"
        }
        return String(format: "%.1fh", hours)
    }

    private func presentAddSheet() {
        let available = Dictionary(
            uniqueKeysWithValues: viewModel.addableCategories.map { category in
                (category, viewModel.addableTypes(for: category))
            }
        )
        editorMode = .add(available: available)
    }
}
```

- [ ] **Step 3: Find and update the settings navigation entry point**

```bash
grep -rn "CategoryLimitsScreen" mobile-apps/ios/MigraLog
```

Replace every occurrence with `CategorySafetyRulesScreen`. The entry is almost certainly in `mobile-apps/ios/MigraLog/Views/Settings/SettingsScreen.swift` or a navigation file. Update the usage, leaving any user-visible label strings (e.g. the row "Medication Safety Limits") unchanged.

- [ ] **Step 4: Build**

```bash
cd mobile-apps/ios && xcodebuild build \
  -project MigraLog.xcodeproj -scheme MigraLog \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0' 2>&1 | tail -20
```

There may still be compile errors in the view models — those are fixed in Task 12. If the settings screen and editor compile cleanly on their own, move on.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ios): rename CategoryLimitsScreen → CategorySafetyRulesScreen with per-rule rows"
```

---

## Task 11: `MedicationSafetyBanners` — add third banner

**Files:**
- Modify: `mobile-apps/ios/MigraLog/Views/Components/MedicationSafetyBanners.swift`

**Goal:** Render a category-cooldown banner between the existing per-med cooldown and MOH category banners. Same visual vocabulary; distinct icon.

- [ ] **Step 1: Replace the file contents**

```swift
import SwiftUI

/// Small banner rows shown above medication dose-log buttons to surface safety
/// information: per-medication cooldown, category-wide cooldown, and MOH risk.
/// Renders 0, 1, 2, or 3 lines depending on which statuses apply. Used on the
/// Dashboard rows, the Log Medication cards, and inside the Log Dose sheet.
struct MedicationSafetyBanners: View {
    /// Per-med cooldown status (pre-evaluated). Shown whenever the medication
    /// has a prior dose, regardless of whether the cooldown has expired.
    var cooldown: MedicationCooldown.Status?
    /// Category-wide cooldown status (pre-evaluated). Shown whenever a prior
    /// dose in the category exists AND a category cooldown rule is configured.
    var categoryCooldown: CategoryCooldown.Status?
    /// Category MOH status (pre-evaluated). Shown only when the status is
    /// `.approaching` or `.atOrOver` — below that, it's just noise.
    var categoryStatus: CategoryUsageStatus?
    /// The medication's category — required to format the MOH summary string.
    var medicationCategory: MedicationCategory?
    /// Used to build stable accessibility identifiers. When nil, identifiers are omitted.
    var medicationId: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let cooldown, let text = cooldownText(cooldown) {
                Label(text, systemImage: "clock.fill")
                    .font(.caption)
                    .foregroundStyle(cooldownColor(cooldown))
                    .accessibilityIdentifier(medicationId.map { "cooldown-warning-\($0)" } ?? "")
            }

            if let categoryCooldown,
               let medicationCategory,
               let text = categoryCooldownText(categoryCooldown, category: medicationCategory) {
                Label(text, systemImage: "clock.arrow.2.circlepath")
                    .font(.caption)
                    .foregroundStyle(categoryCooldownColor(categoryCooldown))
                    .accessibilityIdentifier(medicationId.map { "category-cooldown-warning-\($0)" } ?? "")
            }

            if let categoryStatus, categoryStatus.isWarning,
               let medicationCategory,
               let summary = categoryStatus.summary(category: medicationCategory) {
                Label(summary, systemImage: "exclamationmark.triangle.fill")
                    .font(.caption)
                    .foregroundStyle(categoryStatus.isStrong ? Color.red : Color.orange)
                    .accessibilityIdentifier(medicationId.map { "category-warning-\($0)" } ?? "")
            }
        }
    }

    // MARK: - Per-med cooldown helpers

    private func cooldownText(_ status: MedicationCooldown.Status) -> String? {
        guard let elapsed = status.hoursSinceLastDose else { return nil }
        let elapsedStr = formatDuration(elapsed)
        if status.isOnCooldown {
            let waitStr = formatDuration(status.hoursUntilNextDose)
            return "Last dose \(elapsedStr) ago — wait \(waitStr)"
        }
        return "Last dose \(elapsedStr) ago"
    }

    private func cooldownColor(_ status: MedicationCooldown.Status) -> Color {
        status.isOnCooldown ? .orange : .secondary
    }

    // MARK: - Category cooldown helpers

    private func categoryCooldownText(_ status: CategoryCooldown.Status, category: MedicationCategory) -> String? {
        guard status.minIntervalHours != nil,
              let elapsed = status.hoursSinceLastDose,
              let medName = status.lastMedicationName else {
            return nil
        }
        let elapsedStr = formatDuration(elapsed)
        let categoryLabel = category.displayName
        if status.isOnCooldown {
            let waitStr = formatDuration(status.hoursUntilNextDose)
            return "Last \(categoryLabel) (\(medName)) \(elapsedStr) ago — wait \(waitStr)"
        }
        return "Last \(categoryLabel) (\(medName)) \(elapsedStr) ago"
    }

    private func categoryCooldownColor(_ status: CategoryCooldown.Status) -> Color {
        status.isOnCooldown ? .orange : .secondary
    }

    // MARK: - Duration formatting

    private func formatDuration(_ hours: Double) -> String {
        if hours < 1 {
            let minutes = Int((hours * 60).rounded())
            return "\(minutes)m"
        }
        if hours < 24 {
            let wholeHours = Int(hours)
            let mins = Int(((hours - Double(wholeHours)) * 60).rounded())
            if mins == 0 { return "\(wholeHours)h" }
            return "\(wholeHours)h \(mins)m"
        }
        let days = Int(hours / 24)
        let remHours = Int(hours.truncatingRemainder(dividingBy: 24))
        if remHours == 0 { return "\(days)d" }
        return "\(days)d \(remHours)h"
    }
}
```

- [ ] **Step 2: Update any compile errors at call sites**

All existing call sites use keyword arguments. Adding `categoryCooldown:` as a default-nil parameter means existing call sites need no change until Task 12 wires them. Confirm:

```bash
grep -rn "MedicationSafetyBanners(" mobile-apps/ios/MigraLog 2>&1 | head -20
```

Each call site should still compile because `categoryCooldown` defaults to nil.

- [ ] **Step 3: Commit**

```bash
git add mobile-apps/ios/MigraLog/Views/Components/MedicationSafetyBanners.swift
git commit -m "feat(ios): add category-cooldown banner to MedicationSafetyBanners"
```

---

## Task 12: Wire category cooldown into view models

**Files:**
- Modify: `mobile-apps/ios/MigraLog/ViewModels/DashboardViewModel.swift`
- Modify: `mobile-apps/ios/MigraLog/ViewModels/LogMedicationViewModel.swift`
- Modify: `mobile-apps/ios/MigraLog/ViewModels/MedicationDetailViewModel.swift`
- Modify: `MigraLogTests/MockRepositories.swift`

**Goal:** Each view model that currently fetches per-med cooldown + MOH status now also fetches the category cooldown rule and last dose in category, and computes a `CategoryCooldown.Status` per medication.

- [ ] **Step 1: Update mock repos**

Open `mobile-apps/ios/MigraLogTests/MockRepositories.swift`. Find the mock for `CategoryUsageLimitRepositoryProtocol` (now named differently after Task 3). If any mock still references the old protocol or its methods, update it to conform to `CategorySafetyRuleRepositoryProtocol` with the new method signatures. Also update any `MockMedicationRepository` to implement `getLastTakenDoseInCategory(_:now:)` (return nil by default; add a test-configurable stub if the existing mock uses stored properties to drive test doubles).

Concretely, add (or adjust) the mock category repo so it conforms:

```swift
final class MockCategorySafetyRuleRepository: CategorySafetyRuleRepositoryProtocol, @unchecked Sendable {
    var rules: [CategorySafetyRule] = []
    var usageDaysToReturn: Int = 0

    func getAllRules() throws -> [CategorySafetyRule] { rules }
    func getRules(for category: MedicationCategory) throws -> [CategorySafetyRule] {
        rules.filter { $0.category == category }
    }
    func getRule(category: MedicationCategory, type: CategorySafetyRuleType) throws -> CategorySafetyRule? {
        rules.first { $0.category == category && $0.type == type }
    }
    func upsert(_ rule: CategorySafetyRule) throws {
        rules.removeAll { $0.category == rule.category && $0.type == rule.type }
        rules.append(rule)
    }
    func delete(id: String) throws {
        rules.removeAll { $0.id == id }
    }
    func countUsageDays(category: MedicationCategory, windowDays: Int, now: Date) throws -> Int {
        usageDaysToReturn
    }
}
```

Replace any reference to `MockCategoryUsageLimitRepository` in tests with `MockCategorySafetyRuleRepository`.

For `MockMedicationRepository`, add:
```swift
var lastTakenDoseInCategoryByCategory: [MedicationCategory: (MedicationDose, String)] = [:]

func getLastTakenDoseInCategory(
    _ category: MedicationCategory,
    now: Date
) throws -> (dose: MedicationDose, medicationName: String)? {
    lastTakenDoseInCategoryByCategory[category]
}
```

- [ ] **Step 2: Wire `DashboardViewModel`**

Open `mobile-apps/ios/MigraLog/ViewModels/DashboardViewModel.swift`. The view model currently exposes a `categoryUsage` dictionary and (probably) a cooldown dictionary keyed by medication id. Add a parallel dictionary:

```swift
    /// Category cooldown status per medication id (keyed the same as cooldowns).
    var categoryCooldowns: [String: CategoryCooldown.Status] = [:]
```

Update the type of `categoryLimitRepository` to `CategorySafetyRuleRepositoryProtocol` and its default to `CategorySafetyRuleRepository(dbManager: DatabaseManager.shared)`.

In the method that currently computes `categoryUsage` / cooldowns for the dashboard (look for one that loops medications and calls `categoryLimitRepository.getLimit(...)` + `countUsageDays(...)`), alongside the existing calls add:

```swift
            // Category cooldown evaluation.
            if let category = medication.category {
                let rule = try categoryLimitRepository.getRule(category: category, type: .cooldown)
                let last = try medicationRepository.getLastTakenDoseInCategory(category, now: now)
                categoryCooldowns[medication.id] = CategoryCooldown.evaluate(
                    category: category,
                    lastDoseInCategory: last,
                    cooldownRule: rule,
                    now: now
                )
            } else {
                categoryCooldowns.removeValue(forKey: medication.id)
            }
```

Also update the MOH lookup from `getLimit(for:)` to `getRule(category:type: .periodLimit)`.

The call pattern inside `DashboardScreen.swift:246-260` needs to pass the new status — this happens in Task 13.

- [ ] **Step 3: Wire `LogMedicationViewModel`**

Open `mobile-apps/ios/MigraLog/ViewModels/LogMedicationViewModel.swift`. It currently exposes `categoryUsage: [MedicationCategory: CategoryUsageStatus]`. Add:

```swift
    /// Category cooldown status keyed by medication id.
    var categoryCooldowns: [String: CategoryCooldown.Status] = [:]
```

And update the repository type to `CategorySafetyRuleRepositoryProtocol`.

Where medications are loaded and category usage is computed, extend the loop to compute the per-med `CategoryCooldown.Status`, mirroring the Dashboard snippet above.

- [ ] **Step 4: Wire `MedicationDetailViewModel`**

Open `mobile-apps/ios/MigraLog/ViewModels/MedicationDetailViewModel.swift`. It currently has a `categoryStatus: CategoryUsageStatus` field. Add:

```swift
    var categoryCooldown: CategoryCooldown.Status = CategoryCooldown.Status(
        isOnCooldown: false,
        hoursSinceLastDose: nil,
        hoursUntilNextDose: 0,
        minIntervalHours: nil,
        lastMedicationName: nil
    )
```

Update the repository type to `CategorySafetyRuleRepositoryProtocol`.

In `computeCategoryStatus(for:now:)` (or wherever MOH is computed), also compute and assign `categoryCooldown`:

```swift
    private func computeCategoryCooldown(for medication: Medication, now: Date) -> CategoryCooldown.Status {
        guard let category = medication.category else {
            return CategoryCooldown.Status(
                isOnCooldown: false,
                hoursSinceLastDose: nil,
                hoursUntilNextDose: 0,
                minIntervalHours: nil,
                lastMedicationName: nil
            )
        }
        do {
            let rule = try categoryLimitRepository.getRule(category: category, type: .cooldown)
            let last = try medicationRepository.getLastTakenDoseInCategory(category, now: now)
            return CategoryCooldown.evaluate(
                category: category,
                lastDoseInCategory: last,
                cooldownRule: rule,
                now: now
            )
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "MedicationDetailViewModel", "action": "computeCategoryCooldown"])
            return CategoryCooldown.Status(
                isOnCooldown: false,
                hoursSinceLastDose: nil,
                hoursUntilNextDose: 0,
                minIntervalHours: nil,
                lastMedicationName: nil
            )
        }
    }
```

Call it everywhere `computeCategoryStatus(for:now:)` is called (there are three sites at lines 67, 87, 188 per the earlier grep) and assign to `categoryCooldown`.

Also update the MOH compute method to use the new repo call `getRule(category:type: .periodLimit)`.

- [ ] **Step 5: Build**

```bash
cd mobile-apps/ios && xcodebuild build \
  -project MigraLog.xcodeproj -scheme MigraLog \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0' 2>&1 | tail -40
```

Expected: the only remaining failures are in the views that haven't been updated yet (Task 13). View model tests may start failing — address in Step 6.

- [ ] **Step 6: Fix any broken view-model tests**

Run the failing test targets:
```bash
cd mobile-apps/ios && xcodebuild test \
  -project MigraLog.xcodeproj -scheme MigraLog \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0' \
  -only-testing:MigraLogTests/DashboardViewModelTests \
  -only-testing:MigraLogTests/LogMedicationViewModelTests \
  -only-testing:MigraLogTests/MedicationDetailViewModelTests 2>&1 | tail -30
```

Update constructions of mock repos to the new types. Where a test formerly asserted on `vm.limits[.nsaid]?.maxDays`, translate to asserting on `vm.rules.first(where: { $0.category == .nsaid && $0.type == .periodLimit })?.maxCount`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(ios): wire category cooldown into Dashboard/Log/Detail view models"
```

---

## Task 13: Wire banners into the log surfaces

**Files:**
- Modify: `mobile-apps/ios/MigraLog/Views/Dashboard/DashboardScreen.swift` (around line 246-260)
- Modify: `mobile-apps/ios/MigraLog/Views/Medications/LogMedicationScreen.swift` (multiple sites)
- Modify: `mobile-apps/ios/MigraLog/Views/Medications/LogDoseDetailsSheet.swift` (around line 27-32)
- Modify: `mobile-apps/ios/MigraLog/Views/Medications/MedicationDetailScreen.swift` (around line 35)

**Goal:** Pass the newly computed `CategoryCooldown.Status` into every existing `MedicationSafetyBanners(...)` call site. Do not add new banners anywhere else — the banner component is already mounted in all four surfaces.

- [ ] **Step 1: Find all MedicationSafetyBanners call sites**

```bash
grep -rn "MedicationSafetyBanners(" mobile-apps/ios/MigraLog/Views
```

Expected hits (already known):
- `Views/Dashboard/DashboardScreen.swift:~260`
- `Views/Medications/LogMedicationScreen.swift:~104` and `~183`
- `Views/Medications/LogDoseDetailsSheet.swift:~32`
- `Views/Medications/MedicationDetailScreen.swift` (check exact line)

- [ ] **Step 2: Update each call site**

For each call, add a `categoryCooldown:` argument sourced from the view model's new `categoryCooldowns[medication.id]` map (or for `MedicationDetailViewModel`, the single `categoryCooldown` field). Example for Dashboard:

```swift
MedicationSafetyBanners(
    cooldown: cooldown,
    categoryCooldown: viewModel.categoryCooldowns[item.medication.id],
    categoryStatus: catStatus,
    medicationCategory: item.medication.category,
    medicationId: item.medication.id
)
```

For `LogMedicationScreen.swift` the inline row struct at line 81 exposes `categoryStatus` as a stored var — add a sibling:
```swift
var categoryCooldown: CategoryCooldown.Status? = nil
```
…and thread it through the row's initializer at line 162 and the outer call at lines 27/55 (pull from `viewModel.categoryCooldowns[med.id]`).

For `LogDoseDetailsSheet.swift` around line 27 where `categoryStatus` is fetched from `viewModel.categoryStatus`, also fetch `categoryCooldown` and pass it.

For `MedicationDetailScreen.swift` around line 35 where `viewModel.categoryStatus` is used for `catStatus`, also read `viewModel.categoryCooldown` and pass it.

- [ ] **Step 3: Build**

```bash
cd mobile-apps/ios && xcodebuild build \
  -project MigraLog.xcodeproj -scheme MigraLog \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0' 2>&1 | tail -20
```

Expected: clean build.

- [ ] **Step 4: Full unit test run**

```bash
cd mobile-apps/ios && xcodebuild test \
  -project MigraLog.xcodeproj -scheme MigraLog \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0' \
  -only-testing:MigraLogTests 2>&1 | grep -E "Executed.*tests" | tail -1
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(ios): thread category cooldown through Dashboard/Log/Detail banners"
```

---

## Task 14: UI smoke test + hand-verify + final commit

**Files:** None — final sweep.

**Goal:** Verify the end-to-end experience in the simulator, then push and open the PR.

- [ ] **Step 1: Run unit + UI test suites**

```bash
cd mobile-apps/ios && xcodebuild test \
  -scheme MigraLog \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0' \
  -only-testing:MigraLogTests 2>&1 | grep -E "Executed.*tests" | tail -1

cd mobile-apps/ios && xcodebuild test \
  -scheme MigraLog \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro,OS=26.0' \
  -only-testing:MigraLogUITests 2>&1 | grep -E "Executed.*tests" | tail -1
```

Both must pass.

- [ ] **Step 2: Hand-verify in the simulator (scripted checks)**

Launch the app in the iOS simulator. Perform the following smoke checks. Record results in the PR description.

1. Settings → Medication Safety Limits:
   - [ ] Empty state shows the new "No Rules Configured" copy and "Add Rule" button.
   - [ ] Add flow — pick NSAID → pick "Cooldown" → field accepts 4 → save → row appears: `NSAIDs — 4h between doses`.
   - [ ] Add flow — pick NSAID → pick "Usage limit" → fields pre-fill 15/30 via `mohPreset` → save → second row appears: `NSAIDs — 15 days in any 30 days`.
   - [ ] Add flow — pick Triptan → pick "Cooldown" → field pre-fills 2 via `cooldownPreset`.
   - [ ] Swipe-to-delete on the cooldown row removes only that row.
   - [ ] Edit an existing rule — category/type are locked and field(s) pre-fill.
2. Seed two NSAIDs (Advil, Naproxen). Log Advil. Immediately open the Log Medication screen for Naproxen and confirm the new banner reads:
   `Last NSAID (Advil) <Xm> ago — wait <Yh Zm>` (orange, clock.arrow.2.circlepath icon). The category label comes from `MedicationCategory.displayName` (e.g. "NSAID", not "NSAIDs").
3. Same surface confirms this banner also appears on:
   - Dashboard "Today's Medications" card for Naproxen.
   - Log Dose sheet for Naproxen.
   - Medication Detail for Naproxen.
4. Wait until the cooldown elapses (or change rule to 0.01h and re-check). Banner switches to secondary color and drops the "wait" suffix.
5. Delete the cooldown rule — banner disappears from all four surfaces.

- [ ] **Step 3: Push branch and open PR**

```bash
git push -u origin feature/per-category-cooldown
gh pr create --title "feat(ios): per-category cooldown rules" --body "$(cat <<'EOF'
## Summary
- Add optional per-category cooldown (e.g., "NSAIDs — 4h between any dose") alongside the existing MOH day-count limits.
- Restructure `category_usage_limits` as `category_safety_rules` with a `type` discriminator (`cooldown` | `period_limit`) so future rule types slot in as new rows. Stable schema is a prerequisite for planned CloudKit sync.
- Third banner on every dose-log surface: per-med cooldown → category cooldown → MOH. Oversharing by design.
- Design spec: `docs/superpowers/specs/2026-04-18-per-category-cooldown-design.md`.

## Test plan
- [x] Unit tests pass
- [x] UI tests pass
- [x] Simulator smoke test covering the 5 scenarios in the implementation plan

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Final sanity — grep for leftover old symbols**

```bash
grep -rn "CategoryUsageLimit" mobile-apps/ios 2>&1 || echo "clean"
grep -rn "category_usage_limits" mobile-apps/ios 2>&1
```

The first should print nothing or `clean`. The second should only match the legacy CREATE in `DatabaseManager.createSchema` (kept intentionally for fresh-install migration path).

- [ ] **Step 5: Commit any cleanup and push**

If any leftover references surfaced, patch them and push:

```bash
git add -A && git commit -m "chore(ios): sweep remaining CategoryUsageLimit references" || true
git push
```

---

## Done

Feature complete once:
- Migration runs cleanly on upgrade and on fresh install.
- All unit + UI tests pass.
- Simulator smoke test passes all five scenarios.
- PR open with green CI.
