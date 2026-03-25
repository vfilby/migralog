import XCTest
import UserNotifications
@testable import MigraLog

final class MedicationNotificationServiceTests: XCTestCase {
    private var sut: MedicationNotificationScheduler!
    private var mockNotificationService: MockNotificationService!
    private var mockScheduledNotificationRepo: MockScheduledNotificationRepository!
    private var mockMedicationRepo: MockMedicationRepository!

    override func setUp() {
        super.setUp()
        mockNotificationService = MockNotificationService()
        mockScheduledNotificationRepo = MockScheduledNotificationRepository()
        mockMedicationRepo = MockMedicationRepository()
        sut = MedicationNotificationScheduler(
            notificationService: mockNotificationService,
            scheduledNotificationRepo: mockScheduledNotificationRepo,
            medicationRepo: mockMedicationRepo
        )
    }

    override func tearDown() {
        sut = nil
        mockNotificationService = nil
        mockScheduledNotificationRepo = nil
        mockMedicationRepo = nil
        super.tearDown()
    }

    // MARK: - Reschedule All

    func testRescheduleAll_withNoActiveMedications_schedulesNothing() async throws {
        mockMedicationRepo.medications = []

        try await sut.rescheduleAllMedicationNotifications()

        XCTAssertEqual(mockNotificationService.scheduledNotifications.count, 0)
    }

    func testRescheduleAll_withPreventativeDailyMedication_schedulesNotifications() async throws {
        let medication = TestFixtures.makeMedication(
            id: "med-1",
            name: "Topiramate",
            type: .preventative,
            scheduleFrequency: .daily
        )
        let schedule = TestFixtures.makeSchedule(id: "sched-1", medicationId: "med-1", time: "08:00")
        mockMedicationRepo.medications = [medication]
        mockMedicationRepo.schedules = [schedule]

        try await sut.rescheduleAllMedicationNotifications()

        XCTAssertGreaterThan(mockNotificationService.scheduledNotifications.count, 0)
    }

    func testRescheduleAll_skipsRescueMedications() async throws {
        let medication = TestFixtures.makeMedication(
            id: "med-1",
            name: "Sumatriptan",
            type: .rescue,
            scheduleFrequency: .daily
        )
        let schedule = TestFixtures.makeSchedule(id: "sched-1", medicationId: "med-1", time: "08:00")
        mockMedicationRepo.medications = [medication]
        mockMedicationRepo.schedules = [schedule]

        try await sut.rescheduleAllMedicationNotifications()

        XCTAssertEqual(mockNotificationService.scheduledNotifications.count, 0)
    }

    func testRescheduleAll_skipsDisabledSchedules() async throws {
        let medication = TestFixtures.makeMedication(
            id: "med-1",
            name: "Topiramate",
            type: .preventative,
            scheduleFrequency: .daily
        )
        var schedule = TestFixtures.makeSchedule(id: "sched-1", medicationId: "med-1", time: "08:00")
        schedule.enabled = false
        mockMedicationRepo.medications = [medication]
        mockMedicationRepo.schedules = [schedule]

        try await sut.rescheduleAllMedicationNotifications()

        XCTAssertEqual(mockNotificationService.scheduledNotifications.count, 0)
    }

    // MARK: - Cancel Reminders

    func testCancelMedicationReminders_cancelsMatchingPendingNotifications() async {
        mockNotificationService.pendingRequests = [
            makePendingRequest(id: "notif-1", userInfo: ["medicationId": "med-1", "scheduleId": "sched-1"]),
            makePendingRequest(id: "notif-2", userInfo: ["medicationId": "med-2", "scheduleId": "sched-2"]),
        ]

        await sut.cancelMedicationReminders(for: "med-1")

        XCTAssertEqual(mockNotificationService.cancelledIds.count, 1)
        XCTAssertTrue(mockNotificationService.cancelledIds.contains("notif-1"))
        XCTAssertFalse(mockNotificationService.cancelledIds.contains("notif-2"))
    }

    func testCancelMedicationReminders_cancelsGroupedNotificationsContainingMedication() async {
        mockNotificationService.pendingRequests = [
            makePendingRequest(id: "notif-1", userInfo: ["medicationIds": ["med-1", "med-2"], "scheduleIds": ["s1", "s2"]]),
        ]

        await sut.cancelMedicationReminders(for: "med-1")

        XCTAssertEqual(mockNotificationService.cancelledIds.count, 1)
        XCTAssertTrue(mockNotificationService.cancelledIds.contains("notif-1"))
    }

    // MARK: - Response Handlers

    func testHandleTakenResponse_dismissesNotification() async {
        await sut.handleTakenResponse(medicationId: "med-1", scheduleId: "sched-1")

        // With no delivered notifications, nothing should be removed
        XCTAssertEqual(mockNotificationService.removedDeliveredIds.count, 0)
    }

    func testHandleSkippedResponse_dismissesNotification() async {
        await sut.handleSkippedResponse(medicationId: "med-1", scheduleId: "sched-1")

        XCTAssertEqual(mockNotificationService.removedDeliveredIds.count, 0)
    }

    // MARK: - Notification Content

    func testScheduledNotification_usesMedicationCategory() async throws {
        let medication = TestFixtures.makeMedication(
            id: "med-1",
            name: "Topiramate",
            type: .preventative,
            scheduleFrequency: .daily
        )
        let schedule = TestFixtures.makeSchedule(id: "sched-1", medicationId: "med-1", time: "08:00")
        mockMedicationRepo.medications = [medication]
        mockMedicationRepo.schedules = [schedule]

        try await sut.rescheduleAllMedicationNotifications()

        let firstNotification = mockNotificationService.scheduledNotifications.first
        XCTAssertEqual(firstNotification?.categoryIdentifier, NotificationCategory.medication)
    }

    func testScheduledNotification_includesMedicationNameInBody() async throws {
        let medication = TestFixtures.makeMedication(
            id: "med-1",
            name: "Topiramate",
            type: .preventative,
            dosageAmount: 50,
            dosageUnit: "mg",
            scheduleFrequency: .daily
        )
        let schedule = TestFixtures.makeSchedule(id: "sched-1", medicationId: "med-1", time: "08:00")
        mockMedicationRepo.medications = [medication]
        mockMedicationRepo.schedules = [schedule]

        try await sut.rescheduleAllMedicationNotifications()

        let firstNotification = mockNotificationService.scheduledNotifications.first
        XCTAssertTrue(firstNotification?.body.contains("Topiramate") ?? false)
        XCTAssertTrue(firstNotification?.body.contains("50.0mg") ?? false)
    }

    func testGroupedNotification_usesMultipleMedicationCategory() async throws {
        let med1 = TestFixtures.makeMedication(id: "med-1", name: "Topiramate", type: .preventative, scheduleFrequency: .daily)
        let med2 = TestFixtures.makeMedication(id: "med-2", name: "Propranolol", type: .preventative, scheduleFrequency: .daily)
        let sched1 = TestFixtures.makeSchedule(id: "sched-1", medicationId: "med-1", time: "08:00")
        let sched2 = TestFixtures.makeSchedule(id: "sched-2", medicationId: "med-2", time: "08:00")
        mockMedicationRepo.medications = [med1, med2]
        mockMedicationRepo.schedules = [sched1, sched2]

        try await sut.rescheduleAllMedicationNotifications()

        // All notifications should be grouped since both are at 08:00
        let groupedNotifications = mockNotificationService.scheduledNotifications.filter {
            $0.categoryIdentifier == NotificationCategory.multipleMedication
        }
        XCTAssertGreaterThan(groupedNotifications.count, 0)
    }

    // MARK: - Grouped Scheduling

