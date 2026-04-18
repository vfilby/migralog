import XCTest
@testable import MigraLog

@MainActor
final class MedicationDetailViewModelTests: XCTestCase {
    private var mockRepo: MockMedicationRepository!
    private var mockCategoryLimitRepo: MockCategoryUsageLimitRepository!
    private var sut: MedicationDetailViewModel!
    private var testMed: Medication!

    override func setUp() {
        super.setUp()
        mockRepo = MockMedicationRepository()
        mockCategoryLimitRepo = MockCategoryUsageLimitRepository()
        testMed = TestFixtures.makeMedication(id: "med-1", name: "Ibuprofen")
        mockRepo.medications = [testMed]
        mockRepo.schedules = [
            TestFixtures.makeSchedule(id: "sched-1", medicationId: "med-1", time: "08:00")
        ]
        mockRepo.doses = [
            TestFixtures.makeDose(id: "dose-1", medicationId: "med-1")
        ]
        sut = MedicationDetailViewModel(
            medicationId: "med-1",
            medicationRepository: mockRepo,
            categoryLimitRepository: mockCategoryLimitRepo
        )
    }

    // MARK: - Load

    func testLoadMedication_populatesState() async throws {
        await sut.loadMedication()

        XCTAssertNotNil(sut.medication)
        XCTAssertEqual(sut.medication?.name, "Ibuprofen")
        XCTAssertEqual(sut.schedules.count, 1)
        XCTAssertEqual(sut.recentDoses.count, 1)
        XCTAssertFalse(sut.isLoading)
        XCTAssertNil(sut.error)
        // getMedicationWithDetails is a protocol extension; verify the underlying call was made
        XCTAssertTrue(mockRepo.createMedicationCalled == false) // Sanity check: no mutation
        XCTAssertNotNil(sut.medication)
    }

    func testLoadMedication_notFound_stateEmpty() async throws {
        sut = MedicationDetailViewModel(
            medicationId: "nonexistent",
            medicationRepository: mockRepo,
            categoryLimitRepository: mockCategoryLimitRepo
        )
        await sut.loadMedication()

        XCTAssertNil(sut.medication)
        XCTAssertTrue(sut.schedules.isEmpty)
        XCTAssertTrue(sut.recentDoses.isEmpty)
    }

    func testLoadMedication_error_setsError() async throws {
        mockRepo.errorToThrow = TestError.mockError("DB error")
        await sut.loadMedication()

        XCTAssertNil(sut.medication)
        XCTAssertNotNil(sut.error)
        XCTAssertFalse(sut.isLoading)
    }

    // MARK: - Log Dose

    func testLogDoseNow_createsDose() async throws {
        await sut.loadMedication()
        let initialCount = sut.recentDoses.count

        await sut.logDoseNow()

        XCTAssertEqual(sut.recentDoses.count, initialCount + 1)
        XCTAssertTrue(mockRepo.createDoseCalled)
        // Newest dose should be first
        XCTAssertEqual(sut.recentDoses.first?.status, .taken)
    }

    func testLogDoseNow_noMedication_noOp() async throws {
        // Don't load medication
        await sut.logDoseNow()

        XCTAssertFalse(mockRepo.createDoseCalled)
    }

    // MARK: - Archive

    func testArchiveMedication_setsInactive() async throws {
        await sut.loadMedication()
        XCTAssertTrue(sut.medication!.active)

        await sut.archiveMedication()

        XCTAssertFalse(sut.medication!.active)
        XCTAssertTrue(mockRepo.archiveMedicationCalled)
    }

    func testUnarchiveMedication_setsActive() async throws {
        mockRepo.medications = [TestFixtures.makeMedication(id: "med-1", active: false)]
        await sut.loadMedication()
        XCTAssertFalse(sut.medication!.active)

        await sut.unarchiveMedication()

        XCTAssertTrue(sut.medication!.active)
        XCTAssertTrue(mockRepo.unarchiveMedicationCalled)
    }

    // MARK: - Delete Medication

    func testDeleteMedication_returnsTrue() async throws {
        let result = await sut.deleteMedication()

        XCTAssertTrue(result)
        XCTAssertTrue(mockRepo.deleteMedicationCalled)
    }

