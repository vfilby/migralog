import XCTest
import UserNotifications
@testable import MigraLog

// MARK: - Mock Daily Checkin Notification Service

final class MockDailyCheckinNotificationService: DailyCheckinNotificationServiceProtocol, @unchecked Sendable {
    var scheduleNotificationsCalled = false
    var cancelAllCalled = false
    var cancelForDateCalls: [String] = []
    var topUpCalled = false
    var isScheduledResult = false

    func scheduleNotifications() async throws {
        scheduleNotificationsCalled = true
    }

    func cancelAll() async {
        cancelAllCalled = true
    }

    func cancelForDate(_ date: String) async {
        cancelForDateCalls.append(date)
    }

    func topUp() async {
        topUpCalled = true
    }

    func isScheduled() async -> Bool {
        isScheduledResult
    }
}

// MARK: - Mock Medication Notification Service (for protocol)

final class MockMedicationNotificationService: MedicationNotificationServiceProtocol, @unchecked Sendable {
    var handleTakenCalls: [(medicationId: String, scheduleId: String)] = []
    var handleSkippedCalls: [(medicationId: String, scheduleId: String)] = []
    var rescheduleAllCalled = false
    var cancelCalls: [String] = []
    var topUpCalled = false
    var rebalanceCalled = false

    func rescheduleAllMedicationNotifications() async throws {
        rescheduleAllCalled = true
    }

    func cancelMedicationReminders(for medicationId: String) async {
        cancelCalls.append(medicationId)
    }

    func cancelNotificationForDate(
        medicationId: String, scheduleId: String,
        date: String, notificationType: NotificationType
    ) async {}

    func dismissMedicationNotification(medicationId: String, scheduleId: String) async {}

    func handleTakenResponse(medicationId: String, scheduleId: String) async {
        handleTakenCalls.append((medicationId, scheduleId))
    }

    func handleSkippedResponse(medicationId: String, scheduleId: String) async {
        handleSkippedCalls.append((medicationId, scheduleId))
    }

    func topUp(threshold: Int) async {
        topUpCalled = true
    }

    func rebalance() async {
        rebalanceCalled = true
    }
}

// MARK: - Tests

final class NotificationResponseHandlerTests: XCTestCase {
    private var sut: NotificationResponseHandler!
    private var mockMedNotifService: MockMedicationNotificationService!
    private var mockMedicationRepo: MockMedicationRepository!
    private var mockNotificationService: MockNotificationService!
    private var mockDailyStatusRepo: MockDailyStatusRepository!
    private var mockDailyCheckinService: MockDailyCheckinNotificationService!

    override func setUp() {
        super.setUp()
        mockMedNotifService = MockMedicationNotificationService()
        mockMedicationRepo = MockMedicationRepository()
        mockNotificationService = MockNotificationService()
        mockDailyStatusRepo = MockDailyStatusRepository()
        mockDailyCheckinService = MockDailyCheckinNotificationService()

        sut = NotificationResponseHandler(
            medicationNotificationService: mockMedNotifService,
            medicationRepository: mockMedicationRepo,
            notificationService: mockNotificationService,
            dailyStatusRepo: mockDailyStatusRepo,
            dailyCheckinService: mockDailyCheckinService
        )
    }

    override func tearDown() {
        sut = nil
        mockMedNotifService = nil
        mockMedicationRepo = nil
        mockNotificationService = nil
        mockDailyStatusRepo = nil
        mockDailyCheckinService = nil
        super.tearDown()
    }

    // MARK: - Initialization

    func testInit_setsUpAllDependencies() {
        XCTAssertNotNil(sut)
    }

    func testHandler_conformsToDelegate() {
        XCTAssertTrue(sut is UNUserNotificationCenterDelegate)
    }

    // MARK: - Single Medication: Taken

