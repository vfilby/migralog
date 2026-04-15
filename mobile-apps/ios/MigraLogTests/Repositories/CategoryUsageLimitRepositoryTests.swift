import XCTest
@testable import MigraLog

final class CategoryUsageLimitRepositoryTests: XCTestCase {
    var dbManager: DatabaseManager!
    var repo: CategoryUsageLimitRepository!
    var medRepo: MedicationRepository!

    override func setUpWithError() throws {
        dbManager = try DatabaseManager(inMemory: true)
        repo = CategoryUsageLimitRepository(dbManager: dbManager)
        medRepo = MedicationRepository(dbManager: dbManager)
    }

    override func tearDownWithError() throws {
        dbManager = nil
        repo = nil
        medRepo = nil
    }

    // MARK: - Helpers

    private func makeMedication(
        id: String = UUID().uuidString,
        category: MedicationCategory? = .nsaid
    ) -> Medication {
        let now = TimestampHelper.now
        return Medication(
            id: id,
            name: "Test Med",
            type: .rescue,
            dosageAmount: 200,
            dosageUnit: "mg",
            defaultQuantity: 1,
            scheduleFrequency: nil,
            photoUri: nil,
            active: true,
            notes: nil,
            category: category,
            createdAt: now,
            updatedAt: now
        )
    }

    private func makeDose(
        medicationId: String,
        at date: Date,
        status: DoseStatus = .taken
    ) -> MedicationDose {
        let ts = TimestampHelper.fromDate(date)
        return MedicationDose(
            id: UUID().uuidString,
            medicationId: medicationId,
            timestamp: ts,
            quantity: status == .taken ? 1 : 0,
            dosageAmount: 200,
            dosageUnit: "mg",
            status: status,
            episodeId: nil,
            effectivenessRating: nil,
            timeToRelief: nil,
            sideEffects: [],
            notes: nil,
            createdAt: ts,
            updatedAt: ts
        )
    }

    // MARK: - CRUD

    func testSetLimit_canBeFetchedByGetLimit() throws {
        let limit = CategoryUsageLimit(category: .nsaid, maxDays: 15, windowDays: 30)
        try repo.setLimit(limit)

        let fetched = try repo.getLimit(for: .nsaid)
        XCTAssertEqual(fetched, limit)
    }

    func testSetLimit_upsertsExistingRow() throws {
        let initial = CategoryUsageLimit(category: .nsaid, maxDays: 15, windowDays: 30)
        try repo.setLimit(initial)

        let updated = CategoryUsageLimit(category: .nsaid, maxDays: 10, windowDays: 28)
        try repo.setLimit(updated)

        let fetched = try repo.getLimit(for: .nsaid)
        XCTAssertEqual(fetched, updated)

        let all = try repo.getAllLimits()
        XCTAssertEqual(all.count, 1)
    }

    func testGetLimit_missingCategory_returnsNil() throws {
        XCTAssertNil(try repo.getLimit(for: .triptan))
    }

    func testGetAllLimits_returnsAllConfigured() throws {
        try repo.setLimit(CategoryUsageLimit(category: .nsaid, maxDays: 15, windowDays: 30))
        try repo.setLimit(CategoryUsageLimit(category: .triptan, maxDays: 10, windowDays: 30))

        let all = try repo.getAllLimits()
        XCTAssertEqual(all.count, 2)
        let categories = Set(all.map(\.category))
        XCTAssertEqual(categories, [.nsaid, .triptan])
    }

    func testClearLimit_removesRow() throws {
        try repo.setLimit(CategoryUsageLimit(category: .nsaid, maxDays: 15, windowDays: 30))
        try repo.clearLimit(for: .nsaid)

        XCTAssertNil(try repo.getLimit(for: .nsaid))
    }

    // MARK: - countUsageDays

    func testCountUsageDays_noDoses_returnsZero() throws {
        let count = try repo.countUsageDays(category: .nsaid, windowDays: 30, now: Date())
        XCTAssertEqual(count, 0)
    }

    func testCountUsageDays_multipleDosesSameDay_countsAsOne() throws {
        let med = try medRepo.createMedication(makeMedication(category: .nsaid))
        let now = Date()
        // Three doses all "today"
        _ = try medRepo.createDose(makeDose(medicationId: med.id, at: now))
        _ = try medRepo.createDose(makeDose(medicationId: med.id, at: now.addingTimeInterval(3600)))
        _ = try medRepo.createDose(makeDose(medicationId: med.id, at: now.addingTimeInterval(7200)))

        let count = try repo.countUsageDays(category: .nsaid, windowDays: 30, now: now.addingTimeInterval(8000))
        XCTAssertEqual(count, 1)
    }

    func testCountUsageDays_dosesOutsideWindow_excluded() throws {
        let med = try medRepo.createMedication(makeMedication(category: .nsaid))
        let now = Date()
        let outsideWindow = now.addingTimeInterval(-31 * 24 * 3600) // 31 days ago
        _ = try medRepo.createDose(makeDose(medicationId: med.id, at: outsideWindow))

        let count = try repo.countUsageDays(category: .nsaid, windowDays: 30, now: now)
        XCTAssertEqual(count, 0)
    }

    func testCountUsageDays_differentCategory_excluded() throws {
        let nsaidMed = try medRepo.createMedication(makeMedication(category: .nsaid))
        let triptanMed = try medRepo.createMedication(makeMedication(category: .triptan))
        let now = Date()
        _ = try medRepo.createDose(makeDose(medicationId: nsaidMed.id, at: now))
        _ = try medRepo.createDose(makeDose(medicationId: triptanMed.id, at: now))

        let nsaidCount = try repo.countUsageDays(category: .nsaid, windowDays: 30, now: now.addingTimeInterval(60))
        let triptanCount = try repo.countUsageDays(category: .triptan, windowDays: 30, now: now.addingTimeInterval(60))
        XCTAssertEqual(nsaidCount, 1)
        XCTAssertEqual(triptanCount, 1)
    }

    func testCountUsageDays_skippedDoses_excluded() throws {
        let med = try medRepo.createMedication(makeMedication(category: .nsaid))
        let now = Date()
        _ = try medRepo.createDose(makeDose(medicationId: med.id, at: now, status: .skipped))

        let count = try repo.countUsageDays(category: .nsaid, windowDays: 30, now: now.addingTimeInterval(60))
        XCTAssertEqual(count, 0)
    }

    func testCountUsageDays_multipleMedsSameCategory_countedTogether() throws {
        let med1 = try medRepo.createMedication(makeMedication(category: .nsaid))
        let med2 = try medRepo.createMedication(makeMedication(category: .nsaid))
        let now = Date()
        let yesterday = now.addingTimeInterval(-24 * 3600)
        _ = try medRepo.createDose(makeDose(medicationId: med1.id, at: now))
        _ = try medRepo.createDose(makeDose(medicationId: med2.id, at: yesterday))

        let count = try repo.countUsageDays(category: .nsaid, windowDays: 30, now: now.addingTimeInterval(60))
        // Two distinct calendar days (today + yesterday)
        XCTAssertEqual(count, 2)
    }
}