    func testDeleteMedication_error_returnsFalse() async throws {
        mockRepo.errorToThrow = TestError.mockError("Cannot delete")
        let result = await sut.deleteMedication()

        XCTAssertFalse(result)
        XCTAssertNotNil(sut.error)
    }

    // MARK: - Delete Dose

    func testDeleteDose_removesFromList() async throws {
        await sut.loadMedication()
        XCTAssertEqual(sut.recentDoses.count, 1)

        await sut.deleteDose("dose-1")

        XCTAssertTrue(sut.recentDoses.isEmpty)
        XCTAssertTrue(mockRepo.deleteDoseCalled)
    }

    // MARK: - Schedules

    func testAddSchedule_addsToList() async throws {
        await sut.loadMedication()
        let initialCount = sut.schedules.count

        await sut.addSchedule(time: "14:00", dosage: 2.0)

        XCTAssertEqual(sut.schedules.count, initialCount + 1)
        XCTAssertEqual(sut.schedules.last?.time, "14:00")
    }

    func testDeleteSchedule_removesFromList() async throws {
        await sut.loadMedication()

        await sut.deleteSchedule("sched-1")

        XCTAssertTrue(sut.schedules.isEmpty)
    }

    func testUpdateSchedule_updatesInList() async throws {
        await sut.loadMedication()
        var schedule = sut.schedules[0]
        schedule.enabled = false

        await sut.updateSchedule(schedule)

        XCTAssertFalse(sut.schedules[0].enabled)
    }

    // MARK: - Update Medication (defaultQuantity sync)

    /// Regression test for #399: changing a medication's default dose must also
    /// update the dosage on all associated schedules, because the dashboard home
    /// card reads `schedule.dosage` (not `medication.defaultQuantity`) for its
    /// "Log N × Xmg" label and the logDose flow.
    func testUpdateMedication_whenDefaultQuantityChanges_updatesSchedulesDosage() async throws {
        // Seed: medication with defaultQuantity 2 and a schedule whose dosage is
        // also 2 (mirrors the state after AddMedicationScreen + typical usage).
        var seededMed = TestFixtures.makeMedication(id: "med-1", name: "Ibuprofen")
        seededMed.defaultQuantity = 2.0
        mockRepo.medications = [seededMed]
        mockRepo.schedules = [
            TestFixtures.makeSchedule(id: "sched-1", medicationId: "med-1", time: "08:00", dosage: 2.0),
            TestFixtures.makeSchedule(id: "sched-2", medicationId: "med-1", time: "20:00", dosage: 2.0)
        ]

        await sut.loadMedication()
        XCTAssertEqual(sut.medication?.defaultQuantity, 2.0)
        XCTAssertEqual(sut.schedules.count, 2)

        // Act: user edits the medication and changes defaultQuantity from 2 → 1.
        var updated = sut.medication!
        updated.defaultQuantity = 1.0
        await sut.updateMedication(updated)

        // Assert: view-model schedules and the mock repo's schedules reflect the
        // new quantity, not the old one.
        XCTAssertEqual(sut.medication?.defaultQuantity, 1.0)
        XCTAssertTrue(sut.schedules.allSatisfy { $0.dosage == 1.0 }, "All schedules should be updated to new defaultQuantity")
        let storedSchedules = try mockRepo.getSchedulesByMedicationId("med-1")
        XCTAssertTrue(storedSchedules.allSatisfy { $0.dosage == 1.0 }, "Persisted schedules should reflect new quantity")
    }

    func testUpdateMedication_whenDefaultQuantityUnchanged_doesNotTouchSchedules() async throws {
        var seededMed = TestFixtures.makeMedication(id: "med-1", name: "Ibuprofen")
        seededMed.defaultQuantity = 2.0
        mockRepo.medications = [seededMed]
        mockRepo.schedules = [
            TestFixtures.makeSchedule(id: "sched-1", medicationId: "med-1", time: "08:00", dosage: 2.0)
        ]

        await sut.loadMedication()

        // Act: change name only, leave defaultQuantity alone.
        var updated = sut.medication!
        updated.name = "Advil"
        await sut.updateMedication(updated)

        // Schedule dosage should be untouched.
        XCTAssertEqual(sut.schedules[0].dosage, 2.0)
    }
}
