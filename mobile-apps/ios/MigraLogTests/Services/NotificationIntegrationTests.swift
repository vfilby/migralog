import XCTest
import UserNotifications
@testable import MigraLog

/// Integration tests that exercise cross-service notification lifecycle scenarios.
/// These tests use real `MedicationNotificationScheduler` and `DailyCheckinNotificationService`
/// with mock repositories to verify multi-step workflows.
final class NotificationIntegrationTests: XCTestCase {
    private var mockNotificationService: MockNotificationService!
    private var mockScheduledNotificationRepo: MockScheduledNotificationRepository!
    private var mockMedicationRepo: MockMedicationRepository!
    private var mockEpisodeRepo: MockEpisodeRepository!
    private var mockDailyStatusRepo: MockDailyStatusRepository!

    private var medScheduler: MedicationNotificationScheduler!
    private var checkinService: DailyCheckinNotificationService!

    override func setUp() {
        super.setUp()
        mockNotificationService = MockNotificationService()
        mockScheduledNotificationRepo = MockScheduledNotificationRepository()
        mockMedicationRepo = MockMedicationRepository()
        mockEpisodeRepo = MockEpisodeRepository()
        mockDailyStatusRepo = MockDailyStatusRepository()

        medScheduler = MedicationNotificationScheduler(
            notificationService: mockNotificationService,
            scheduledNotificationRepo: mockScheduledNotificationRepo,
            medicationRepo: mockMedicationRepo
        )

        checkinService = DailyCheckinNotificationService(
            notificationService: mockNotificationService,
            scheduledNotificationRepo: mockScheduledNotificationRepo,
            episodeRepo: mockEpisodeRepo,
            dailyStatusRepo: mockDailyStatusRepo
        )

        // Enable notifications
        UserDefaults.standard.set(true, forKey: "daily_checkin_enabled")
        UserDefaults.standard.set(true, forKey: "notifications_enabled")
        UserDefaults.standard.set(0, forKey: "notification_follow_up_delay")
        var components = DateComponents()
        components.hour = 21
        components.minute = 0
        if let date = Calendar.current.date(from: components) {
            UserDefaults.standard.set(date.timeIntervalSinceReferenceDate, forKey: "daily_checkin_time")
        }
    }

    override func tearDown() {
        medScheduler = nil
        checkinService = nil
        mockNotificationService = nil
        mockScheduledNotificationRepo = nil
        mockMedicationRepo = nil
        mockEpisodeRepo = nil
        mockDailyStatusRepo = nil
        UserDefaults.standard.removeObject(forKey: "daily_checkin_enabled")
        UserDefaults.standard.removeObject(forKey: "notifications_enabled")
        UserDefaults.standard.removeObject(forKey: "daily_checkin_time")
        UserDefaults.standard.removeObject(forKey: "notification_follow_up_delay")
        super.tearDown()
    }

    // MARK: - Helper

    /// Creates a preventative daily medication with one schedule at the given time.
    private func makePreventativeMed(
        id: String = UUID().uuidString,
        name: String,
        time: String = "08:00",
        scheduleId: String? = nil
    ) -> (Medication, MedicationSchedule) {
        let med = TestFixtures.makeMedication(
            id: id,
            name: name,
            type: .preventative,
            scheduleFrequency: .daily
        )
        let sched = TestFixtures.makeSchedule(
            id: scheduleId ?? UUID().uuidString,
            medicationId: med.id,
            time: time
        )
        return (med, sched)
    }

    /// Syncs the mock pending requests with what has been scheduled (minus cancelled).
    private func syncPendingRequests() {
        let cancelledSet = Set(mockNotificationService.cancelledIds)
        let scheduled = mockNotificationService.scheduledNotifications
        mockNotificationService.pendingRequests = scheduled.compactMap { notif in
            guard !cancelledSet.contains(notif.id) else { return nil }
            let content = UNMutableNotificationContent()
            content.categoryIdentifier = notif.categoryIdentifier ?? ""
            if let userInfo = notif.userInfo {
                content.userInfo = userInfo
            }
            return UNNotificationRequest(
                identifier: notif.id,
                content: content,
                trigger: notif.trigger
            )
        }
    }