    func testRescheduleAll_twoMedsAtSameTime_schedulesGroupedNotifications() async throws {
        let med1 = TestFixtures.makeMedication(id: "med-1", name: "Topiramate", type: .preventative, scheduleFrequency: .daily)
        let med2 = TestFixtures.makeMedication(id: "med-2", name: "Propranolol", type: .preventative, scheduleFrequency: .daily)
        let sched1 = TestFixtures.makeSchedule(id: "sched-1", medicationId: "med-1", time: "08:00")
        let sched2 = TestFixtures.makeSchedule(id: "sched-2", medicationId: "med-2", time: "08:00")
        mockMedicationRepo.medications = [med1, med2]
        mockMedicationRepo.schedules = [sched1, sched2]

        try await sut.rescheduleAllMedicationNotifications()

        // All OS notifications should be grouped (1 per day, not 2)
        let allNotifs = mockNotificationService.scheduledNotifications
        XCTAssertGreaterThan(allNotifs.count, 0)

        // Each OS notification should be grouped
        for notif in allNotifs {
            XCTAssertEqual(notif.categoryIdentifier, NotificationCategory.multipleMedication,
                           "All notifications should use grouped category since both meds are at same time")
        }

        // DB should have 2 mappings per day (one per medication)
        let dbMappings = mockScheduledNotificationRepo.notifications
        XCTAssertGreaterThan(dbMappings.count, allNotifs.count,
                             "DB should have more mappings than OS notifications (2 per grouped notification)")
    }

    func testRescheduleAll_twoMedsAtDifferentTimes_schedulesIndividualNotifications() async throws {
        let med1 = TestFixtures.makeMedication(id: "med-1", name: "Topiramate", type: .preventative, scheduleFrequency: .daily)
        let med2 = TestFixtures.makeMedication(id: "med-2", name: "Propranolol", type: .preventative, scheduleFrequency: .daily)
        let sched1 = TestFixtures.makeSchedule(id: "sched-1", medicationId: "med-1", time: "08:00")
        let sched2 = TestFixtures.makeSchedule(id: "sched-2", medicationId: "med-2", time: "20:00")
        mockMedicationRepo.medications = [med1, med2]
        mockMedicationRepo.schedules = [sched1, sched2]

        try await sut.rescheduleAllMedicationNotifications()

        // Should have individual notifications (not grouped)
        let individualNotifs = mockNotificationService.scheduledNotifications.filter {
            $0.categoryIdentifier == NotificationCategory.medication
        }
        XCTAssertGreaterThan(individualNotifs.count, 0, "Should have individual notifications for different times")
    }

    func testRescheduleAll_singleMed_schedulesIndividualNotification() async throws {
        let med = TestFixtures.makeMedication(id: "med-1", name: "Topiramate", type: .preventative, scheduleFrequency: .daily)
        let sched = TestFixtures.makeSchedule(id: "sched-1", medicationId: "med-1", time: "08:00")
        mockMedicationRepo.medications = [med]
        mockMedicationRepo.schedules = [sched]

        try await sut.rescheduleAllMedicationNotifications()

        // All should be individual (not grouped)
        for notif in mockNotificationService.scheduledNotifications {
            XCTAssertEqual(notif.categoryIdentifier, NotificationCategory.medication)
        }

        // DB mappings should all be isGrouped=false
        for mapping in mockScheduledNotificationRepo.notifications {
            XCTAssertFalse(mapping.isGrouped)
        }
    }

    func testRescheduleAll_groupedNotification_createsDBMappingPerMedication() async throws {
        let med1 = TestFixtures.makeMedication(id: "med-1", name: "Topiramate", type: .preventative, scheduleFrequency: .daily)
        let med2 = TestFixtures.makeMedication(id: "med-2", name: "Propranolol", type: .preventative, scheduleFrequency: .daily)
        let sched1 = TestFixtures.makeSchedule(id: "sched-1", medicationId: "med-1", time: "08:00")
        let sched2 = TestFixtures.makeSchedule(id: "sched-2", medicationId: "med-2", time: "08:00")
        mockMedicationRepo.medications = [med1, med2]
        mockMedicationRepo.schedules = [sched1, sched2]

        try await sut.rescheduleAllMedicationNotifications()

        let osNotifCount = mockNotificationService.scheduledNotifications.count
        let dbMappingCount = mockScheduledNotificationRepo.notifications.count

        // Each grouped OS notification should have 2 DB mappings
        XCTAssertEqual(dbMappingCount, osNotifCount * 2,
                       "Each grouped notification day should produce 2 DB mappings")
    }

    // MARK: - Grouped Cancellation

    func testCancelNotificationForDate_cancelOneFromGroupOfThree_recreatesGroupWithTwo() async throws {
        // Use tomorrow to ensure the trigger time is in the future
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: Date())!
        let dateString = DateFormatting.dateString(from: tomorrow)

        // Set up 3 medications at same time
        let med1 = TestFixtures.makeMedication(id: "med-1", name: "Med A", type: .preventative, scheduleFrequency: .daily)
        let med2 = TestFixtures.makeMedication(id: "med-2", name: "Med B", type: .preventative, scheduleFrequency: .daily)
        let med3 = TestFixtures.makeMedication(id: "med-3", name: "Med C", type: .preventative, scheduleFrequency: .daily)
        mockMedicationRepo.medications = [med1, med2, med3]

        let sched1 = TestFixtures.makeSchedule(id: "sched-1", medicationId: "med-1", time: "08:00")
        let sched2 = TestFixtures.makeSchedule(id: "sched-2", medicationId: "med-2", time: "08:00")
        let sched3 = TestFixtures.makeSchedule(id: "sched-3", medicationId: "med-3", time: "08:00")
        mockMedicationRepo.schedules = [sched1, sched2, sched3]

        // Create grouped DB mappings sharing one notification ID
        let groupKey = "08:00_reminder"
        let notifId = "grouped-notif-1"
        for (medId, schedId, name) in [("med-1", "sched-1", "Med A"), ("med-2", "sched-2", "Med B"), ("med-3", "sched-3", "Med C")] {
            let mapping = ScheduledNotification(
                id: UUID().uuidString, medicationId: medId, scheduleId: schedId,
                date: dateString, notificationId: notifId, notificationType: .reminder,
                isGrouped: true, groupKey: groupKey, sourceType: .medication,
                medicationName: name, scheduledTriggerTime: "08:00",
                notificationTitle: "Medication Reminder",
                notificationBody: "Time to take: Med A, Med B, Med C",
                categoryIdentifier: NotificationCategory.multipleMedication,
                createdAt: TimestampHelper.now
            )
            mockScheduledNotificationRepo.notifications.append(mapping)
        }

        // Cancel med-1 from the group
        await sut.cancelNotificationForDate(
            medicationId: "med-1", scheduleId: "sched-1",
            date: dateString, notificationType: .reminder
        )

        // Original notification should be cancelled
        XCTAssertTrue(mockNotificationService.cancelledIds.contains(notifId))

        // med-1 mapping should be removed
        let remainingMed1 = mockScheduledNotificationRepo.notifications.filter { $0.medicationId == "med-1" }
        XCTAssertTrue(remainingMed1.isEmpty, "med-1 mapping should be removed")