    func testHandleSingleMedication_taken_logsDoseAsTaken() async {
        let medication = TestFixtures.makeMedication(id: "med-1", name: "Topiramate")
        mockMedicationRepo.medications = [medication]

        let userInfo: [AnyHashable: Any] = ["medicationId": "med-1", "scheduleId": "sched-1"]
        await sut.handleSingleMedicationResponse(
            actionIdentifier: NotificationAction.medicationTaken,
            userInfo: userInfo
        )

        XCTAssertTrue(mockMedicationRepo.createDoseCalled, "A dose should have been created")
        XCTAssertEqual(mockMedicationRepo.doses.count, 1)
        XCTAssertEqual(mockMedicationRepo.doses.first?.medicationId, "med-1")
        XCTAssertEqual(mockMedicationRepo.doses.first?.status, .taken)
    }

    // MARK: - Single Medication: Skipped

    func testHandleSingleMedication_skipped_logsDoseAsSkipped() async {
        let medication = TestFixtures.makeMedication(id: "med-1", name: "Topiramate")
        mockMedicationRepo.medications = [medication]

        let userInfo: [AnyHashable: Any] = ["medicationId": "med-1", "scheduleId": "sched-1"]
        await sut.handleSingleMedicationResponse(
            actionIdentifier: NotificationAction.medicationSkipped,
            userInfo: userInfo
        )

        XCTAssertTrue(mockMedicationRepo.createDoseCalled)
        XCTAssertEqual(mockMedicationRepo.doses.count, 1)
        XCTAssertEqual(mockMedicationRepo.doses.first?.status, .skipped)
    }

    // MARK: - Single Medication: Snooze

    func testHandleSingleMedication_snooze_schedulesNewNotification() async {
        let medication = TestFixtures.makeMedication(id: "med-1", name: "Topiramate")
        mockMedicationRepo.medications = [medication]

        let userInfo: [AnyHashable: Any] = [
            "medicationId": "med-1",
            "scheduleId": "sched-1",
            "title": "Take Topiramate",
            "body": "Time for your medication"
        ]
        await sut.handleSingleMedicationResponse(
            actionIdentifier: NotificationAction.medicationSnooze,
            userInfo: userInfo
        )

        // No dose should be logged for snooze
        XCTAssertFalse(mockMedicationRepo.createDoseCalled)
        XCTAssertEqual(mockMedicationRepo.doses.count, 0)

        // A new notification should be scheduled
        XCTAssertEqual(mockNotificationService.scheduledNotifications.count, 1)
        let scheduled = mockNotificationService.scheduledNotifications.first!
        XCTAssertTrue(scheduled.id.hasPrefix("snooze_"))
        XCTAssertEqual(scheduled.categoryIdentifier, NotificationCategory.medication)

        // Verify 10-minute trigger
        if let trigger = scheduled.trigger as? UNTimeIntervalNotificationTrigger {
            XCTAssertEqual(trigger.timeInterval, 600, "Snooze should be 10 minutes (600 seconds)")
            XCTAssertFalse(trigger.repeats)
        } else {
            XCTFail("Trigger should be a UNTimeIntervalNotificationTrigger")
        }
    }

    // MARK: - Single Medication: Default Quantity

    func testHandleSingleMedication_taken_usesDefaultQuantity() async {
        let medication = TestFixtures.makeMedication(id: "med-1", name: "Topiramate", dosageAmount: 50, dosageUnit: "mg")
        // TestFixtures.makeMedication sets defaultQuantity to 1.0
        mockMedicationRepo.medications = [medication]

        let userInfo: [AnyHashable: Any] = ["medicationId": "med-1", "scheduleId": "sched-1"]
        await sut.handleSingleMedicationResponse(
            actionIdentifier: NotificationAction.medicationTaken,
            userInfo: userInfo
        )

        XCTAssertEqual(mockMedicationRepo.doses.first?.quantity, 1.0, "Should use medication's defaultQuantity")
        XCTAssertEqual(mockMedicationRepo.doses.first?.dosageAmount, 50, "Should use medication's dosageAmount")
        XCTAssertEqual(mockMedicationRepo.doses.first?.dosageUnit, "mg", "Should use medication's dosageUnit")
    }

    // MARK: - Single Medication: Missing userInfo