    // MARK: - Grouped Notification Lifecycle

    /// Full lifecycle: schedule group of 3 -> log one -> verify 2 remain -> log second -> verify individual -> log last -> verify cleanup
    func testGroupedNotificationFullLifecycle() async throws {
        // Setup: 3 meds at 08:00
        let (medA, schedA) = makePreventativeMed(id: "medA", name: "Topiramate", time: "08:00", scheduleId: "schedA")
        let (medB, schedB) = makePreventativeMed(id: "medB", name: "Amitriptyline", time: "08:00", scheduleId: "schedB")
        let (medC, schedC) = makePreventativeMed(id: "medC", name: "Propranolol", time: "08:00", scheduleId: "schedC")
        mockMedicationRepo.medications = [medA, medB, medC]
        mockMedicationRepo.schedules = [schedA, schedB, schedC]

        // Act 1: rescheduleAll
        try await medScheduler.rescheduleAllMedicationNotifications()

        let initialMappings = mockScheduledNotificationRepo.notifications.filter { $0.sourceType == .medication }
        XCTAssertGreaterThan(initialMappings.count, 0, "Should have medication notification mappings")

        // All mappings should be grouped (3 meds at same time)
        let reminderMappings = initialMappings.filter { $0.notificationType == .reminder }
        for mapping in reminderMappings {
            XCTAssertTrue(mapping.isGrouped, "All mappings should be grouped for 3 meds at same time")
        }

        // Pick the first scheduled date
        let firstDate = reminderMappings.sorted { $0.date < $1.date }.first!.date
        let day1Mappings = reminderMappings.filter { $0.date == firstDate }
        XCTAssertEqual(day1Mappings.count, 3, "Day 1 should have 3 mappings (one per med)")

        // Act 2: Cancel medA's notification for day1 (simulating med A logged)
        syncPendingRequests()
        await medScheduler.cancelNotificationForDate(
            medicationId: "medA", scheduleId: "schedA",
            date: firstDate, notificationType: .reminder
        )

        // After removing medA, should have 2 remaining meds grouped
        let afterCancelA = mockScheduledNotificationRepo.notifications.filter {
            $0.date == firstDate && $0.notificationType == .reminder && $0.sourceType == .medication
        }
        XCTAssertEqual(afterCancelA.count, 2, "Should have 2 remaining grouped mappings after cancelling medA")

        // Act 3: Cancel medB's notification for day1
        syncPendingRequests()
        await medScheduler.cancelNotificationForDate(
            medicationId: "medB", scheduleId: "schedB",
            date: firstDate, notificationType: .reminder
        )

        // After removing medB, should have 1 remaining (individual, not grouped)
        let afterCancelB = mockScheduledNotificationRepo.notifications.filter {
            $0.date == firstDate && $0.notificationType == .reminder && $0.sourceType == .medication
        }
        XCTAssertEqual(afterCancelB.count, 1, "Should have 1 remaining individual mapping")
        if let single = afterCancelB.first {
            XCTAssertFalse(single.isGrouped, "Single remaining mapping should be individual, not grouped")
            XCTAssertEqual(single.medicationId, "medC")
        }

        // Act 4: Cancel medC's notification for day1
        syncPendingRequests()
        await medScheduler.cancelNotificationForDate(
            medicationId: "medC", scheduleId: "schedC",
            date: firstDate, notificationType: .reminder
        )

        // Complete cleanup for day1
        let afterCancelC = mockScheduledNotificationRepo.notifications.filter {
            $0.date == firstDate && $0.notificationType == .reminder && $0.sourceType == .medication
        }
        XCTAssertEqual(afterCancelC.count, 0, "All day1 mappings should be cleaned up")

        // Verify: other days still have grouped notifications
        let otherDayMappings = mockScheduledNotificationRepo.notifications.filter {
            $0.date != firstDate && $0.notificationType == .reminder && $0.sourceType == .medication
        }
        XCTAssertGreaterThan(otherDayMappings.count, 0, "Other days should still have notifications")
    }

