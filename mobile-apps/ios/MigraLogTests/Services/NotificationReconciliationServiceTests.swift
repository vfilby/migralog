import XCTest
import UserNotifications
@testable import MigraLog

final class NotificationReconciliationServiceTests: XCTestCase {
    private var sut: NotificationReconciliationService!
    private var mockNotificationService: MockNotificationService!
    private var mockScheduledNotificationRepo: MockScheduledNotificationRepository!

    override func setUp() {
        super.setUp()
        mockNotificationService = MockNotificationService()
        mockScheduledNotificationRepo = MockScheduledNotificationRepository()
        sut = NotificationReconciliationService(
            notificationService: mockNotificationService,
            scheduledNotificationRepo: mockScheduledNotificationRepo
        )
    }

    override func tearDown() {
        sut = nil
        mockNotificationService = nil
        mockScheduledNotificationRepo = nil
        super.tearDown()
    }

    // MARK: - Orphaned DB Mappings

    func testReconcile_orphanedDbMapping_getsDeleted() async {
        // DB has a mapping whose notificationId is NOT in OS pending
        let today = DateFormatting.dateString(from: Date())
        let mapping = makeMapping(id: "map-1", notificationId: "os-notif-1", date: today)
        mockScheduledNotificationRepo.notifications = [mapping]
        // OS has no pending notifications
        mockNotificationService.pendingRequests = []

        await sut.reconcile()

        // The orphaned DB mapping should be deleted
        XCTAssertTrue(mockScheduledNotificationRepo.notifications.isEmpty,
                       "Orphaned DB mapping should be removed")
    }

    // MARK: - Orphaned OS Notifications

    func testReconcile_orphanedOsNotification_getsCancelled() async {
        // OS has a medication notification not in DB
        let request = makePendingRequest(
            id: "os-notif-orphan",
            userInfo: ["medicationId": "med-1", "scheduleId": "sched-1"]
        )
        mockNotificationService.pendingRequests = [request]
        // DB is empty
        mockScheduledNotificationRepo.notifications = []

        await sut.reconcile()

        XCTAssertTrue(mockNotificationService.cancelledIds.contains("os-notif-orphan"),
                       "Orphaned OS notification should be cancelled")
    }

    func testReconcile_orphanedOsGroupedNotification_getsCancelled() async {
        let request = makePendingRequest(
            id: "os-grouped-orphan",
            userInfo: ["medicationIds": ["med-1", "med-2"], "scheduleIds": ["s1", "s2"]]
        )
        mockNotificationService.pendingRequests = [request]
        mockScheduledNotificationRepo.notifications = []

        await sut.reconcile()

        XCTAssertTrue(mockNotificationService.cancelledIds.contains("os-grouped-orphan"))
    }

    func testReconcile_nonMedicationOsNotification_isNotCancelled() async {
        // OS notification that is NOT medication-related should be left alone
        let request = makePendingRequest(id: "daily-checkin-1", userInfo: ["type": "dailyCheckin"])
        mockNotificationService.pendingRequests = [request]
        mockScheduledNotificationRepo.notifications = []

        await sut.reconcile()

        XCTAssertFalse(mockNotificationService.cancelledIds.contains("daily-checkin-1"),
                        "Non-medication OS notification should not be cancelled")
    }

    // MARK: - Past-Date Cleanup

    func testReconcile_pastDateMappings_getCleaned() async {
        let pastDate = "2020-01-01"
        let pastMapping = makeMapping(id: "map-old", notificationId: "os-old", date: pastDate)
        mockScheduledNotificationRepo.notifications = [pastMapping]
        mockNotificationService.pendingRequests = []

        await sut.reconcile()

        // Both orphan cleanup and past-date cleanup should remove it
        XCTAssertTrue(mockScheduledNotificationRepo.notifications.isEmpty)
    }

    // MARK: - Consistent State

    func testReconcile_consistentState_noChanges() async {
        let today = DateFormatting.dateString(from: Date())
        let mapping = makeMapping(id: "map-1", notificationId: "os-1", date: today)
        mockScheduledNotificationRepo.notifications = [mapping]

        let request = makePendingRequest(
            id: "os-1",
            userInfo: ["medicationId": "med-1", "scheduleId": "sched-1"]
        )
        mockNotificationService.pendingRequests = [request]

        await sut.reconcile()

        // DB mapping should still exist (not orphaned)
        XCTAssertEqual(mockScheduledNotificationRepo.notifications.count, 1)
        // OS notification should not be cancelled
        XCTAssertTrue(mockNotificationService.cancelledIds.isEmpty)
    }

    // MARK: - Helpers

    private func makeMapping(
        id: String,
        notificationId: String,
        date: String,
        medicationId: String = "med-1",
        scheduleId: String = "sched-1"
    ) -> ScheduledNotification {
        ScheduledNotification(
            id: id,
            medicationId: medicationId,
            scheduleId: scheduleId,
            date: date,
            notificationId: notificationId,
            notificationType: .reminder,
            isGrouped: false,
            groupKey: nil,
            sourceType: .medication,
            medicationName: "Test Med",
            scheduledTriggerTime: "08:00",
            notificationTitle: "Medication Reminder",
            notificationBody: "Time to take Test Med",
            categoryIdentifier: NotificationCategory.medication,
            createdAt: TimestampHelper.now
        )
    }

    private func makePendingRequest(id: String, userInfo: [String: Any]) -> UNNotificationRequest {
        let content = UNMutableNotificationContent()
        content.userInfo = userInfo
        return UNNotificationRequest(identifier: id, content: content, trigger: nil)
    }
}