    func testHandleSingleMedication_missingMedicationId_doesNotCrash() async {
        let userInfo: [AnyHashable: Any] = [:]  // No medicationId or scheduleId
        await sut.handleSingleMedicationResponse(
            actionIdentifier: NotificationAction.medicationTaken,
            userInfo: userInfo
        )

        // Should not crash, and no dose should be logged
        XCTAssertFalse(mockMedicationRepo.createDoseCalled)
        XCTAssertEqual(mockMedicationRepo.doses.count, 0)
    }

    // MARK: - Single Medication: Medication Not Found

    func testHandleSingleMedication_medicationNotFound_doesNotCrash() async {
        // No medications in repo
        mockMedicationRepo.medications = []

        let userInfo: [AnyHashable: Any] = ["medicationId": "nonexistent-id", "scheduleId": "sched-1"]
        await sut.handleSingleMedicationResponse(
            actionIdentifier: NotificationAction.medicationTaken,
            userInfo: userInfo
        )

        // Should not crash, and no dose should be created
        XCTAssertFalse(mockMedicationRepo.createDoseCalled)
        XCTAssertEqual(mockMedicationRepo.doses.count, 0)
    }

    // MARK: - Single Medication: Default Action (Tap)

    func testHandleSingleMedication_defaultAction_doesNotLogDose() async {
        let medication = TestFixtures.makeMedication(id: "med-1", name: "Topiramate")
        mockMedicationRepo.medications = [medication]

        let userInfo: [AnyHashable: Any] = ["medicationId": "med-1", "scheduleId": "sched-1"]
        await sut.handleSingleMedicationResponse(
            actionIdentifier: UNNotificationDefaultActionIdentifier,
            userInfo: userInfo
        )

        // Tapping the notification should just open the app, not log a dose
        XCTAssertFalse(mockMedicationRepo.createDoseCalled)
        XCTAssertEqual(mockMedicationRepo.doses.count, 0)
    }

    // MARK: - Single Medication: Taken calls handleTakenResponse

    func testHandleSingleMedication_taken_callsHandleTakenResponse() async {
        let medication = TestFixtures.makeMedication(id: "med-1", name: "Topiramate")
        mockMedicationRepo.medications = [medication]

        let userInfo: [AnyHashable: Any] = ["medicationId": "med-1", "scheduleId": "sched-1"]
        await sut.handleSingleMedicationResponse(
            actionIdentifier: NotificationAction.medicationTaken,
            userInfo: userInfo
        )

        XCTAssertEqual(mockMedNotifService.handleTakenCalls.count, 1)
        XCTAssertEqual(mockMedNotifService.handleTakenCalls.first?.medicationId, "med-1")
        XCTAssertEqual(mockMedNotifService.handleTakenCalls.first?.scheduleId, "sched-1")
    }

    // MARK: - Single Medication: Skipped calls handleSkippedResponse

    func testHandleSingleMedication_skipped_callsHandleSkippedResponse() async {
        let medication = TestFixtures.makeMedication(id: "med-1", name: "Topiramate")
        mockMedicationRepo.medications = [medication]

        let userInfo: [AnyHashable: Any] = ["medicationId": "med-1", "scheduleId": "sched-1"]
        await sut.handleSingleMedicationResponse(
            actionIdentifier: NotificationAction.medicationSkipped,
            userInfo: userInfo
        )

        XCTAssertEqual(mockMedNotifService.handleSkippedCalls.count, 1)
        XCTAssertEqual(mockMedNotifService.handleSkippedCalls.first?.medicationId, "med-1")
        XCTAssertEqual(mockMedNotifService.handleSkippedCalls.first?.scheduleId, "sched-1")
    }

    // MARK: - Grouped Medication: Take All

