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

    func test_upsert_stamps_updated_at_for_LWW() throws {
        // #460: every upsert must stamp updated_at so last-write-wins compares
        // last-modified time, not creation time.
        let rule = CategorySafetyRule(
            id: "a", category: .nsaid, type: .cooldown,
            periodHours: 4.0, maxCount: nil, createdAt: Date()
        )
        try repo.upsert(rule)
        let first = try repo.getRule(category: .nsaid, type: .cooldown)?.updatedAt
        XCTAssertNotNil(first)

        Thread.sleep(forTimeInterval: 0.005)

        let changed = CategorySafetyRule(
            id: rule.id, category: .nsaid, type: .cooldown,
            periodHours: 6.0, maxCount: nil, createdAt: rule.createdAt
        )
        try repo.upsert(changed)
        let second = try repo.getRule(category: .nsaid, type: .cooldown)?.updatedAt
        XCTAssertNotNil(second)
        XCTAssertGreaterThan(second!, first!)
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
        try dbManager.dbQueue.write { db in
            try db.execute(sql: """
                INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, active,
                                          category, created_at, updated_at)
                VALUES ('m1','Advil','rescue',200,'mg',1,'nsaid',1,1),
                       ('m2','Naproxen','rescue',500,'mg',1,'nsaid',1,1),
                       ('m3','Tylenol','rescue',500,'mg',1,'otc',1,1)
                """)
            let d1 = Int64(Date(timeIntervalSince1970: 1_775_304_000).timeIntervalSince1970 * 1000)
            let d2 = d1 + 3_600_000
            let d3 = d1 + 86_400_000
            let d4 = d1 + 2 * 86_400_000
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

        let count = try repo.countUsageDays(category: .nsaid, windowDays: 30, now: Date(timeIntervalSince1970: 1_775_500_000))
        XCTAssertEqual(count, 2)
    }

    func test_countUsageDays_ignores_doses_of_excluded_medications() throws {
        // A daily preventative (e.g. Qulipta) excluded from safety warnings must
        // not inflate its category's usage-day count; other meds still count.
        try dbManager.dbQueue.write { db in
            try db.execute(sql: """
                INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, active,
                                          category, created_at, updated_at, excluded_from_safety_warnings)
                VALUES ('qulipta','Qulipta','preventative',60,'mg',1,'cgrp',1,1,1),
                       ('ubrelvy','Ubrelvy','rescue',100,'mg',1,'cgrp',1,1,0)
                """)
            let base = Int64(1_775_304_000) * 1000
            var doses: [(String, Int64)] = []
            // Excluded preventative taken daily for 5 days.
            for day in 0..<5 {
                doses.append(("qulipta", base + Int64(day) * 86_400_000))
            }
            // Rescue med taken on 2 of those days.
            doses.append(("ubrelvy", base))
            doses.append(("ubrelvy", base + 3 * 86_400_000))
            for (medId, ts) in doses {
                try db.execute(
                    sql: """
                        INSERT INTO medication_doses (id, medication_id, timestamp, quantity,
                                                       status, created_at, updated_at)
                        VALUES (?, ?, ?, 1, 'taken', 1, 1)
                        """,
                    arguments: [UUID().uuidString, medId, ts]
                )
            }
        }

        let count = try repo.countUsageDays(category: .cgrp, windowDays: 30, now: Date(timeIntervalSince1970: 1_775_800_000))
        XCTAssertEqual(count, 2, "only the non-excluded rescue med's days should count")
    }

    func test_countUsageDays_treats_null_exclusion_flag_as_included() throws {
        // Rows synced from older app versions have NULL in the new column —
        // they must count exactly as before the migration.
        try dbManager.dbQueue.write { db in
            try db.execute(sql: """
                INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, active,
                                          category, created_at, updated_at, excluded_from_safety_warnings)
                VALUES ('m1','Advil','rescue',200,'mg',1,'nsaid',1,1,NULL)
                """)
            try db.execute(
                sql: """
                    INSERT INTO medication_doses (id, medication_id, timestamp, quantity,
                                                   status, created_at, updated_at)
                    VALUES (?, 'm1', ?, 1, 'taken', 1, 1)
                    """,
                arguments: [UUID().uuidString, Int64(1_775_304_000) * 1000]
            )
        }

        let count = try repo.countUsageDays(category: .nsaid, windowDays: 30, now: Date(timeIntervalSince1970: 1_775_500_000))
        XCTAssertEqual(count, 1)
    }
}
