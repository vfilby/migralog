import XCTest
@testable import MigraLog

final class MedicationDoseLoggerTests: XCTestCase {
    private var mockMedicationRepo: MockMedicationRepository!
    private var mockNotificationService: MockMedicationNotificationService!
    private var sut: MedicationDoseLogger!

    override func setUp() {
        super.setUp()
        mockMedicationRepo = MockMedicationRepository()
        mockNotificationService = MockMedicationNotificationService()
        sut = MedicationDoseLogger(
            medicationRepo: mockMedicationRepo,
            notificationService: mockNotificationService
        )
    }

    override func tearDown() {
        sut = nil
        mockMedicationRepo = nil
        mockNotificationService = nil
        super.tearDown()
    }

    func testRecord_persistsDoseAndCancelsTodaysReminders() async throws {
        let dose = makeDose(medicationId: "med-1")

        let saved = try await sut.record(dose)

        XCTAssertEqual(saved.id, dose.id)
        XCTAssertEqual(mockMedicationRepo.doses.count, 1, "Dose should be persisted")
        XCTAssertEqual(mockMedicationRepo.doses.first?.id, dose.id)
        XCTAssertEqual(
            mockNotificationService.cancelTodaysRemindersCalls, ["med-1"],
            "Should cancel today's reminders for the medication that was just logged"
        )
    }

    func testRecord_doesNotCancelReminders_whenPersistFails() async {
        mockMedicationRepo.errorToThrow = NSError(domain: "test", code: 1)
        let dose = makeDose(medicationId: "med-1")

        do {
            _ = try await sut.record(dose)
            XCTFail("Expected error to be rethrown")
        } catch {
            XCTAssertTrue(
                mockNotificationService.cancelTodaysRemindersCalls.isEmpty,
                "Reminders must not be cancelled if the dose was never written"
            )
        }
    }

    // MARK: - Helpers

    private func makeDose(medicationId: String) -> MedicationDose {
        let now = TimestampHelper.now
        return MedicationDose(
            id: UUID().uuidString,
            medicationId: medicationId,
            timestamp: now,
            quantity: 1,
            dosageAmount: 10,
            dosageUnit: "mg",
            status: .taken,
            episodeId: nil,
            effectivenessRating: nil,
            timeToRelief: nil,
            sideEffects: [],
            notes: nil,
            createdAt: now,
            updatedAt: now
        )
    }
}
