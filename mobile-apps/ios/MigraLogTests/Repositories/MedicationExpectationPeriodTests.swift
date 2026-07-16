import GRDB
import XCTest
@testable import MigraLog

/// Integration tests for the expectation-period bookkeeping MedicationRepository
/// performs whenever a medication's active flag or enabled-schedule count changes,
/// plus the v38 backfill.
final class MedicationExpectationPeriodTests: XCTestCase {
    var dbManager: DatabaseManager!
    var repo: MedicationRepository!

    override func setUpWithError() throws {
        dbManager = try DatabaseManager(inMemory: true)
        repo = MedicationRepository(dbManager: dbManager)
    }

    override func tearDownWithError() throws {
        dbManager = nil
        repo = nil
    }

    // MARK: - Helpers

    private var today: String { TimestampHelper.dateString() }

    private var yesterday: String {
        TimestampHelper.dateString(from: Calendar.current.date(byAdding: .day, value: -1, to: Date())!)
    }

    private func daysAgo(_ days: Int) -> String {
        TimestampHelper.dateString(from: Calendar.current.date(byAdding: .day, value: -days, to: Date())!)
    }

    private func makeMedication(
        id: String = UUID().uuidString,
        type: MedicationType = .preventative,
        active: Bool = true
    ) -> Medication {
        let now = TimestampHelper.now
        return Medication(
            id: id,
            name: "Test Med",
            type: type,
            dosageAmount: 10,
            dosageUnit: "mg",
            defaultQuantity: 1.0,
            scheduleFrequency: nil,
            photoUri: nil,
            active: active,
            notes: nil,
            category: nil,
            minIntervalHours: nil,
            createdAt: now,
            updatedAt: now
        )
    }

    private func makeSchedule(
        id: String = UUID().uuidString,
        medicationId: String,
        time: String = "08:00",
        enabled: Bool = true
    ) -> MedicationSchedule {
        MedicationSchedule(
            id: id,
            medicationId: medicationId,
            time: time,
            timezone: "America/New_York",
            dosage: 1.0,
            enabled: enabled,
            notificationId: nil,
            reminderEnabled: true
        )
    }

    private func periods(for medicationId: String) throws -> [MedicationExpectationPeriod] {
        try repo.getAllExpectationPeriods().filter { $0.medicationId == medicationId }
    }

    /// Rewind a medication's open period so it started in the past — reconcile
    /// always acts "today", so past starts must be planted directly (otherwise
    /// every transition hits the same-day rewrite-in-place branch).
    private func rewindOpenPeriod(medicationId: String) throws {
        try dbManager.dbQueue.write { db in
            try db.execute(
                sql: "UPDATE medication_expectation_periods SET start_date = ? WHERE medication_id = ?",
                arguments: [self.daysAgo(10), medicationId]
            )
        }
    }

    // MARK: - Opening periods