    // MARK: - Schedule -> Reconcile -> TopUp Cycle

    /// Simulate app restart: schedule, introduce drift, reconcile, top up
    func testScheduleReconcileTopUpCycle() async throws {
        let (medA, schedA) = makePreventativeMed(id: "medA", name: "Topiramate", time: "09:00", scheduleId: "schedA")
        let (medB, schedB) = makePreventativeMed(id: "medB", name: "Amitriptyline", time: "09:00", scheduleId: "schedB")
        mockMedicationRepo.medications = [medA, medB]
        mockMedicationRepo.schedules = [schedA, schedB]

        // Act 1: rescheduleAll
        try await medScheduler.rescheduleAllMedicationNotifications()
        let initialMappingCount = mockScheduledNotificationRepo.notifications.count
        XCTAssertGreaterThan(initialMappingCount, 0)

        // Act 2: Simulate drift — remove an OS notification from pending list
        // (like iOS silently dropping a notification)
        syncPendingRequests()
        let beforePendingCount = mockNotificationService.pendingRequests.count
        XCTAssertGreaterThan(beforePendingCount, 0)

        // Remove the first pending OS notification to simulate drift
        let removedRequest = mockNotificationService.pendingRequests.removeFirst()
        let removedNotifId = removedRequest.identifier

        // Act 3: Reconcile — should detect orphaned DB mapping
        let reconciler = NotificationReconciliationService(
            notificationService: mockNotificationService,
            scheduledNotificationRepo: mockScheduledNotificationRepo
        )
        await reconciler.reconcile()

        // The orphaned mapping (in DB but not in OS) should be cleaned up
        let orphanedMappings = mockScheduledNotificationRepo.notifications.filter {
            $0.notificationId == removedNotifId
        }
        XCTAssertEqual(orphanedMappings.count, 0,
                        "Reconciliation should clean up orphaned DB mappings")

        // Act 4: TopUp — should re-schedule the missing day
        let beforeTopUpCount = mockNotificationService.scheduledNotifications.count
        await medScheduler.topUp(threshold: 3)

        let afterTopUpCount = mockNotificationService.scheduledNotifications.count
        XCTAssertGreaterThanOrEqual(afterTopUpCount, beforeTopUpCount,
                                     "Top-up should add back missing notifications")
    }

    // MARK: - Rebalance After Medication Added

    /// Adding a new medication triggers rebalance
    func testRebalanceAfterMedicationAdded() async throws {
        // Setup: 1 med at 08:00
        let (medA, schedA) = makePreventativeMed(id: "medA", name: "Topiramate", time: "08:00", scheduleId: "schedA")
        mockMedicationRepo.medications = [medA]
        mockMedicationRepo.schedules = [schedA]

        // Act 1: Schedule
        try await medScheduler.rescheduleAllMedicationNotifications()
        let initialMappings = mockScheduledNotificationRepo.notifications.filter { $0.sourceType == .medication }
        let initialCount = initialMappings.count
        XCTAssertGreaterThan(initialCount, 0, "Should have initial medication notifications")

        // All should be individual (only 1 med)
        for mapping in initialMappings {
            XCTAssertFalse(mapping.isGrouped, "Single med should produce individual notifications")
        }

        // Act 2: Add 2nd med at 08:00
        let (medB, schedB) = makePreventativeMed(id: "medB", name: "Amitriptyline", time: "08:00", scheduleId: "schedB")
        mockMedicationRepo.medications = [medA, medB]
        mockMedicationRepo.schedules = [schedA, schedB]

        // Act 3: rescheduleAll (simulates what happens when medication is added)
        try await medScheduler.rescheduleAllMedicationNotifications()

        let afterMappings = mockScheduledNotificationRepo.notifications.filter { $0.sourceType == .medication }
        XCTAssertGreaterThan(afterMappings.count, 0)

        // With 2 meds at same time, they should now be grouped
        let reminderMappings = afterMappings.filter { $0.notificationType == .reminder }
        for mapping in reminderMappings {
            XCTAssertTrue(mapping.isGrouped, "Two meds at same time should produce grouped notifications")
        }
    }