    func testHandleGrouped_takeAll_logsDoseForAllMeds() async {
        let medA = TestFixtures.makeMedication(id: "med-a", name: "Med A")
        let medB = TestFixtures.makeMedication(id: "med-b", name: "Med B")
        mockMedicationRepo.medications = [medA, medB]

        let userInfo: [AnyHashable: Any] = ["medicationIds": ["med-a", "med-b"]]
        await sut.handleGroupedMedicationResponse(
            actionIdentifier: NotificationAction.takeAllNow,
            userInfo: userInfo
        )

        XCTAssertEqual(mockMedicationRepo.doses.count, 2)
        let medicationIds = Set(mockMedicationRepo.doses.map(\.medicationId))
        XCTAssertEqual(medicationIds, Set(["med-a", "med-b"]))
        XCTAssertTrue(mockMedicationRepo.doses.allSatisfy { $0.status == .taken })
    }

    // MARK: - Grouped Medication: Skip All

    func testHandleGrouped_skipAll_logsSkippedForAllMeds() async {
        let medA = TestFixtures.makeMedication(id: "med-a", name: "Med A")
        let medB = TestFixtures.makeMedication(id: "med-b", name: "Med B")
        mockMedicationRepo.medications = [medA, medB]

        let userInfo: [AnyHashable: Any] = ["medicationIds": ["med-a", "med-b"]]
        await sut.handleGroupedMedicationResponse(
            actionIdentifier: NotificationAction.skipAll,
            userInfo: userInfo
        )

        XCTAssertEqual(mockMedicationRepo.doses.count, 2)
        XCTAssertTrue(mockMedicationRepo.doses.allSatisfy { $0.status == .skipped })
    }

    // MARK: - Grouped Medication: Remind Later

    func testHandleGrouped_remindLater_schedulesNewNotification() async {
        let userInfo: [AnyHashable: Any] = [
            "medicationIds": ["med-a", "med-b"],
            "title": "Take your medications",
            "body": "Med A, Med B"
        ]
        await sut.handleGroupedMedicationResponse(
            actionIdentifier: NotificationAction.remindLater,
            userInfo: userInfo
        )

        // No doses should be logged
        XCTAssertEqual(mockMedicationRepo.doses.count, 0)

        // A snoozed notification should be scheduled
        XCTAssertEqual(mockNotificationService.scheduledNotifications.count, 1)
        let scheduled = mockNotificationService.scheduledNotifications.first!
        XCTAssertTrue(scheduled.id.hasPrefix("snooze_"))
        XCTAssertEqual(scheduled.categoryIdentifier, NotificationCategory.multipleMedication)

        if let trigger = scheduled.trigger as? UNTimeIntervalNotificationTrigger {
            XCTAssertEqual(trigger.timeInterval, 600)
        } else {
            XCTFail("Expected UNTimeIntervalNotificationTrigger")
        }
    }

    // MARK: - Grouped Medication: Partial Failure

    func testHandleGrouped_takeAll_partialFailure_logsWhatItCan() async {
        // Only medA exists, medB does not
        let medA = TestFixtures.makeMedication(id: "med-a", name: "Med A")
        mockMedicationRepo.medications = [medA]

        let userInfo: [AnyHashable: Any] = ["medicationIds": ["med-a", "med-b"]]
        await sut.handleGroupedMedicationResponse(
            actionIdentifier: NotificationAction.takeAllNow,
            userInfo: userInfo
        )

        // Only medA should have a dose logged; medB not found but no crash
        XCTAssertEqual(mockMedicationRepo.doses.count, 1)
        XCTAssertEqual(mockMedicationRepo.doses.first?.medicationId, "med-a")
    }

    // MARK: - Grouped Medication: Empty IDs

    func testHandleGrouped_emptyMedicationIds_doesNotCrash() async {
        let userInfo: [AnyHashable: Any] = ["medicationIds": [String]()]
        await sut.handleGroupedMedicationResponse(
            actionIdentifier: NotificationAction.takeAllNow,
            userInfo: userInfo
        )

        XCTAssertEqual(mockMedicationRepo.doses.count, 0)
    }

    // MARK: - Grouped Medication: Missing medicationIds

    func testHandleGrouped_missingMedicationIds_doesNotCrash() async {
        let userInfo: [AnyHashable: Any] = [:]
        await sut.handleGroupedMedicationResponse(
            actionIdentifier: NotificationAction.takeAllNow,
            userInfo: userInfo
        )

        XCTAssertEqual(mockMedicationRepo.doses.count, 0)
    }