    func testSchedulingPreventativeOpensPeriodToday() throws {
        let med = try repo.createMedication(makeMedication(id: "med-1"))
        XCTAssertTrue(try periods(for: "med-1").isEmpty, "No period until a schedule exists")

        _ = try repo.createSchedule(makeSchedule(medicationId: med.id))

        let result = try periods(for: "med-1")
        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result[0].startDate, today)
        XCTAssertNil(result[0].endDate)
        XCTAssertEqual(result[0].expectedDailyDoses, 1)
    }

    func testSecondScheduleSameDayUpdatesOpenPeriodInPlace() throws {
        let med = try repo.createMedication(makeMedication(id: "med-1"))
        _ = try repo.createSchedule(makeSchedule(medicationId: med.id, time: "08:00"))
        _ = try repo.createSchedule(makeSchedule(medicationId: med.id, time: "20:00"))

        let result = try periods(for: "med-1")
        XCTAssertEqual(result.count, 1, "Same-day churn must not fragment into multiple periods")
        XCTAssertEqual(result[0].expectedDailyDoses, 2)
        XCTAssertNil(result[0].endDate)
    }

    func testRescueMedicationSchedulesOpenNoPeriod() throws {
        let med = try repo.createMedication(makeMedication(id: "med-1", type: .rescue))
        _ = try repo.createSchedule(makeSchedule(medicationId: med.id))

        XCTAssertTrue(try periods(for: "med-1").isEmpty)
    }

    func testDisabledScheduleOpensNoPeriod() throws {
        let med = try repo.createMedication(makeMedication(id: "med-1"))
        _ = try repo.createSchedule(makeSchedule(medicationId: med.id, enabled: false))

        XCTAssertTrue(try periods(for: "med-1").isEmpty)
    }

    // MARK: - Closing and reopening

    func testDeschedulingClosesRunningPeriodAtYesterday() throws {
        let med = try repo.createMedication(makeMedication(id: "med-1"))
        let schedule = try repo.createSchedule(makeSchedule(medicationId: med.id))
        try rewindOpenPeriod(medicationId: med.id)

        try repo.deleteSchedule(schedule.id)

        let result = try periods(for: "med-1")
        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result[0].startDate, daysAgo(10))
        XCTAssertEqual(result[0].endDate, yesterday, "History must be preserved, closed at yesterday")
    }

    func testSameDayScheduleAndDescheduleLeavesNoPeriod() throws {
        let med = try repo.createMedication(makeMedication(id: "med-1"))
        let schedule = try repo.createSchedule(makeSchedule(medicationId: med.id))
        try repo.deleteSchedule(schedule.id)

        XCTAssertTrue(try periods(for: "med-1").isEmpty, "A period opened and closed today should vanish")
    }

    func testArchiveClosesPeriodAndUnarchiveOpensNewOne() throws {
        let med = try repo.createMedication(makeMedication(id: "med-1"))
        _ = try repo.createSchedule(makeSchedule(medicationId: med.id))
        try rewindOpenPeriod(medicationId: med.id)

        try repo.archiveMedication(med.id)
        var result = try periods(for: "med-1")
        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result[0].endDate, yesterday)

        try repo.unarchiveMedication(med.id)
        result = try periods(for: "med-1")
        XCTAssertEqual(result.count, 2)
        let open = result.first { $0.endDate == nil }
        XCTAssertEqual(open?.startDate, today)
        XCTAssertEqual(open?.expectedDailyDoses, 1)
    }

    func testDisablingScheduleViaUpdateClosesPeriod() throws {
        let med = try repo.createMedication(makeMedication(id: "med-1"))
        var schedule = try repo.createSchedule(makeSchedule(medicationId: med.id))
        try rewindOpenPeriod(medicationId: med.id)

        schedule.enabled = false
        _ = try repo.updateSchedule(schedule)

        let result = try periods(for: "med-1")
        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result[0].endDate, yesterday)
    }

    func testTypeChangeAwayFromPreventativeClosesPeriod() throws {
        var med = try repo.createMedication(makeMedication(id: "med-1"))
        _ = try repo.createSchedule(makeSchedule(medicationId: med.id))
        try rewindOpenPeriod(medicationId: med.id)

        med.type = .rescue
        _ = try repo.updateMedication(med)

        let result = try periods(for: "med-1")
        XCTAssertEqual(result.count, 1)
        XCTAssertNotNil(result[0].endDate)
    }

    func testNoOpUpdateLeavesPeriodUntouched() throws {
        let med = try repo.createMedication(makeMedication(id: "med-1"))
        var schedule = try repo.createSchedule(makeSchedule(medicationId: med.id))
        let before = try periods(for: "med-1")

        schedule.notificationId = "notif-42"
        _ = try repo.updateSchedule(schedule)

        XCTAssertEqual(try periods(for: "med-1"), before)
    }

    func testDeleteMedicationCascadesPeriods() throws {
        let med = try repo.createMedication(makeMedication(id: "med-1"))
        _ = try repo.createSchedule(makeSchedule(medicationId: med.id))
        XCTAssertFalse(try periods(for: "med-1").isEmpty)

        try repo.deleteMedication(med.id)

        XCTAssertTrue(try periods(for: "med-1").isEmpty)
    }

    // MARK: - v38 backfill

    func testBackfillSeedsOpenPeriodFromMedicationCreationDay() throws {
        // Plant meds + schedules via raw SQL (as a pre-v38 database would have
        // them), then run the backfill.
        let createdAt = TimestampHelper.fromDate(
            Calendar.current.date(byAdding: .day, value: -30, to: Date())!
        )
        try dbManager.dbQueue.write { db in
            for (medId, type, active) in [("med-a", "preventative", 1), ("med-b", "preventative", 0), ("med-c", "rescue", 1)] {
                try db.execute(
                    sql: """
                        INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, active, created_at, updated_at)
                        VALUES (?, 'M', ?, 1, 'mg', ?, ?, ?)
                        """,
                    arguments: [medId, type, active, createdAt, createdAt]
                )
                try db.execute(
                    sql: """
                        INSERT INTO medication_schedules (id, medication_id, time, timezone, dosage, enabled, reminder_enabled, created_at, updated_at)
                        VALUES (?, ?, '08:00', 'UTC', 1, 1, 1, ?, ?)
                        """,
                    arguments: ["sched-\(medId)", medId, createdAt, createdAt]
                )
            }
            try DatabaseManager.backfillExpectationPeriods(in: db)
            // Idempotent: running twice must not duplicate.
            try DatabaseManager.backfillExpectationPeriods(in: db)
        }

        let all = try repo.getAllExpectationPeriods()
        XCTAssertEqual(all.count, 1, "Only the active preventative gets a backfill period")
        XCTAssertEqual(all[0].medicationId, "med-a")
        XCTAssertEqual(all[0].startDate, daysAgo(30))
        XCTAssertNil(all[0].endDate)
        XCTAssertEqual(all[0].expectedDailyDoses, 1)
        XCTAssertEqual(all[0].updatedAt, createdAt, "Backfill timestamps pin to the med's created_at so runtime edits win LWW")
    }
}