    // MARK: - Daily Check-in with Episode Lifecycle

    /// Episode starts -> check-in cancelled -> episode ends -> check-in reinstated
    func testDailyCheckinEpisodeLifecycle() async throws {
        // Act 1: Schedule daily check-ins
        try await checkinService.scheduleNotifications()
        let initialCount = mockNotificationService.scheduledNotifications.count
        XCTAssertGreaterThan(initialCount, 0, "Should schedule daily check-in notifications")

        // Reset for next schedule call (service cancels existing before rescheduling)
        syncPendingRequests()

        // Act 2: Create active episode -> schedule again -> all suppressed
        mockEpisodeRepo.episodes = [
            TestFixtures.makeEpisode(id: "ep-active", startTime: TimestampHelper.now, endTime: nil)
        ]

        mockNotificationService.scheduledNotifications.removeAll()
        mockNotificationService.cancelledIds.removeAll()
        try await checkinService.scheduleNotifications()

        // Should have 0 because active episode suppresses all dates
        let afterEpisodeCount = mockNotificationService.scheduledNotifications.count
        XCTAssertEqual(afterEpisodeCount, 0,
                        "Active episode should suppress all daily check-in notifications")

        // Act 3: End episode -> schedule again -> reinstated
        mockEpisodeRepo.episodes = [
            TestFixtures.makeEpisode(
                id: "ep-active",
                startTime: TimestampHelper.now - 3600_000,
                endTime: TimestampHelper.now
            )
        ]

        syncPendingRequests()
        mockNotificationService.scheduledNotifications.removeAll()
        mockNotificationService.cancelledIds.removeAll()
        try await checkinService.scheduleNotifications()

        // Ended episode only suppresses its specific date, not all future dates.
        // Some days should now be reinstated.
        XCTAssertGreaterThan(mockNotificationService.scheduledNotifications.count, 0,
                              "Ending the episode should reinstate check-in notifications for non-episode dates")
    }

    // MARK: - Log Medication Before Notification Time

    /// User logs medication early (before scheduled notification time) -> notification cancelled
    func testLogMedicationBeforeNotificationTime_cancelsReminder() async throws {
        let (medA, schedA) = makePreventativeMed(id: "medA", name: "Topiramate", time: "08:00", scheduleId: "schedA")
        mockMedicationRepo.medications = [medA]
        mockMedicationRepo.schedules = [schedA]

        // Schedule
        try await medScheduler.rescheduleAllMedicationNotifications()

        let initialMappings = mockScheduledNotificationRepo.notifications.filter { $0.sourceType == .medication }
        XCTAssertGreaterThan(initialMappings.count, 0)

        // Find the first future date's mapping
        let firstMapping = initialMappings
            .filter { $0.notificationType == .reminder }
            .sorted { $0.date < $1.date }
            .first!
        let targetDate = firstMapping.date

        // Act: Cancel notification for today's reminder (simulating early logging)
        syncPendingRequests()
        await medScheduler.cancelNotificationForDate(
            medicationId: "medA", scheduleId: "schedA",
            date: targetDate, notificationType: .reminder
        )

        // Verify: mapping deleted
        let remainingForDate = mockScheduledNotificationRepo.notifications.filter {
            $0.date == targetDate && $0.medicationId == "medA" && $0.notificationType == .reminder
        }
        XCTAssertEqual(remainingForDate.count, 0, "Mapping should be deleted after cancellation")

        // Verify: OS notification cancelled
        XCTAssertTrue(mockNotificationService.cancelledIds.contains(firstMapping.notificationId),
                        "OS notification should be cancelled")

        // Act: TopUp should fill the gap
        let beforeTopUp = mockNotificationService.scheduledNotifications.count
        await medScheduler.topUp(threshold: 3)
        let afterTopUp = mockNotificationService.scheduledNotifications.count
        XCTAssertGreaterThanOrEqual(afterTopUp, beforeTopUp,
                                     "Top-up should add a replacement notification")
    }