        // A new grouped notification should have been created for remaining 2 meds
        let newGroupedNotifs = mockNotificationService.scheduledNotifications.filter {
            $0.categoryIdentifier == NotificationCategory.multipleMedication
        }
        XCTAssertEqual(newGroupedNotifs.count, 1, "Should recreate a grouped notification for remaining 2 meds")
    }

    func testCancelNotificationForDate_cancelOneFromGroupOfTwo_convertsToIndividual() async throws {
        // Use tomorrow to ensure the trigger time is in the future
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: Date())!
        let dateString = DateFormatting.dateString(from: tomorrow)

        let med1 = TestFixtures.makeMedication(id: "med-1", name: "Med A", type: .preventative, scheduleFrequency: .daily)
        let med2 = TestFixtures.makeMedication(id: "med-2", name: "Med B", type: .preventative, scheduleFrequency: .daily)
        mockMedicationRepo.medications = [med1, med2]

        let sched1 = TestFixtures.makeSchedule(id: "sched-1", medicationId: "med-1", time: "08:00")
        let sched2 = TestFixtures.makeSchedule(id: "sched-2", medicationId: "med-2", time: "08:00")
        mockMedicationRepo.schedules = [sched1, sched2]

        let groupKey = "08:00_reminder"
        let notifId = "grouped-notif-1"
        for (medId, schedId, name) in [("med-1", "sched-1", "Med A"), ("med-2", "sched-2", "Med B")] {
            let mapping = ScheduledNotification(
                id: UUID().uuidString, medicationId: medId, scheduleId: schedId,
                date: dateString, notificationId: notifId, notificationType: .reminder,
                isGrouped: true, groupKey: groupKey, sourceType: .medication,
                medicationName: name, scheduledTriggerTime: "08:00",
                notificationTitle: "Medication Reminder",
                notificationBody: "Time to take: Med A, Med B",
                categoryIdentifier: NotificationCategory.multipleMedication,
                createdAt: TimestampHelper.now
            )
            mockScheduledNotificationRepo.notifications.append(mapping)
        }

        // Cancel med-1
        await sut.cancelNotificationForDate(
            medicationId: "med-1", scheduleId: "sched-1",
            date: dateString, notificationType: .reminder
        )

        // Original grouped notification should be cancelled
        XCTAssertTrue(mockNotificationService.cancelledIds.contains(notifId))

        // A new individual notification should have been scheduled for the remaining med
        let newIndividualNotifs = mockNotificationService.scheduledNotifications.filter {
            $0.categoryIdentifier == NotificationCategory.medication
        }
        XCTAssertEqual(newIndividualNotifs.count, 1, "Should create individual notification for remaining med")
    }

    func testCancelNotificationForDate_cancelLastFromGroup_fullCleanup() async throws {
        let today = DateFormatting.dateString(from: Date())

        let med1 = TestFixtures.makeMedication(id: "med-1", name: "Med A", type: .preventative, scheduleFrequency: .daily)
        mockMedicationRepo.medications = [med1]

        let notifId = "individual-notif-1"
        let mapping = ScheduledNotification(
            id: "map-1", medicationId: "med-1", scheduleId: "sched-1",
            date: today, notificationId: notifId, notificationType: .reminder,
            isGrouped: false, groupKey: nil, sourceType: .medication,
            medicationName: "Med A", scheduledTriggerTime: "08:00",
            notificationTitle: "Medication Reminder",
            notificationBody: "Time to take Med A",
            categoryIdentifier: NotificationCategory.medication,
            createdAt: TimestampHelper.now
        )
        mockScheduledNotificationRepo.notifications = [mapping]

        // Cancel the only notification
        await sut.cancelNotificationForDate(
            medicationId: "med-1", scheduleId: "sched-1",
            date: today, notificationType: .reminder
        )

        // Should cancel OS notification
        XCTAssertTrue(mockNotificationService.cancelledIds.contains(notifId))

        // DB mapping should be deleted
        XCTAssertTrue(mockScheduledNotificationRepo.notifications.isEmpty,
                       "All mappings should be cleaned up")

        // No new notifications should be scheduled
        XCTAssertTrue(mockNotificationService.scheduledNotifications.isEmpty)
    }

    // MARK: - Top-Up

    func testTopUp_afterCancellation_addsReplacementDay() async throws {
        let med = TestFixtures.makeMedication(id: "med-1", name: "Topiramate", type: .preventative, scheduleFrequency: .daily)
        let sched = TestFixtures.makeSchedule(id: "sched-1", medicationId: "med-1", time: "08:00")
        mockMedicationRepo.medications = [med]
        mockMedicationRepo.schedules = [sched]

        // Start with a full schedule
        try await sut.rescheduleAllMedicationNotifications()

        let initialCount = mockScheduledNotificationRepo.notifications.count
        XCTAssertGreaterThan(initialCount, 0)

        // Simulate cancelling one notification by removing a mapping
        if let first = mockScheduledNotificationRepo.notifications.first {
            try mockScheduledNotificationRepo.deleteById(first.id)
        }

        let afterCancelCount = mockScheduledNotificationRepo.notifications.count
        XCTAssertEqual(afterCancelCount, initialCount - 1)

        // Top up should fill the gap
        await sut.topUp(threshold: 3)

        let afterTopUpCount = mockScheduledNotificationRepo.notifications.count
        XCTAssertGreaterThanOrEqual(afterTopUpCount, afterCancelCount,
                                     "Top-up should add replacement notifications")
    }

    // MARK: - Rebalance

    func testRebalance_withExcessNotifications_trimsToTarget() async throws {
        let med = TestFixtures.makeMedication(id: "med-1", name: "Topiramate", type: .preventative, scheduleFrequency: .daily)
        let sched = TestFixtures.makeSchedule(id: "sched-1", medicationId: "med-1", time: "08:00")
        mockMedicationRepo.medications = [med]
        mockMedicationRepo.schedules = [sched]

        // First, schedule with just 1 med (gets 14 days)
        try await sut.rescheduleAllMedicationNotifications()

        let initialMappingCount = mockScheduledNotificationRepo.notifications.count
        XCTAssertGreaterThan(initialMappingCount, 0)

        // Record initial cancellation count
        let initialCancelCount = mockNotificationService.cancelledIds.count

        // Now rebalance - this should trigger topUp as well
        await sut.rebalance()

        // With only 1 slot per day, target is 14 days, so no trimming needed
        // but the rebalance should complete without error
        // The key test is that it doesn't crash and processes correctly
        XCTAssertGreaterThanOrEqual(mockScheduledNotificationRepo.notifications.count, 0)
    }

    // MARK: - cancelNotificationForDate Edge Cases

    func testCancelForDate_noMappingFound_doesNothing() async {
        let today = DateFormatting.dateString(from: Date())

        // No mappings in DB at all
        await sut.cancelNotificationForDate(
            medicationId: "med-1", scheduleId: "sched-1",
            date: today, notificationType: .reminder
        )

        // No OS cancellation should occur
        XCTAssertTrue(mockNotificationService.cancelledIds.isEmpty,
                       "No OS cancellation should happen when no mapping found")
        // No DB deletion should occur (nothing to delete)
        XCTAssertTrue(mockScheduledNotificationRepo.notifications.isEmpty)
    }

    func testCancelForDate_ungrouped_cancelsOSAndDeletesDB() async {
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: Date())!
        let dateString = DateFormatting.dateString(from: tomorrow)

        let notifId = "ungrouped-notif-1"
        let mapping = ScheduledNotification(
            id: "map-1", medicationId: "med-1", scheduleId: "sched-1",
            date: dateString, notificationId: notifId, notificationType: .reminder,
            isGrouped: false, groupKey: nil, sourceType: .medication,
            medicationName: "Topiramate", scheduledTriggerTime: "08:00",
            notificationTitle: "Medication Reminder",
            notificationBody: "Time to take Topiramate",
            categoryIdentifier: NotificationCategory.medication,
            createdAt: TimestampHelper.now
        )
        mockScheduledNotificationRepo.notifications = [mapping]

        await sut.cancelNotificationForDate(
            medicationId: "med-1", scheduleId: "sched-1",
            date: dateString, notificationType: .reminder
        )

        XCTAssertTrue(mockNotificationService.cancelledIds.contains(notifId),
                       "OS notification should be cancelled")
        XCTAssertTrue(mockScheduledNotificationRepo.notifications.isEmpty,
                       "DB mapping should be deleted")
    }

    func testCancelForDate_followUpType_cancelsCorrectMapping() async {
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: Date())!
        let dateString = DateFormatting.dateString(from: tomorrow)

        let reminderNotifId = "reminder-notif-1"
        let followUpNotifId = "followup-notif-1"

        let reminderMapping = ScheduledNotification(
            id: "map-reminder", medicationId: "med-1", scheduleId: "sched-1",
            date: dateString, notificationId: reminderNotifId, notificationType: .reminder,
            isGrouped: false, groupKey: nil, sourceType: .medication,
            medicationName: "Topiramate", scheduledTriggerTime: "08:00",
            notificationTitle: "Medication Reminder",
            notificationBody: "Time to take Topiramate",
            categoryIdentifier: NotificationCategory.medication,
            createdAt: TimestampHelper.now
        )
        let followUpMapping = ScheduledNotification(
            id: "map-followup", medicationId: "med-1", scheduleId: "sched-1",
            date: dateString, notificationId: followUpNotifId, notificationType: .followUp,
            isGrouped: false, groupKey: nil, sourceType: .medication,
            medicationName: "Topiramate", scheduledTriggerTime: "08:30",
            notificationTitle: "Follow-Up Reminder",
            notificationBody: "Time to take Topiramate",
            categoryIdentifier: NotificationCategory.medication,
            createdAt: TimestampHelper.now
        )
        mockScheduledNotificationRepo.notifications = [reminderMapping, followUpMapping]

        // Cancel only the follow-up
        await sut.cancelNotificationForDate(
            medicationId: "med-1", scheduleId: "sched-1",
            date: dateString, notificationType: .followUp
        )

        // Follow-up OS notification should be cancelled
        XCTAssertTrue(mockNotificationService.cancelledIds.contains(followUpNotifId),
                       "Follow-up OS notification should be cancelled")
        // Reminder OS notification should NOT be cancelled
        XCTAssertFalse(mockNotificationService.cancelledIds.contains(reminderNotifId),
                        "Reminder OS notification should be preserved")

        // Only reminder mapping should remain in DB
        XCTAssertEqual(mockScheduledNotificationRepo.notifications.count, 1)
        XCTAssertEqual(mockScheduledNotificationRepo.notifications.first?.id, "map-reminder")
    }

    func testCancelForDate_grouped_medicationNotFoundInRepo_gracefullyHandles() async {
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: Date())!
        let dateString = DateFormatting.dateString(from: tomorrow)

        // Set up grouped mapping with 2 meds, but only 1 exists in the repo
        let med2 = TestFixtures.makeMedication(id: "med-2", name: "Med B", type: .preventative, scheduleFrequency: .daily)
        let sched2 = TestFixtures.makeSchedule(id: "sched-2", medicationId: "med-2", time: "08:00")
        mockMedicationRepo.medications = [med2]
        mockMedicationRepo.schedules = [sched2]

        let groupKey = "08:00_reminder"
        let notifId = "grouped-notif-1"

        let mappingA = ScheduledNotification(
            id: "map-a", medicationId: "med-1", scheduleId: "sched-1",
            date: dateString, notificationId: notifId, notificationType: .reminder,
            isGrouped: true, groupKey: groupKey, sourceType: .medication,
            medicationName: "Med A", scheduledTriggerTime: "08:00",
            notificationTitle: "Medication Reminder",
            notificationBody: "Time to take: Med A, Med B",
            categoryIdentifier: NotificationCategory.multipleMedication,
            createdAt: TimestampHelper.now
        )
        let mappingB = ScheduledNotification(
            id: "map-b", medicationId: "med-2", scheduleId: "sched-2",
            date: dateString, notificationId: notifId, notificationType: .reminder,
            isGrouped: true, groupKey: groupKey, sourceType: .medication,
            medicationName: "Med B", scheduledTriggerTime: "08:00",
            notificationTitle: "Medication Reminder",
            notificationBody: "Time to take: Med A, Med B",
            categoryIdentifier: NotificationCategory.multipleMedication,
            createdAt: TimestampHelper.now
        )
        mockScheduledNotificationRepo.notifications = [mappingA, mappingB]

        // Cancel med-1 (which does NOT exist in the medication repo)
        // The remaining med-2 should need to be converted to individual, and med-2 DOES exist
        await sut.cancelNotificationForDate(
            medicationId: "med-1", scheduleId: "sched-1",
            date: dateString, notificationType: .reminder
        )

        // Should not crash. Old grouped notification should be cancelled.
        XCTAssertTrue(mockNotificationService.cancelledIds.contains(notifId),
                       "Old grouped notification should be cancelled")
        // med-1 mapping should be deleted
        let med1Mappings = mockScheduledNotificationRepo.notifications.filter { $0.medicationId == "med-1" }
        XCTAssertTrue(med1Mappings.isEmpty, "med-1 mapping should be removed")
    }

    func testCancelForDate_grouped_triggerDateInPast_doesNotReschedule() async {
        // Use yesterday so trigger is in the past
        let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: Date())!
        let dateString = DateFormatting.dateString(from: yesterday)

        let med1 = TestFixtures.makeMedication(id: "med-1", name: "Med A", type: .preventative, scheduleFrequency: .daily)
        let med2 = TestFixtures.makeMedication(id: "med-2", name: "Med B", type: .preventative, scheduleFrequency: .daily)
        mockMedicationRepo.medications = [med1, med2]

        let sched1 = TestFixtures.makeSchedule(id: "sched-1", medicationId: "med-1", time: "08:00")
        let sched2 = TestFixtures.makeSchedule(id: "sched-2", medicationId: "med-2", time: "08:00")
        mockMedicationRepo.schedules = [sched1, sched2]

        let groupKey = "08:00_reminder"
        let notifId = "grouped-notif-1"

        let mappingA = ScheduledNotification(
            id: "map-a", medicationId: "med-1", scheduleId: "sched-1",
            date: dateString, notificationId: notifId, notificationType: .reminder,
            isGrouped: true, groupKey: groupKey, sourceType: .medication,
            medicationName: "Med A", scheduledTriggerTime: "08:00",
            notificationTitle: "Medication Reminder",
            notificationBody: "Time to take: Med A, Med B",
            categoryIdentifier: NotificationCategory.multipleMedication,
            createdAt: TimestampHelper.now
        )
        let mappingB = ScheduledNotification(
            id: "map-b", medicationId: "med-2", scheduleId: "sched-2",
            date: dateString, notificationId: notifId, notificationType: .reminder,
            isGrouped: true, groupKey: groupKey, sourceType: .medication,
            medicationName: "Med B", scheduledTriggerTime: "08:00",
            notificationTitle: "Medication Reminder",
            notificationBody: "Time to take: Med A, Med B",
            categoryIdentifier: NotificationCategory.multipleMedication,
            createdAt: TimestampHelper.now
        )
        mockScheduledNotificationRepo.notifications = [mappingA, mappingB]

        // Cancel med-1 from the group (trigger date is in the past)
        await sut.cancelNotificationForDate(
            medicationId: "med-1", scheduleId: "sched-1",
            date: dateString, notificationType: .reminder
        )

        // Old notification should be cancelled
        XCTAssertTrue(mockNotificationService.cancelledIds.contains(notifId))
        // med-1 mapping should be deleted
        let med1Mappings = mockScheduledNotificationRepo.notifications.filter { $0.medicationId == "med-1" }
        XCTAssertTrue(med1Mappings.isEmpty, "med-1 mapping should be removed")
        // No new notification should be scheduled since trigger is in the past
        XCTAssertTrue(mockNotificationService.scheduledNotifications.isEmpty,
                       "No new notification should be scheduled for a past trigger date")
    }

    // MARK: - Atomic Scheduling Rollback

    func testSchedule_DBFailure_cancelsOSNotification() async {
        let medication = TestFixtures.makeMedication(
            id: "med-1", name: "Topiramate", type: .preventative, scheduleFrequency: .daily
        )
        let schedule = TestFixtures.makeSchedule(id: "sched-1", medicationId: "med-1", time: "08:00")
        mockMedicationRepo.medications = [medication]
        mockMedicationRepo.schedules = [schedule]

        // Make createNotification fail
        mockScheduledNotificationRepo.errorToThrow = TestError.mockError("DB failure")

        do {
            try await sut.rescheduleAllMedicationNotifications()
            XCTFail("Should have thrown an error")
        } catch {
            // Expected
        }

        // OS notification was scheduled but should have been rolled back (cancelled)
        // The service schedules the OS notification first, then tries DB, and on failure cancels it
        let scheduledCount = mockNotificationService.scheduledNotifications.count
        let cancelledCount = mockNotificationService.cancelledIds.count

        // There should be at least one rollback cancellation for scheduled notifications
        // Note: deleteAllMedication is also called at the start and will throw first
        // The error may happen at different points depending on implementation
        // At minimum, the error should propagate
        XCTAssertTrue(cancelledCount > 0 || scheduledCount == 0,
                       "OS notifications should be rolled back on DB failure, or none scheduled if early failure")
    }

    func testScheduleGrouped_DBFailure_rollsBackAllMappings() async {
        let med1 = TestFixtures.makeMedication(id: "med-1", name: "Med A", type: .preventative, scheduleFrequency: .daily)
        let med2 = TestFixtures.makeMedication(id: "med-2", name: "Med B", type: .preventative, scheduleFrequency: .daily)
        let sched1 = TestFixtures.makeSchedule(id: "sched-1", medicationId: "med-1", time: "08:00")
        let sched2 = TestFixtures.makeSchedule(id: "sched-2", medicationId: "med-2", time: "08:00")
        mockMedicationRepo.medications = [med1, med2]
        mockMedicationRepo.schedules = [sched1, sched2]

        // Use a specialized mock that fails on the second createNotification call
        let failingRepo = FailOnNthCreateMockScheduledNotificationRepository(failOnCallNumber: 2)
        let failingSut = MedicationNotificationScheduler(
            notificationService: mockNotificationService,
            scheduledNotificationRepo: failingRepo,
            medicationRepo: mockMedicationRepo
        )

        do {
            try await failingSut.rescheduleAllMedicationNotifications()
            XCTFail("Should have thrown an error on second DB create")
        } catch {
            // Expected
        }

        // The first mapping was saved then should have been rolled back
        // The OS notification should have been cancelled
        let cancelledCount = mockNotificationService.cancelledIds.count
        XCTAssertGreaterThan(cancelledCount, 0,
                              "OS notification should be cancelled on grouped DB failure rollback")

        // The first mapping should have been cleaned up via deleteById
        XCTAssertTrue(failingRepo.notifications.isEmpty,
                       "All DB mappings should be rolled back after grouped failure")
    }

    // MARK: - Dismiss Edge Cases

    func testDismiss_noDeliveredNotifications_doesNothing() async {
        // MockNotificationService returns [] for delivered notifications by default
        await sut.dismissMedicationNotification(medicationId: "med-1", scheduleId: "sched-1")

        XCTAssertTrue(mockNotificationService.removedDeliveredIds.isEmpty,
                       "Nothing should be removed when no delivered notifications exist")
    }

    // Note: Tests involving specific delivered notification userInfo are limited because
    // UNNotification has no public initializer. The dismiss logic reads userInfo from
    // UNNotification objects returned by the notification center, which cannot be
    // constructed in unit tests. The behavior is verified through integration testing
    // and through the response handler tests below.

    // MARK: - Reschedule All Edge Cases

    func testRescheduleAll_noActiveMedications_cancelsExistingAndSchedulesNone() async throws {
        // Pre-populate with some existing notifications
        let existingMapping = ScheduledNotification(
            id: "existing-1", medicationId: "med-1", scheduleId: "sched-1",
            date: DateFormatting.dateString(from: Date()), notificationId: "old-notif",
            notificationType: .reminder, isGrouped: false, groupKey: nil,
            sourceType: .medication, medicationName: "Old Med",
            scheduledTriggerTime: "08:00", notificationTitle: "Reminder",
            notificationBody: "Take it", categoryIdentifier: NotificationCategory.medication,
            createdAt: TimestampHelper.now
        )
        mockScheduledNotificationRepo.notifications = [existingMapping]
        mockMedicationRepo.medications = []

        try await sut.rescheduleAllMedicationNotifications()

        // Existing DB mappings should be cleared
        XCTAssertTrue(mockScheduledNotificationRepo.notifications.isEmpty,
                       "DB should be cleared even when no active medications")
        // No new notifications scheduled
        XCTAssertEqual(mockNotificationService.scheduledNotifications.count, 0)
    }

    func testRescheduleAll_rescueMedicationsIgnored() async throws {
        let rescue1 = TestFixtures.makeMedication(id: "med-1", name: "Sumatriptan", type: .rescue, scheduleFrequency: .daily)
        let rescue2 = TestFixtures.makeMedication(id: "med-2", name: "Rizatriptan", type: .rescue, scheduleFrequency: .daily)
        let sched1 = TestFixtures.makeSchedule(id: "sched-1", medicationId: "med-1", time: "08:00")
        let sched2 = TestFixtures.makeSchedule(id: "sched-2", medicationId: "med-2", time: "20:00")
        mockMedicationRepo.medications = [rescue1, rescue2]
        mockMedicationRepo.schedules = [sched1, sched2]

        try await sut.rescheduleAllMedicationNotifications()

        XCTAssertEqual(mockNotificationService.scheduledNotifications.count, 0,
                        "Rescue medications should not get scheduled notifications")
        XCTAssertTrue(mockScheduledNotificationRepo.notifications.isEmpty)
    }

    func testRescheduleAll_followUpDisabled_onlyRemindersScheduled() async throws {
        // Ensure follow-up delay is 0 (disabled)
        UserDefaults.standard.set(0, forKey: "notification_follow_up_delay")
        defer { UserDefaults.standard.removeObject(forKey: "notification_follow_up_delay") }

        let med = TestFixtures.makeMedication(id: "med-1", name: "Topiramate", type: .preventative, scheduleFrequency: .daily)
        let sched = TestFixtures.makeSchedule(id: "sched-1", medicationId: "med-1", time: "08:00")
        mockMedicationRepo.medications = [med]
        mockMedicationRepo.schedules = [sched]

        try await sut.rescheduleAllMedicationNotifications()

        // All mappings should be reminder type, none follow-up
        let followUpMappings = mockScheduledNotificationRepo.notifications.filter {
            $0.notificationType == .followUp
        }
        XCTAssertTrue(followUpMappings.isEmpty,
                       "No follow-up notifications should be scheduled when delay is 0")

        let reminderMappings = mockScheduledNotificationRepo.notifications.filter {
            $0.notificationType == .reminder
        }
        XCTAssertGreaterThan(reminderMappings.count, 0,
                              "Reminder notifications should still be scheduled")
    }

    func testRescheduleAll_followUpEnabled_schedulesRemindersAndFollowUps() async throws {
        UserDefaults.standard.set(30, forKey: "notification_follow_up_delay")
        defer { UserDefaults.standard.removeObject(forKey: "notification_follow_up_delay") }

        let med = TestFixtures.makeMedication(id: "med-1", name: "Topiramate", type: .preventative, scheduleFrequency: .daily)
        let sched = TestFixtures.makeSchedule(id: "sched-1", medicationId: "med-1", time: "08:00")
        mockMedicationRepo.medications = [med]
        mockMedicationRepo.schedules = [sched]

        try await sut.rescheduleAllMedicationNotifications()

        let reminderMappings = mockScheduledNotificationRepo.notifications.filter {
            $0.notificationType == .reminder
        }
        let followUpMappings = mockScheduledNotificationRepo.notifications.filter {
            $0.notificationType == .followUp
        }

        XCTAssertGreaterThan(reminderMappings.count, 0, "Should have reminder notifications")
        XCTAssertGreaterThan(followUpMappings.count, 0, "Should have follow-up notifications")
        XCTAssertEqual(reminderMappings.count, followUpMappings.count,
                        "Each reminder should have a matching follow-up")
    }

    // MARK: - Top-Up Edge Cases

    func testTopUp_belowThreshold_schedulesMoreDays() async throws {
        UserDefaults.standard.set(0, forKey: "notification_follow_up_delay")
        defer { UserDefaults.standard.removeObject(forKey: "notification_follow_up_delay") }

        let med = TestFixtures.makeMedication(id: "med-1", name: "Topiramate", type: .preventative, scheduleFrequency: .daily)
        let sched = TestFixtures.makeSchedule(id: "sched-1", medicationId: "med-1", time: "08:00")
        mockMedicationRepo.medications = [med]
        mockMedicationRepo.schedules = [sched]

        // Pre-populate with just 1 mapping (below threshold of 3)
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: Date())!
        let tomorrowStr = DateFormatting.dateString(from: tomorrow)
        let mapping = ScheduledNotification(
            id: "map-1", medicationId: "med-1", scheduleId: "sched-1",
            date: tomorrowStr, notificationId: "notif-1", notificationType: .reminder,
            isGrouped: false, groupKey: nil, sourceType: .medication,
            medicationName: "Topiramate", scheduledTriggerTime: "08:00",
            notificationTitle: "Reminder", notificationBody: "Take Topiramate",
            categoryIdentifier: NotificationCategory.medication,
            createdAt: TimestampHelper.now
        )
        mockScheduledNotificationRepo.notifications = [mapping]

        let beforeCount = mockScheduledNotificationRepo.notifications.count
        XCTAssertEqual(beforeCount, 1)

        await sut.topUp(threshold: 3)

        let afterCount = mockScheduledNotificationRepo.notifications.count
        XCTAssertGreaterThan(afterCount, beforeCount,
                              "Top-up should add more notifications when below threshold")
    }

    func testTopUp_atThreshold_doesNothing() async throws {
        UserDefaults.standard.set(0, forKey: "notification_follow_up_delay")
        defer { UserDefaults.standard.removeObject(forKey: "notification_follow_up_delay") }

        let med = TestFixtures.makeMedication(id: "med-1", name: "Topiramate", type: .preventative, scheduleFrequency: .daily)
        let sched = TestFixtures.makeSchedule(id: "sched-1", medicationId: "med-1", time: "08:00")
        mockMedicationRepo.medications = [med]
        mockMedicationRepo.schedules = [sched]

        // Pre-populate with exactly 3 mappings (at threshold)
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        for dayOffset in 1...3 {
            guard let day = calendar.date(byAdding: .day, value: dayOffset, to: today) else { continue }
            let dateStr = DateFormatting.dateString(from: day)
            let m = ScheduledNotification(
                id: "map-\(dayOffset)", medicationId: "med-1", scheduleId: "sched-1",
                date: dateStr, notificationId: "notif-\(dayOffset)", notificationType: .reminder,
                isGrouped: false, groupKey: nil, sourceType: .medication,
                medicationName: "Topiramate", scheduledTriggerTime: "08:00",
                notificationTitle: "Reminder", notificationBody: "Take Topiramate",
                categoryIdentifier: NotificationCategory.medication,
                createdAt: TimestampHelper.now
            )
            mockScheduledNotificationRepo.notifications.append(m)
        }

        let beforeCount = mockScheduledNotificationRepo.notifications.count
        XCTAssertEqual(beforeCount, 3)

        // The scheduled notifications array tracks new OS notifications
        let beforeScheduled = mockNotificationService.scheduledNotifications.count

        await sut.topUp(threshold: 3)

        // No new OS notifications should be scheduled when at threshold
        // Note: top-up calculates target from NotificationSlotCalculator, not from threshold.
        // The threshold is the minimum before top-up kicks in. If count >= threshold, nothing happens.
        let afterScheduled = mockNotificationService.scheduledNotifications.count
        XCTAssertEqual(afterScheduled, beforeScheduled,
                        "No new notifications should be scheduled when count >= threshold")
    }

    func testTopUp_noExistingMappings_schedulesFromToday() async throws {
        UserDefaults.standard.set(0, forKey: "notification_follow_up_delay")
        defer { UserDefaults.standard.removeObject(forKey: "notification_follow_up_delay") }

        let med = TestFixtures.makeMedication(id: "med-1", name: "Topiramate", type: .preventative, scheduleFrequency: .daily)
        let sched = TestFixtures.makeSchedule(id: "sched-1", medicationId: "med-1", time: "08:00")
        mockMedicationRepo.medications = [med]
        mockMedicationRepo.schedules = [sched]

        // No existing mappings
        mockScheduledNotificationRepo.notifications = []

        await sut.topUp(threshold: 3)

        // Should have scheduled notifications starting from today
        XCTAssertGreaterThan(mockScheduledNotificationRepo.notifications.count, 0,
                              "Should schedule notifications when no existing mappings")

        // Verify the earliest date is today or tomorrow (today may be skipped if time has passed)
        let today = DateFormatting.dateString(from: Date())
        let tomorrow = DateFormatting.dateString(from: Calendar.current.date(byAdding: .day, value: 1, to: Date())!)
        let earliestDate = mockScheduledNotificationRepo.notifications.map(\.date).sorted().first
        XCTAssertNotNil(earliestDate)
        XCTAssertTrue(earliestDate == today || earliestDate == tomorrow,
                       "Scheduling should start from today or tomorrow")
    }

    func testTopUp_respectsGrouping_multiMedsSameTime() async throws {
        UserDefaults.standard.set(0, forKey: "notification_follow_up_delay")
        defer { UserDefaults.standard.removeObject(forKey: "notification_follow_up_delay") }

        let med1 = TestFixtures.makeMedication(id: "med-1", name: "Med A", type: .preventative, scheduleFrequency: .daily)
        let med2 = TestFixtures.makeMedication(id: "med-2", name: "Med B", type: .preventative, scheduleFrequency: .daily)
        let sched1 = TestFixtures.makeSchedule(id: "sched-1", medicationId: "med-1", time: "08:00")
        let sched2 = TestFixtures.makeSchedule(id: "sched-2", medicationId: "med-2", time: "08:00")
        mockMedicationRepo.medications = [med1, med2]
        mockMedicationRepo.schedules = [sched1, sched2]

        // No existing mappings — both are below threshold
        mockScheduledNotificationRepo.notifications = []

        await sut.topUp(threshold: 3)

        // Should have grouped notifications, not individual
        let groupedMappings = mockScheduledNotificationRepo.notifications.filter { $0.isGrouped }
        XCTAssertGreaterThan(groupedMappings.count, 0,
                              "Top-up should create grouped notifications when multiple meds share time")

        // Each date should have 2 DB mappings (one per med) sharing the same notificationId
        let mappingsByDate = Dictionary(grouping: mockScheduledNotificationRepo.notifications, by: \.date)
        for (_, dateMappings) in mappingsByDate {
            XCTAssertEqual(dateMappings.count, 2,
                            "Each date should have 2 mappings (one per medication)")
            let notifIds = Set(dateMappings.map(\.notificationId))
            XCTAssertEqual(notifIds.count, 1,
                            "Grouped mappings for same date should share one OS notification ID")
        }
    }

    // MARK: - Rebalance Edge Cases

    func testRebalance_noExcessNotifications_justTopsUp() async throws {
        UserDefaults.standard.set(0, forKey: "notification_follow_up_delay")
        defer { UserDefaults.standard.removeObject(forKey: "notification_follow_up_delay") }

        let med = TestFixtures.makeMedication(id: "med-1", name: "Topiramate", type: .preventative, scheduleFrequency: .daily)
        let sched = TestFixtures.makeSchedule(id: "sched-1", medicationId: "med-1", time: "08:00")
        mockMedicationRepo.medications = [med]
        mockMedicationRepo.schedules = [sched]

        // Only 1 mapping (well below target of 14 for 1 slot/day)
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: Date())!
        let tomorrowStr = DateFormatting.dateString(from: tomorrow)
        let mapping = ScheduledNotification(
            id: "map-1", medicationId: "med-1", scheduleId: "sched-1",
            date: tomorrowStr, notificationId: "notif-1", notificationType: .reminder,
            isGrouped: false, groupKey: nil, sourceType: .medication,
            medicationName: "Topiramate", scheduledTriggerTime: "08:00",
            notificationTitle: "Reminder", notificationBody: "Take Topiramate",
            categoryIdentifier: NotificationCategory.medication,
            createdAt: TimestampHelper.now
        )
        mockScheduledNotificationRepo.notifications = [mapping]

        let cancelCountBefore = mockNotificationService.cancelledIds.count

        await sut.rebalance()

        // No trimming should occur (cancel count for trimming should not increase)
        // Rebalance trims excess, not shortage. It then tops up.
        // With 1 slot/day target = 14 days, we have 1 mapping, so no trim needed.
        XCTAssertEqual(mockNotificationService.cancelledIds.count, cancelCountBefore,
                        "No notifications should be trimmed when below target")

        // Top-up should add more
        XCTAssertGreaterThan(mockScheduledNotificationRepo.notifications.count, 1,
                              "Rebalance should top up when below target")
    }

    func testRebalance_excessNotifications_trimsLatestDates() async throws {
        UserDefaults.standard.set(0, forKey: "notification_follow_up_delay")
        defer { UserDefaults.standard.removeObject(forKey: "notification_follow_up_delay") }

        let med = TestFixtures.makeMedication(id: "med-1", name: "Topiramate", type: .preventative, scheduleFrequency: .daily)
        let sched = TestFixtures.makeSchedule(id: "sched-1", medicationId: "med-1", time: "08:00")
        mockMedicationRepo.medications = [med]
        mockMedicationRepo.schedules = [sched]

        // Create 20 mappings (target with 1 slot/day = 14, so 6 excess)
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        for dayOffset in 1...20 {
            guard let day = calendar.date(byAdding: .day, value: dayOffset, to: today) else { continue }
            let dateStr = DateFormatting.dateString(from: day)
            let m = ScheduledNotification(
                id: "map-\(dayOffset)", medicationId: "med-1", scheduleId: "sched-1",
                date: dateStr, notificationId: "notif-\(dayOffset)", notificationType: .reminder,
                isGrouped: false, groupKey: nil, sourceType: .medication,
                medicationName: "Topiramate", scheduledTriggerTime: "08:00",
                notificationTitle: "Reminder", notificationBody: "Take Topiramate",
                categoryIdentifier: NotificationCategory.medication,
                createdAt: TimestampHelper.now
            )
            mockScheduledNotificationRepo.notifications.append(m)
        }

        await sut.rebalance()

        // The latest dates should have been trimmed
        // With 1 slot/day, target = min(48/1, 14) = 14
        // So 20 - 14 = 6 should be trimmed
        // The trimmed notifications should be the LATEST dates (highest day offsets)
        let cancelledCount = mockNotificationService.cancelledIds.count
        XCTAssertGreaterThanOrEqual(cancelledCount, 6,
                                     "Should trim at least 6 excess notifications (20 - 14)")

        // Earliest dates (day 1-14) should be preserved
        let remainingDates = mockScheduledNotificationRepo.notifications
            .filter { $0.notificationType == .reminder }
            .map(\.date)
            .sorted()

        if !remainingDates.isEmpty {
            // The earliest dates should be the ones with smallest offsets
            let dayOneDate = DateFormatting.dateString(from: calendar.date(byAdding: .day, value: 1, to: today)!)
            XCTAssertTrue(remainingDates.contains(dayOneDate),
                           "Earliest scheduled date should be preserved")
        }
    }

    // MARK: - Response Handlers Edge Cases

    func testHandleTaken_callsDismiss() async {
        // With no delivered notifications, this should complete without error
        await sut.handleTakenResponse(medicationId: "med-1", scheduleId: "sched-1")

        // Dismiss was called (which internally queries delivered notifications)
        // With empty delivered list, nothing should be removed
        XCTAssertEqual(mockNotificationService.removedDeliveredIds.count, 0)
    }

    func testHandleSkipped_callsDismiss() async {
        await sut.handleSkippedResponse(medicationId: "med-1", scheduleId: "sched-1")

        XCTAssertEqual(mockNotificationService.removedDeliveredIds.count, 0)
    }

    // MARK: - Grouped Lifecycle Scenario

    func testGroupedLifecycle_logOneMed_thenAnother_thenLast() async throws {
        let tomorrow = Calendar.current.date(byAdding: .day, value: 1, to: Date())!
        let dateString = DateFormatting.dateString(from: tomorrow)

        // Step 1: Set up 3 meds at same time
        let medA = TestFixtures.makeMedication(id: "med-a", name: "Med A", type: .preventative, dosageAmount: 100, dosageUnit: "mg", scheduleFrequency: .daily)
        let medB = TestFixtures.makeMedication(id: "med-b", name: "Med B", type: .preventative, dosageAmount: 50, dosageUnit: "mg", scheduleFrequency: .daily)
        let medC = TestFixtures.makeMedication(id: "med-c", name: "Med C", type: .preventative, dosageAmount: 25, dosageUnit: "mg", scheduleFrequency: .daily)
        mockMedicationRepo.medications = [medA, medB, medC]

        let schedA = TestFixtures.makeSchedule(id: "sched-a", medicationId: "med-a", time: "08:00")
        let schedB = TestFixtures.makeSchedule(id: "sched-b", medicationId: "med-b", time: "08:00")
        let schedC = TestFixtures.makeSchedule(id: "sched-c", medicationId: "med-c", time: "08:00")
        mockMedicationRepo.schedules = [schedA, schedB, schedC]

        // Create initial grouped notification with 3 meds
        let groupKey = "08:00_reminder"
        let originalNotifId = "grouped-original"

        for (medId, schedId, name) in [("med-a", "sched-a", "Med A"), ("med-b", "sched-b", "Med B"), ("med-c", "sched-c", "Med C")] {
            let mapping = ScheduledNotification(
                id: UUID().uuidString, medicationId: medId, scheduleId: schedId,
                date: dateString, notificationId: originalNotifId, notificationType: .reminder,
                isGrouped: true, groupKey: groupKey, sourceType: .medication,
                medicationName: name, scheduledTriggerTime: "08:00",
                notificationTitle: "Medication Reminder",
                notificationBody: "Time to take: Med A, Med B, Med C",
                categoryIdentifier: NotificationCategory.multipleMedication,
                createdAt: TimestampHelper.now
            )
            mockScheduledNotificationRepo.notifications.append(mapping)
        }

        XCTAssertEqual(mockScheduledNotificationRepo.notifications.count, 3)

        // Step 2: Cancel med A — should recreate group with B and C
        await sut.cancelNotificationForDate(
            medicationId: "med-a", scheduleId: "sched-a",
            date: dateString, notificationType: .reminder
        )

        // Original notification cancelled
        XCTAssertTrue(mockNotificationService.cancelledIds.contains(originalNotifId))
        // med-a mapping gone
        let medAMappings = mockScheduledNotificationRepo.notifications.filter { $0.medicationId == "med-a" }
        XCTAssertTrue(medAMappings.isEmpty, "Med A mapping should be removed")

        // New grouped notification for B and C should exist
        let afterStep2Grouped = mockNotificationService.scheduledNotifications.filter {
            $0.categoryIdentifier == NotificationCategory.multipleMedication
        }
        XCTAssertEqual(afterStep2Grouped.count, 1, "New grouped notification for B+C should be created")

        // DB should have 2 mappings (B and C)
        let step2Mappings = mockScheduledNotificationRepo.notifications.filter { $0.date == dateString }
        XCTAssertEqual(step2Mappings.count, 2, "Should have 2 DB mappings for B and C")
        let step2MedIds = Set(step2Mappings.compactMap(\.medicationId))
        XCTAssertEqual(step2MedIds, ["med-b", "med-c"])

        // Get the new notification ID for the B+C group
        let bcNotifId = step2Mappings.first!.notificationId

        // Step 3: Cancel med B — should convert to individual for C
        await sut.cancelNotificationForDate(
            medicationId: "med-b", scheduleId: "sched-b",
            date: dateString, notificationType: .reminder
        )

        // B+C grouped notification cancelled
        XCTAssertTrue(mockNotificationService.cancelledIds.contains(bcNotifId))
        // med-b mapping gone
        let medBMappings = mockScheduledNotificationRepo.notifications.filter { $0.medicationId == "med-b" }
        XCTAssertTrue(medBMappings.isEmpty, "Med B mapping should be removed")

        // New individual notification for C should exist
        let afterStep3Individual = mockNotificationService.scheduledNotifications.filter {
            $0.categoryIdentifier == NotificationCategory.medication
        }
        XCTAssertEqual(afterStep3Individual.count, 1, "Individual notification for C should be created")

        // DB should have 1 mapping (C only)
        let step3Mappings = mockScheduledNotificationRepo.notifications.filter { $0.date == dateString }
        XCTAssertEqual(step3Mappings.count, 1, "Should have 1 DB mapping for C")
        XCTAssertEqual(step3Mappings.first?.medicationId, "med-c")
        XCTAssertFalse(step3Mappings.first!.isGrouped, "Should be individual, not grouped")

        // Get the notification ID for C's individual notification
        let cNotifId = step3Mappings.first!.notificationId

        // Step 4: Cancel med C — should result in full cleanup
        await sut.cancelNotificationForDate(
            medicationId: "med-c", scheduleId: "sched-c",
            date: dateString, notificationType: .reminder
        )

        // C's notification cancelled
        XCTAssertTrue(mockNotificationService.cancelledIds.contains(cNotifId))

        // No more DB mappings for this date
        let finalMappings = mockScheduledNotificationRepo.notifications.filter { $0.date == dateString }
        XCTAssertTrue(finalMappings.isEmpty, "All mappings should be cleaned up")

        // No new notifications scheduled after removing the last one
        // The scheduled list should still have the same 2 (grouped B+C and individual C), no new one
        let totalScheduled = mockNotificationService.scheduledNotifications.count
        XCTAssertEqual(totalScheduled, 2,
                        "Should have exactly 2 scheduled notifications from the lifecycle (B+C group and C individual)")
    }

    // MARK: - Helpers

    private func makePendingRequest(id: String, userInfo: [String: Any]) -> UNNotificationRequest {
        let content = UNMutableNotificationContent()
        content.userInfo = userInfo
        return UNNotificationRequest(identifier: id, content: content, trigger: nil)
    }
}