    // MARK: - Daily Check-in: Clear Day

    func testHandleDailyCheckin_clearDay_logsGreenStatus() async {
        let userInfo: [AnyHashable: Any] = ["date": "2026-03-24"]
        await sut.handleDailyCheckinResponse(
            actionIdentifier: NotificationAction.clearDay,
            userInfo: userInfo
        )

        XCTAssertTrue(mockDailyStatusRepo.createStatusCalled)
        XCTAssertEqual(mockDailyStatusRepo.statuses.count, 1)
        let logged = mockDailyStatusRepo.statuses.first!
        XCTAssertEqual(logged.date, "2026-03-24")
        XCTAssertEqual(logged.status, .green)
        XCTAssertTrue(logged.prompted, "Status from notification should be marked as prompted")
    }

    func testHandleDailyCheckin_clearDay_cancelsNotificationForDate() async {
        let userInfo: [AnyHashable: Any] = ["date": "2026-03-24"]
        await sut.handleDailyCheckinResponse(
            actionIdentifier: NotificationAction.clearDay,
            userInfo: userInfo
        )

        XCTAssertEqual(mockDailyCheckinService.cancelForDateCalls, ["2026-03-24"])
    }

    func testHandleDailyCheckin_clearDay_topsUpNotifications() async {
        let userInfo: [AnyHashable: Any] = ["date": "2026-03-24"]
        await sut.handleDailyCheckinResponse(
            actionIdentifier: NotificationAction.clearDay,
            userInfo: userInfo
        )

        XCTAssertTrue(mockDailyCheckinService.topUpCalled)
    }

    func testHandleDailyCheckin_clearDay_missingDate_doesNotCrash() async {
        let userInfo: [AnyHashable: Any] = [:]  // No date
        await sut.handleDailyCheckinResponse(
            actionIdentifier: NotificationAction.clearDay,
            userInfo: userInfo
        )

        // Should not crash, and no status should be logged
        XCTAssertFalse(mockDailyStatusRepo.createStatusCalled)
        XCTAssertEqual(mockDailyStatusRepo.statuses.count, 0)
    }

    func testHandleDailyCheckin_notClear_doesNotLogStatus() async {
        let userInfo: [AnyHashable: Any] = ["date": "2026-03-24"]
        await sut.handleDailyCheckinResponse(
            actionIdentifier: NotificationAction.notClear,
            userInfo: userInfo
        )

        // NOT_CLEAR should just open app, not log a status
        XCTAssertFalse(mockDailyStatusRepo.createStatusCalled)
        XCTAssertEqual(mockDailyStatusRepo.statuses.count, 0)
    }

    // MARK: - Daily Check-in: Default Action (Tap)

    func testHandleDailyCheckin_defaultAction_doesNotLogStatus() async {
        let userInfo: [AnyHashable: Any] = ["date": "2026-03-24"]
        await sut.handleDailyCheckinResponse(
            actionIdentifier: UNNotificationDefaultActionIdentifier,
            userInfo: userInfo
        )

        XCTAssertFalse(mockDailyStatusRepo.createStatusCalled)
    }

    // MARK: - shouldShowNotification: Single Medication

    func testShouldShow_singleMed_notLoggedToday_showsNotification() {
        let medication = TestFixtures.makeMedication(id: "med-1", name: "Topiramate")
        mockMedicationRepo.medications = [medication]
        // No doses logged

        let result = sut.shouldShowNotification(
            categoryIdentifier: NotificationCategory.medication,
            userInfo: ["medicationId": "med-1"]
        )

        XCTAssertTrue(result, "Should show notification when dose not yet logged today")
    }

