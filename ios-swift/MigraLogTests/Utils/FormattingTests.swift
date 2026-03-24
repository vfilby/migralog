import XCTest
@testable import MigraLog

final class FormattingTests: XCTestCase {

    // MARK: - MedicationFormatting.formatDosage

    func testFormatDosageWholeNumber() {
        let result = MedicationFormatting.formatDosage(amount: 400, unit: "mg")
        XCTAssertEqual(result, "400mg")
    }

    func testFormatDosageFractional() {
        let result = MedicationFormatting.formatDosage(amount: 2.5, unit: "mg")
        XCTAssertEqual(result, "2.5mg")
    }

    func testFormatDosageTablets() {
        let result = MedicationFormatting.formatDosage(amount: 1, unit: "tablets")
        XCTAssertEqual(result, "1 tablets")
    }

    func testFormatDosageCapsules() {
        let result = MedicationFormatting.formatDosage(amount: 2, unit: "capsules")
        XCTAssertEqual(result, "2 capsules")
    }

    func testFormatDosageZero() {
        let result = MedicationFormatting.formatDosage(amount: 0, unit: "mg")
        XCTAssertEqual(result, "0mg")
    }

    // MARK: - MedicationFormatting.formatDose

    func testFormatDoseWholeQuantity() {
        let result = MedicationFormatting.formatDose(quantity: 1, amount: 400, unit: "mg")
        XCTAssertEqual(result, "1 \u{00d7} 400mg")
    }

    func testFormatDoseFractionalQuantity() {
        let result = MedicationFormatting.formatDose(quantity: 1.5, amount: 200, unit: "mg")
        XCTAssertEqual(result, "1.5 \u{00d7} 200mg")
    }

    func testFormatDoseWithTablets() {
        let result = MedicationFormatting.formatDose(quantity: 2, amount: 1, unit: "tablets")
        XCTAssertEqual(result, "2 \u{00d7} 1 tablets")
    }

    // MARK: - MedicationFormatting.formatMedicationDisplay

    func testFormatMedicationDisplay() {
        let med = TestFixtures.makeMedication(name: "Ibuprofen", dosageAmount: 400, dosageUnit: "mg")
        let result = MedicationFormatting.formatMedicationDisplay(med)
        XCTAssertEqual(result, "Ibuprofen \u{00b7} 400mg")
    }

    func testFormatMedicationDisplayFractional() {
        let med = Medication(
            id: "test",
            name: "Sumatriptan",
            type: .rescue,
            dosageAmount: 2.5,
            dosageUnit: "mg",
            defaultQuantity: 1.0,
            scheduleFrequency: nil,
            photoUri: nil,
            active: true,
            notes: nil,
            category: .triptan,
            createdAt: TimestampHelper.now,
            updatedAt: TimestampHelper.now
        )
        let result = MedicationFormatting.formatMedicationDisplay(med)
        XCTAssertEqual(result, "Sumatriptan \u{00b7} 2.5mg")
    }

    // MARK: - AnalyticsFormatting.formatDayCount

    func testFormatDayCountSingular() {
        let result = AnalyticsFormatting.formatDayCount(1, label: "day")
        XCTAssertEqual(result, "1 day")
    }

    func testFormatDayCountPlural() {
        let result = AnalyticsFormatting.formatDayCount(5, label: "day")
        XCTAssertEqual(result, "5 days")
    }

    func testFormatDayCountZero() {
        let result = AnalyticsFormatting.formatDayCount(0, label: "episode")
        XCTAssertEqual(result, "0 episodes")
    }

    func testFormatDayCountCustomLabel() {
        let result = AnalyticsFormatting.formatDayCount(3, label: "migraine")
        XCTAssertEqual(result, "3 migraines")
    }
}
