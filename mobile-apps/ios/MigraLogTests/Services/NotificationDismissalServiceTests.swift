import XCTest
@testable import MigraLog

final class NotificationDismissalServiceTests: XCTestCase {
    private var sut: NotificationDismissalService!
    private var mockScheduledNotificationRepo: MockScheduledNotificationRepository!
    private var mockMedicationRepo: MockMedicationRepository!

    override func setUp() {
        super.setUp()
        mockScheduledNotificationRepo = MockScheduledNotificationRepository()
        mockMedicationRepo = MockMedicationRepository()
        sut = NotificationDismissalService(
            scheduledNotificationRepo: mockScheduledNotificationRepo,
            medicationRepo: mockMedicationRepo
        )
    }

    override func tearDown() {
        sut = nil
        mockScheduledNotificationRepo = nil
        mockMedicationRepo = nil
        super.tearDown()
    }

    // MARK: - Single Notification

    func testShouldDismiss_singleNotificationMatchingMedSchedule_returnsTrue() throws {
        let mapping = makeMapping(
            notificationId: "notif-1",
            medicationId: "med-1",
            scheduleId: "sched-1",
            isGrouped: false
        )
        mockScheduledNotificationRepo.notifications = [mapping]

        let result = try sut.shouldDismissNotification(
            notificationId: "notif-1",
            targetMedicationId: "med-1",
            targetScheduleId: "sched-1"
        )

        XCTAssertTrue(result.shouldDismiss)
        XCTAssertEqual(result.context, "Single medication matched")
    }

    // MARK: - No Mapping Found

    func testShouldDismiss_noMappingFound_returnsFalse() throws {
        mockScheduledNotificationRepo.notifications = []

        let result = try sut.shouldDismissNotification(
            notificationId: "notif-nonexistent",
            targetMedicationId: "med-1",
            targetScheduleId: "sched-1"
        )

        XCTAssertFalse(result.shouldDismiss)
        XCTAssertEqual(result.context, "No DB mapping found")
    }

    // MARK: - Grouped Notification, All Logged

    func testShouldDismiss_groupedNotificationAllMedsLogged_returnsTrue() throws {
        let today = DateFormatting.dateString(from: Date())
        let mapping1 = makeMapping(
            notificationId: "notif-group",
            medicationId: "med-1",
            scheduleId: "sched-1",
            isGrouped: true,
            groupKey: "08:00_reminder",
            date: today
        )
        let mapping2 = makeMapping(
            id: "map-2",
            notificationId: "notif-group",
            medicationId: "med-2",
            scheduleId: "sched-2",
            isGrouped: true,
            groupKey: "08:00_reminder",
            date: today
        )
        mockScheduledNotificationRepo.notifications = [mapping1, mapping2]

        // Both meds have been logged today
        let med1 = TestFixtures.makeMedication(id: "med-1", name: "Med A")
        let med2 = TestFixtures.makeMedication(id: "med-2", name: "Med B")
        mockMedicationRepo.medications = [med1, med2]

        let now = TimestampHelper.now
        let dose1 = TestFixtures.makeDose(medicationId: "med-1", timestamp: now, status: .taken)
        let dose2 = TestFixtures.makeDose(medicationId: "med-2", timestamp: now, status: .taken)
        mockMedicationRepo.doses = [dose1, dose2]

        let result = try sut.shouldDismissNotification(
            notificationId: "notif-group",
            targetMedicationId: "med-1",
            targetScheduleId: "sched-1"
        )

        XCTAssertTrue(result.shouldDismiss)
        XCTAssertEqual(result.context, "All grouped medications logged")
    }

    // MARK: - Grouped Notification, Not All Logged

    func testShouldDismiss_groupedNotificationNotAllMedsLogged_returnsFalse() throws {
        let today = DateFormatting.dateString(from: Date())
        let mapping1 = makeMapping(
            notificationId: "notif-group",
            medicationId: "med-1",
            scheduleId: "sched-1",
            isGrouped: true,
            groupKey: "08:00_reminder",
            date: today
        )
        let mapping2 = makeMapping(
            id: "map-2",
            notificationId: "notif-group",
            medicationId: "med-2",
            scheduleId: "sched-2",
            isGrouped: true,
            groupKey: "08:00_reminder",
            date: today
        )
        mockScheduledNotificationRepo.notifications = [mapping1, mapping2]

        // Only med-1 is logged, med-2 is not
        let med1 = TestFixtures.makeMedication(id: "med-1", name: "Med A")
        let med2 = TestFixtures.makeMedication(id: "med-2", name: "Med B")
        mockMedicationRepo.medications = [med1, med2]

        let now = TimestampHelper.now
        let dose1 = TestFixtures.makeDose(medicationId: "med-1", timestamp: now, status: .taken)
        mockMedicationRepo.doses = [dose1]

        let result = try sut.shouldDismissNotification(
            notificationId: "notif-group",
            targetMedicationId: "med-1",
            targetScheduleId: "sched-1"
        )

        XCTAssertFalse(result.shouldDismiss)
        XCTAssertTrue(result.context.contains("Not all medications"))
    }

    // MARK: - DB Error (Fail-Safe)

    func testShouldDismiss_dbError_returnsFalse() throws {
        mockScheduledNotificationRepo.errorToThrow = TestError.mockError("DB failure")

        let result = try sut.shouldDismissNotification(
            notificationId: "notif-1",
            targetMedicationId: "med-1",
            targetScheduleId: "sched-1"
        )

        XCTAssertFalse(result.shouldDismiss)
        XCTAssertEqual(result.context, "DB lookup failed")
    }

    // MARK: - Medication Not In Notification

    func testShouldDismiss_medicationNotInNotification_returnsFalse() throws {
        let mapping = makeMapping(
            notificationId: "notif-1",
            medicationId: "med-1",
            scheduleId: "sched-1",
            isGrouped: false
        )
        mockScheduledNotificationRepo.notifications = [mapping]

        let result = try sut.shouldDismissNotification(
            notificationId: "notif-1",
            targetMedicationId: "med-999",  // different med
            targetScheduleId: "sched-1"
        )

        XCTAssertFalse(result.shouldDismiss)
        XCTAssertEqual(result.context, "No matching medication in notification")
    }

    // MARK: - Helpers

    private func makeMapping(
        id: String = "map-1",
        notificationId: String,
        medicationId: String,
        scheduleId: String,
        isGrouped: Bool,
        groupKey: String? = nil,
        date: String? = nil
    ) -> ScheduledNotification {
        ScheduledNotification(
            id: id,
            medicationId: medicationId,
            scheduleId: scheduleId,
            date: date ?? DateFormatting.dateString(from: Date()),
            notificationId: notificationId,
            notificationType: .reminder,
            isGrouped: isGrouped,
            groupKey: groupKey,
            sourceType: .medication,
            medicationName: "Test Med",
            scheduledTriggerTime: "08:00",
            notificationTitle: "Medication Reminder",
            notificationBody: "Time to take Test Med",
            categoryIdentifier: isGrouped ? NotificationCategory.multipleMedication : NotificationCategory.medication,
            createdAt: TimestampHelper.now
        )
    }
}