    func testShouldShow_singleMed_alreadyLoggedToday_suppressesNotification() {
        let medication = TestFixtures.makeMedication(id: "med-1", name: "Topiramate")
        mockMedicationRepo.medications = [medication]

        // Add a dose logged today
        let dose = TestFixtures.makeDose(medicationId: "med-1", timestamp: TimestampHelper.now, status: .taken)
        mockMedicationRepo.doses = [dose]

        let result = sut.shouldShowNotification(
            categoryIdentifier: NotificationCategory.medication,
            userInfo: ["medicationId": "med-1"]
        )

        XCTAssertFalse(result, "Should suppress notification when dose already logged today")
    }

    // MARK: - shouldShowNotification: Grouped Medication

    func testShouldShow_groupedMed_noneLogged_showsNotification() {
        let medA = TestFixtures.makeMedication(id: "med-a", name: "Med A")
        let medB = TestFixtures.makeMedication(id: "med-b", name: "Med B")
        mockMedicationRepo.medications = [medA, medB]
        // No doses logged

        let result = sut.shouldShowNotification(
            categoryIdentifier: NotificationCategory.multipleMedication,
            userInfo: ["medicationIds": ["med-a", "med-b"]]
        )

        XCTAssertTrue(result, "Should show when no medications are logged")
    }

    func testShouldShow_groupedMed_someLogged_showsNotification() {
        let medA = TestFixtures.makeMedication(id: "med-a", name: "Med A")
        let medB = TestFixtures.makeMedication(id: "med-b", name: "Med B")
        mockMedicationRepo.medications = [medA, medB]

        // Only medA has a dose today
        let dose = TestFixtures.makeDose(medicationId: "med-a", timestamp: TimestampHelper.now, status: .taken)
        mockMedicationRepo.doses = [dose]

        let result = sut.shouldShowNotification(
            categoryIdentifier: NotificationCategory.multipleMedication,
            userInfo: ["medicationIds": ["med-a", "med-b"]]
        )

        XCTAssertTrue(result, "Should show when only some medications are logged (user still needs to see it)")
    }

    func testShouldShow_groupedMed_allLogged_suppressesNotification() {
        let medA = TestFixtures.makeMedication(id: "med-a", name: "Med A")
        let medB = TestFixtures.makeMedication(id: "med-b", name: "Med B")
        mockMedicationRepo.medications = [medA, medB]

        // Both have doses today
        let doseA = TestFixtures.makeDose(medicationId: "med-a", timestamp: TimestampHelper.now, status: .taken)
        let doseB = TestFixtures.makeDose(medicationId: "med-b", timestamp: TimestampHelper.now, status: .taken)
        mockMedicationRepo.doses = [doseA, doseB]

        let result = sut.shouldShowNotification(
            categoryIdentifier: NotificationCategory.multipleMedication,
            userInfo: ["medicationIds": ["med-a", "med-b"]]
        )

        XCTAssertFalse(result, "Should suppress when all medications are logged")
    }

    // MARK: - shouldShowNotification: Error Handling

    func testShouldShow_dbError_failSafeShowsNotification() {
        mockMedicationRepo.errorToThrow = TestError.mockError("DB failure")

        let result = sut.shouldShowNotification(
            categoryIdentifier: NotificationCategory.medication,
            userInfo: ["medicationId": "med-1"]
        )

        XCTAssertTrue(result, "Fail-safe: should show notification on error")
    }

    // MARK: - shouldShowNotification: Non-Medication Categories

    func testShouldShow_nonMedicationCategory_showsNotification() {
        let result = sut.shouldShowNotification(
            categoryIdentifier: "UNKNOWN_CATEGORY",
            userInfo: [:]
        )

        XCTAssertTrue(result, "Unknown categories should always show")
    }

    func testShouldShow_dailyCheckin_alwaysShows() {
        let result = sut.shouldShowNotification(
            categoryIdentifier: NotificationCategory.dailyCheckin,
            userInfo: ["date": "2026-03-24"]
        )

        XCTAssertTrue(result, "Daily checkin should always show (suppression handled by not scheduling)")
    }

    // MARK: - logDoseFromNotification: Correct Dose Record

