import XCTest
@testable import MigraLog

final class MedicationCooldownTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_700_000_000)

    // MARK: - No interval configured

    func testEvaluate_noIntervalConfigured_returnsNotOnCooldown() {
        let medication = TestFixtures.makeMedication(minIntervalHours: nil)
        let dose = TestFixtures.makeDose(medicationId: medication.id, timestamp: TimestampHelper.fromDate(now))

        let status = MedicationCooldown.evaluate(medication: medication, lastDose: dose, now: now)

        XCTAssertFalse(status.isOnCooldown)
        XCTAssertNil(status.hoursSinceLastDose)
        XCTAssertEqual(status.hoursUntilNextDose, 0)
        XCTAssertNil(status.minIntervalHours)
    }

    func testEvaluate_zeroInterval_treatedAsNoCooldown() {
        let medication = TestFixtures.makeMedication(minIntervalHours: 0)

        let status = MedicationCooldown.evaluate(medication: medication, lastDose: nil, now: now)

        XCTAssertFalse(status.isOnCooldown)
        XCTAssertNil(status.minIntervalHours)
    }

    // MARK: - No prior dose

    func testEvaluate_noLastDose_returnsNotOnCooldown() {
        let medication = TestFixtures.makeMedication(minIntervalHours: 24)

        let status = MedicationCooldown.evaluate(medication: medication, lastDose: nil, now: now)

        XCTAssertFalse(status.isOnCooldown)
        XCTAssertNil(status.hoursSinceLastDose)
        XCTAssertEqual(status.hoursUntilNextDose, 0)
        XCTAssertEqual(status.minIntervalHours, 24)
    }

    // MARK: - On cooldown

    func testEvaluate_onCooldown_returnsPositiveRemaining() {
        let medication = TestFixtures.makeMedication(minIntervalHours: 24)
        // last dose 3 hours ago
        let lastDate = now.addingTimeInterval(-3 * 3600)
        let dose = TestFixtures.makeDose(
            medicationId: medication.id,
            timestamp: TimestampHelper.fromDate(lastDate)
        )

        let status = MedicationCooldown.evaluate(medication: medication, lastDose: dose, now: now)

        XCTAssertTrue(status.isOnCooldown)
        XCTAssertEqual(status.hoursSinceLastDose ?? 0, 3.0, accuracy: 0.001)
        XCTAssertEqual(status.hoursUntilNextDose, 21.0, accuracy: 0.001)
        XCTAssertEqual(status.minIntervalHours, 24)
    }

    // MARK: - Off cooldown

    func testEvaluate_offCooldown_returnsZeroRemaining() {
        let medication = TestFixtures.makeMedication(minIntervalHours: 6)
        // last dose 10 hours ago
        let lastDate = now.addingTimeInterval(-10 * 3600)
        let dose = TestFixtures.makeDose(
            medicationId: medication.id,
            timestamp: TimestampHelper.fromDate(lastDate)
        )

        let status = MedicationCooldown.evaluate(medication: medication, lastDose: dose, now: now)

        XCTAssertFalse(status.isOnCooldown)
        XCTAssertEqual(status.hoursSinceLastDose ?? 0, 10.0, accuracy: 0.001)
        XCTAssertEqual(status.hoursUntilNextDose, 0)
    }

    // MARK: - Boundary

    func testEvaluate_exactlyAtIntervalBoundary_isNotOnCooldown() {
        let medication = TestFixtures.makeMedication(minIntervalHours: 6)
        // last dose exactly 6 hours ago
        let lastDate = now.addingTimeInterval(-6 * 3600)
        let dose = TestFixtures.makeDose(
            medicationId: medication.id,
            timestamp: TimestampHelper.fromDate(lastDate)
        )

        let status = MedicationCooldown.evaluate(medication: medication, lastDose: dose, now: now)

        XCTAssertFalse(status.isOnCooldown)
        XCTAssertEqual(status.hoursUntilNextDose, 0, accuracy: 0.001)
    }

    func testEvaluate_justBeforeBoundary_isOnCooldown() {
        let medication = TestFixtures.makeMedication(minIntervalHours: 6)
        // last dose 5h 59m ago
        let lastDate = now.addingTimeInterval(-((6 * 3600) - 60))
        let dose = TestFixtures.makeDose(
            medicationId: medication.id,
            timestamp: TimestampHelper.fromDate(lastDate)
        )

        let status = MedicationCooldown.evaluate(medication: medication, lastDose: dose, now: now)

        XCTAssertTrue(status.isOnCooldown)
        XCTAssertGreaterThan(status.hoursUntilNextDose, 0)
    }

    // MARK: - summary formatting

    func testSummary_onCooldown_includesWait() {
        let medication = TestFixtures.makeMedication(minIntervalHours: 24)
        let lastDate = now.addingTimeInterval(-3 * 3600)
        let dose = TestFixtures.makeDose(
            medicationId: medication.id,
            timestamp: TimestampHelper.fromDate(lastDate)
        )
        let status = MedicationCooldown.evaluate(medication: medication, lastDose: dose, now: now)

        let summary = MedicationCooldown.summary(status)

        XCTAssertNotNil(summary)
        XCTAssertTrue(summary?.contains("wait") ?? false, "Expected summary to contain 'wait', got \(summary ?? "nil")")
        XCTAssertTrue(summary?.contains("ago") ?? false)
    }

    func testSummary_offCooldownWithPriorDose_agoOnly() {
        let medication = TestFixtures.makeMedication(minIntervalHours: 6)
        let lastDate = now.addingTimeInterval(-10 * 3600)
        let dose = TestFixtures.makeDose(
            medicationId: medication.id,
            timestamp: TimestampHelper.fromDate(lastDate)
        )
        let status = MedicationCooldown.evaluate(medication: medication, lastDose: dose, now: now)

        let summary = MedicationCooldown.summary(status)

        XCTAssertNotNil(summary)
        XCTAssertTrue(summary?.contains("ago") ?? false)
        XCTAssertFalse(summary?.contains("wait") ?? true)
    }

    func testSummary_noPriorDose_returnsNil() {
        let medication = TestFixtures.makeMedication(minIntervalHours: 24)
        let status = MedicationCooldown.evaluate(medication: medication, lastDose: nil, now: now)

        XCTAssertNil(MedicationCooldown.summary(status))
    }

    func testSummary_minutesFormatting_whenUnderOneHour() {
        let medication = TestFixtures.makeMedication(minIntervalHours: 6)
        // last dose 30 minutes ago
        let lastDate = now.addingTimeInterval(-30 * 60)
        let dose = TestFixtures.makeDose(
            medicationId: medication.id,
            timestamp: TimestampHelper.fromDate(lastDate)
        )
        let status = MedicationCooldown.evaluate(medication: medication, lastDose: dose, now: now)

        let summary = MedicationCooldown.summary(status)

        XCTAssertNotNil(summary)
        XCTAssertTrue(summary?.contains("30m") ?? false, "Expected '30m' in summary, got \(summary ?? "nil")")
    }

    func testSummary_daysFormatting_whenOver24Hours() {
        let medication = TestFixtures.makeMedication(minIntervalHours: 72)
        // last dose 48 hours ago
        let lastDate = now.addingTimeInterval(-48 * 3600)
        let dose = TestFixtures.makeDose(
            medicationId: medication.id,
            timestamp: TimestampHelper.fromDate(lastDate)
        )
        let status = MedicationCooldown.evaluate(medication: medication, lastDose: dose, now: now)

        let summary = MedicationCooldown.summary(status)

        XCTAssertNotNil(summary)
        XCTAssertTrue(summary?.contains("d") ?? false, "Expected days formatting in summary, got \(summary ?? "nil")")
    }
}
