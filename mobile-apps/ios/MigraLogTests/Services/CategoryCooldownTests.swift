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
        let dose = makeDose(at: now.addingTimeInterval(-3600))
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
        let dose = makeDose(at: now.addingTimeInterval(-5 * 3600))
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