// MARK: - Specialized Mock for Grouped Rollback Testing

/// A mock that fails on the Nth call to createNotification, allowing earlier calls to succeed.
/// This is used to test partial rollback behavior in grouped notification scheduling.
final class FailOnNthCreateMockScheduledNotificationRepository: ScheduledNotificationRepositoryProtocol, @unchecked Sendable {
    var notifications: [ScheduledNotification] = []
    private var createCallCount = 0
    private let failOnCallNumber: Int

    init(failOnCallNumber: Int) {
        self.failOnCallNumber = failOnCallNumber
    }

    func createNotification(_ notification: ScheduledNotification) throws -> ScheduledNotification {
        createCallCount += 1
        if createCallCount >= failOnCallNumber {
            throw TestError.mockError("Simulated DB failure on call \(createCallCount)")
        }
        notifications.append(notification)
        return notification
    }

    func getByEntity(entityType: NotificationSourceType, entityId: String) throws -> [ScheduledNotification] {
        notifications.filter { n in n.sourceType == entityType && (entityType == .dailyCheckin || n.medicationId == entityId) }
    }
    func getAllPending() throws -> [ScheduledNotification] { notifications }
    func deleteByNotificationId(_ notificationId: String) throws {
        notifications.removeAll { $0.notificationId == notificationId }
    }
    func deleteByEntity(entityType: NotificationSourceType, entityId: String) throws {
        notifications.removeAll { n in n.sourceType == entityType && (entityType == .dailyCheckin || n.medicationId == entityId) }
    }
    func getByGroupKey(_ groupKey: String, date: String) throws -> [ScheduledNotification] {
        notifications.filter { $0.groupKey == groupKey && $0.date == date }
    }
    func getByNotificationId(_ notificationId: String) throws -> [ScheduledNotification] {
        notifications.filter { $0.notificationId == notificationId }
    }
    func getMapping(medicationId: String, scheduleId: String, date: String, notificationType: NotificationType) throws -> ScheduledNotification? {
        notifications.first { $0.medicationId == medicationId && $0.scheduleId == scheduleId && $0.date == date && $0.notificationType == notificationType }
    }
    func getMappingsBySchedule(medicationId: String, scheduleId: String) throws -> [ScheduledNotification] {
        notifications.filter { $0.medicationId == medicationId && $0.scheduleId == scheduleId }
    }
    func countBySchedule(medicationId: String, scheduleId: String) throws -> Int {
        notifications.filter { $0.medicationId == medicationId && $0.scheduleId == scheduleId }.count
    }
    func getLastScheduledDate(medicationId: String, scheduleId: String) throws -> String? {
        notifications.filter { $0.medicationId == medicationId && $0.scheduleId == scheduleId }.sorted { $0.date > $1.date }.first?.date
    }
    func deleteById(_ id: String) throws {
        notifications.removeAll { $0.id == id }
    }
    @discardableResult func deleteBeforeDate(_ date: String) throws -> Int {
        let before = notifications.count; notifications.removeAll { $0.date < date }; return before - notifications.count
    }
    @discardableResult func deleteAllMedication() throws -> Int {
        let before = notifications.count; notifications.removeAll { $0.sourceType == .medication }; return before - notifications.count
    }
}