    func testLogDose_createsCorrectDoseRecord() async {
        let medication = TestFixtures.makeMedication(
            id: "med-1",
            name: "Topiramate",
            dosageAmount: 50,
            dosageUnit: "mg"
        )
        mockMedicationRepo.medications = [medication]

        await sut.logDoseFromNotification(medicationId: "med-1", status: .taken)

        XCTAssertEqual(mockMedicationRepo.doses.count, 1)
        let dose = mockMedicationRepo.doses.first!
        XCTAssertEqual(dose.medicationId, "med-1")
        XCTAssertEqual(dose.status, .taken)
        XCTAssertEqual(dose.quantity, 1.0, "Should use medication.defaultQuantity")
        XCTAssertEqual(dose.dosageAmount, 50)
        XCTAssertEqual(dose.dosageUnit, "mg")
        XCTAssertNil(dose.episodeId, "Notification-logged doses should not be linked to an episode")
        XCTAssertEqual(dose.notes, "Logged via notification")
        XCTAssertEqual(dose.sideEffects, [])
    }

    // MARK: - logDoseFromNotification: Posts Notification

    func testLogDose_postsMedicationDataChangedNotification() async {
        let medication = TestFixtures.makeMedication(id: "med-1", name: "Topiramate")
        mockMedicationRepo.medications = [medication]

        let expectation = expectation(forNotification: .medicationDataChanged, object: nil)

        await sut.logDoseFromNotification(medicationId: "med-1", status: .taken)

        await fulfillment(of: [expectation], timeout: 2.0)
    }

    // MARK: - logDoseFromNotification: Medication Not Found

    func testLogDose_medicationNotFound_logsError() async {
        mockMedicationRepo.medications = []

        await sut.logDoseFromNotification(medicationId: "nonexistent", status: .taken)

        // Should not crash, and no dose should be created
        XCTAssertFalse(mockMedicationRepo.createDoseCalled)
        XCTAssertEqual(mockMedicationRepo.doses.count, 0)
    }

    // MARK: - logDoseFromNotification: DB Error

    func testLogDose_dbError_doesNotCrash() async {
        mockMedicationRepo.errorToThrow = TestError.mockError("DB write failure")

        await sut.logDoseFromNotification(medicationId: "med-1", status: .taken)

        // Should not crash
        XCTAssertEqual(mockMedicationRepo.doses.count, 0)
    }

    // MARK: - logClearDay: Posts dailyStatusDataChanged Notification

    func testLogClearDay_postsDailyStatusDataChangedNotification() async {
        let expectation = expectation(forNotification: .dailyStatusDataChanged, object: nil)

        await sut.logClearDay(date: "2026-03-24")

        await fulfillment(of: [expectation], timeout: 2.0)
    }

    // MARK: - logClearDay: DB Error

    func testLogClearDay_dbError_doesNotCrash() async {
        mockDailyStatusRepo.errorToThrow = TestError.mockError("DB write failure")

        await sut.logClearDay(date: "2026-03-24")

        // Should not crash, and cancelForDate/topUp should NOT be called (error path)
        XCTAssertFalse(mockDailyStatusRepo.createStatusCalled)
        XCTAssertTrue(mockDailyCheckinService.cancelForDateCalls.isEmpty)
        XCTAssertFalse(mockDailyCheckinService.topUpCalled)
    }

    // MARK: - scheduleSnoozedNotification: Verifies Parameters

    func testScheduleSnoozedNotification_schedulesWithCorrectParams() async {
        let userInfo: [AnyHashable: Any] = [
            "medicationId": "med-1",
            "title": "Take your medication",
            "body": "Time for Topiramate"
        ]
        await sut.scheduleSnoozedNotificationFromUserInfo(
            userInfo: userInfo,
            category: NotificationCategory.medication
        )

        XCTAssertEqual(mockNotificationService.scheduledNotifications.count, 1)
        let scheduled = mockNotificationService.scheduledNotifications.first!
        XCTAssertTrue(scheduled.id.hasPrefix("snooze_"))
        XCTAssertEqual(scheduled.title, "Take your medication")
        XCTAssertEqual(scheduled.body, "Time for Topiramate")
        XCTAssertEqual(scheduled.categoryIdentifier, NotificationCategory.medication)
    }
}