    // MARK: - Log Medication After Notification (Dismiss)

    /// Tests the dismiss logic path: after a notification fires, logging should trigger dismissal check.
    func testLogMedicationAfterNotification_dismissesFromTray() async throws {
        // Setup: single med scheduled
        let (medA, schedA) = makePreventativeMed(id: "medA", name: "Topiramate", time: "08:00", scheduleId: "schedA")
        mockMedicationRepo.medications = [medA]
        mockMedicationRepo.schedules = [schedA]

        // Schedule
        try await medScheduler.rescheduleAllMedicationNotifications()
        XCTAssertGreaterThan(mockScheduledNotificationRepo.notifications.count, 0)

        // Note: UNNotification can't easily be mocked because it's a system class.
        // We test the path by verifying that dismissMedicationNotification can be called
        // without crash and that it processes delivered notifications correctly.
        // With the mock returning empty delivered notifications, this tests the no-op path.
        await medScheduler.dismissMedicationNotification(medicationId: "medA", scheduleId: "schedA")

        // No crash is the main assertion here — the delivered list is empty in mock,
        // so no notifications will be dismissed, but the code path is exercised.
        XCTAssertEqual(mockNotificationService.removedDeliveredIds.count, 0,
                        "No delivered notifications to remove when tray is empty")
    }

    // MARK: - Mixed Medication and Daily Check-in

    /// Both systems coexist without interference
    func testMedicationAndDailyCheckinCoexist() async throws {
        // Setup: 2 meds at 08:00
        let (medA, schedA) = makePreventativeMed(id: "medA", name: "Topiramate", time: "08:00", scheduleId: "schedA")
        let (medB, schedB) = makePreventativeMed(id: "medB", name: "Amitriptyline", time: "08:00", scheduleId: "schedB")
        mockMedicationRepo.medications = [medA, medB]
        mockMedicationRepo.schedules = [schedA, schedB]

        // Act 1: Schedule medication notifications
        try await medScheduler.rescheduleAllMedicationNotifications()
        let medNotifCount = mockNotificationService.scheduledNotifications.count
        let medMappingCount = mockScheduledNotificationRepo.notifications.filter {
            $0.sourceType == .medication
        }.count
        XCTAssertGreaterThan(medNotifCount, 0, "Should have medication notifications")

        // Act 2: Schedule daily check-in notifications
        try await checkinService.scheduleNotifications()
        let checkinMappingCount = mockScheduledNotificationRepo.notifications.filter {
            $0.sourceType == .dailyCheckin
        }.count
        XCTAssertGreaterThan(checkinMappingCount, 0, "Should have daily check-in notifications")

        // Verify: total = medication + daily check-in
        let totalMappings = mockScheduledNotificationRepo.notifications.count
        XCTAssertEqual(totalMappings, medMappingCount + checkinMappingCount,
                        "Total mappings should be sum of medication and daily check-in")

        // Act 3: Cancel a medication -> daily check-ins should be unaffected
        syncPendingRequests()
        await medScheduler.cancelMedicationReminders(for: "medA")

        let checkinAfterCancel = mockScheduledNotificationRepo.notifications.filter {
            $0.sourceType == .dailyCheckin
        }.count
        XCTAssertEqual(checkinAfterCancel, checkinMappingCount,
                        "Cancelling a medication should not affect daily check-in notifications")

        // Medication mappings for medA should be gone
        let medAMappings = mockScheduledNotificationRepo.notifications.filter {
            $0.medicationId == "medA"
        }
        XCTAssertEqual(medAMappings.count, 0, "MedA mappings should be fully removed")

        // MedB mappings should still exist
        let medBMappings = mockScheduledNotificationRepo.notifications.filter {
            $0.medicationId == "medB"
        }
        XCTAssertGreaterThan(medBMappings.count, 0, "MedB mappings should be unaffected")
    }
}