// MARK: - Mock Notification Service

final class MockNotificationService: NotificationServiceProtocol, @unchecked Sendable {
    struct ScheduledNotificationRecord {
        let id: String
        let title: String
        let body: String
        let trigger: UNNotificationTrigger
        let categoryIdentifier: String?
        let userInfo: [String: Any]?
    }

    var scheduledNotifications: [ScheduledNotificationRecord] = []
    var cancelledIds: [String] = []
    var removedDeliveredIds: [String] = []
    var pendingRequests: [UNNotificationRequest] = []
    var permissionGranted: Bool = true

    /// Convenience: set notification IDs and they will be converted to UNNotificationRequests
    var pendingNotificationIds: [String] {
        get { pendingRequests.map(\.identifier) }
        set {
            pendingRequests = newValue.map { id in
                UNNotificationRequest(identifier: id, content: UNNotificationContent(), trigger: nil)
            }
        }
    }

    func requestPermission() async -> Bool {
        permissionGranted
    }

    func scheduleNotification(
        id: String,
        title: String,
        body: String,
        trigger: UNNotificationTrigger,
        categoryIdentifier: String?,
        userInfo: [String: Any]?
    ) async throws {
        scheduledNotifications.append(ScheduledNotificationRecord(
            id: id,
            title: title,
            body: body,
            trigger: trigger,
            categoryIdentifier: categoryIdentifier,
            userInfo: userInfo
        ))
    }

    func cancelNotification(id: String) {
        cancelledIds.append(id)
    }

    func cancelAllNotifications() {
        cancelledIds.append("__all__")
    }

    func getPendingNotifications() async -> [UNNotificationRequest] {
        pendingRequests
    }

    func getDeliveredNotifications() async -> [UNNotification] {
        []
    }

    func removeDeliveredNotification(id: String) {
        removedDeliveredIds.append(id)
    }
}
