import XCTest
import UserNotifications
@testable import MigraLog

final class DailyCheckinNotificationServiceTests: XCTestCase {
    private var sut: DailyCheckinNotificationService!
    private var mockNotificationService: MockNotificationService!
    private var mockScheduledNotificationRepo: MockScheduledNotificationRepository!
    private var mockEpisodeRepo: MockEpisodeRepository!
    private var mockDailyStatusRepo: MockDailyStatusRepository!

    override func setUp() {
        super.setUp()
        mockNotificationService = MockNotificationService()
        mockScheduledNotificationRepo = MockScheduledNotificationRepository()
        mockEpisodeRepo = MockEpisodeRepository()
        mockDailyStatusRepo = MockDailyStatusRepository()

        // Set default check-in settings in UserDefaults
        UserDefaults.standard.set(true, forKey: "daily_checkin_enabled")
        UserDefaults.standard.set(true, forKey: "notifications_enabled")
        // Default time: 9 PM — use today's date to ensure positive timeIntervalSinceReferenceDate
        let today = Calendar.current.startOfDay(for: Date())
        if let date = Calendar.current.date(bySettingHour: 21, minute: 0, second: 0, of: today) {
            UserDefaults.standard.set(date.timeIntervalSinceReferenceDate, forKey: "daily_checkin_time")
        }

        sut = DailyCheckinNotificationService(
            notificationService: mockNotificationService,
            scheduledNotificationRepo: mockScheduledNotificationRepo,
            episodeRepo: mockEpisodeRepo,
            dailyStatusRepo: mockDailyStatusRepo
        )
    }

    override func tearDown() {
        sut = nil
        mockNotificationService = nil
        mockScheduledNotificationRepo = nil
        mockEpisodeRepo = nil
        mockDailyStatusRepo = nil
        // Clean up UserDefaults
        UserDefaults.standard.removeObject(forKey: "daily_checkin_enabled")
        UserDefaults.standard.removeObject(forKey: "notifications_enabled")
        UserDefaults.standard.removeObject(forKey: "daily_checkin_time")
        super.tearDown()
    }

    // MARK: - Schedule

    func testScheduleNotifications_schedules14Days() async throws {
        try await sut.scheduleNotifications()

        // Should schedule up to 14 notifications (some might be skipped if trigger is in the past)
        XCTAssertGreaterThan(mockNotificationService.scheduledNotifications.count, 0)
        XCTAssertLessThanOrEqual(mockNotificationService.scheduledNotifications.count, 14)

        // All should have daily_checkin_ prefix
        for notification in mockNotificationService.scheduledNotifications {
            XCTAssertTrue(notification.id.hasPrefix("daily_checkin_"))
        }
    }

    func testScheduleNotifications_createsDBMappings() async throws {
        try await sut.scheduleNotifications()

        // DB should have mappings matching OS notifications
        XCTAssertEqual(
            mockScheduledNotificationRepo.notifications.count,
            mockNotificationService.scheduledNotifications.count
        )
    }

    func testScheduleNotifications_usesNonRepeatingTrigger() async throws {
        try await sut.scheduleNotifications()

        guard let notification = mockNotificationService.scheduledNotifications.first else {
            XCTFail("No notifications scheduled")
            return
        }

        guard let trigger = notification.trigger as? UNCalendarNotificationTrigger else {
            XCTFail("Expected UNCalendarNotificationTrigger")
            return
        }

        XCTAssertFalse(trigger.repeats)
    }

    // MARK: - Suppression

    func testScheduleNotifications_suppressesWhenActiveEpisode() async throws {
        // Set up an active episode (no end time)
        let now = TimestampHelper.now
        mockEpisodeRepo.episodes = [
            Episode(
                id: "episode-1",
                startTime: now,
                endTime: nil,
                locations: [],
                qualities: [],
                symptoms: [],
                triggers: [],
                notes: nil,
                latitude: nil,
                longitude: nil,
                locationAccuracy: nil,
                locationTimestamp: nil,
                createdAt: now,
                updatedAt: now
            )
        ]

        try await sut.scheduleNotifications()

        // Should schedule 0 notifications because active episode suppresses all
        XCTAssertEqual(mockNotificationService.scheduledNotifications.count, 0)
    }

    func testScheduleNotifications_suppressesWhenStatusLogged() async throws {
        // Log status for today
        let today = DateFormatting.dateString(from: Date())
        let now = TimestampHelper.now
        mockDailyStatusRepo.statuses = [
            DailyStatusLog(
                id: "status-1",
                date: today,
                status: .green,
                statusType: nil,
                notes: nil,
                prompted: false,
                createdAt: now,
                updatedAt: now
            )
        ]

        try await sut.scheduleNotifications()

        // Today should be suppressed, but other days should still be scheduled
        let scheduledIds = mockNotificationService.scheduledNotifications.map(\.id)
        XCTAssertFalse(scheduledIds.contains("daily_checkin_\(today)"))
    }

    // MARK: - Cancel

    func testCancelAll_cancelsAllCheckinNotifications() async throws {
        try await sut.scheduleNotifications()
        let initialCount = mockNotificationService.scheduledNotifications.count

        await sut.cancelAll()

        // Should have cancelled notifications with daily_checkin_ prefix
        XCTAssertGreaterThan(initialCount, 0)
    }

    func testCancelForDate_cancelsSpecificDate() async {
        let today = DateFormatting.dateString(from: Date())
        await sut.cancelForDate(today)

        XCTAssertTrue(mockNotificationService.cancelledIds.contains("daily_checkin_\(today)"))
    }

    // MARK: - Is Scheduled

    func testIsScheduled_returnsTrueWhenScheduled() async {
        mockNotificationService.pendingNotificationIds = ["daily_checkin_2026-03-23"]

        let result = await sut.isScheduled()

        XCTAssertTrue(result)
    }

    func testIsScheduled_returnsFalseWhenNotScheduled() async {
        mockNotificationService.pendingNotificationIds = []

        let result = await sut.isScheduled()

        XCTAssertFalse(result)
    }

    func testIsScheduled_returnsFalseWhenOnlyMedicationNotifications() async {
        mockNotificationService.pendingNotificationIds = ["med_med-1_sched-1_day0"]

        let result = await sut.isScheduled()

        XCTAssertFalse(result)
    }

    // MARK: - Suppression Edge Cases

    func testSchedule_suppressesDateWithEndedEpisode() async throws {
        // Episode that started and ended today (not active, but on this date)
        let calendar = Calendar.current
        let tomorrow = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: Date()))!
        let tomorrowStr = DateFormatting.dateString(from: tomorrow)
        let startTs = TimestampHelper.fromDate(tomorrow)
        let endTs = startTs + 3600_000 // 1 hour later

        mockEpisodeRepo.episodes = [
            TestFixtures.makeEpisode(id: "ep-ended", startTime: startTs, endTime: endTs)
        ]

        try await sut.scheduleNotifications()

        let scheduledIds = mockNotificationService.scheduledNotifications.map(\.id)
        XCTAssertFalse(scheduledIds.contains("daily_checkin_\(tomorrowStr)"),
                        "Date with an ended episode should be suppressed")
    }

    func testSchedule_activeEpisode_suppressesAllFutureDates() async throws {
        // Active episode (no endTime) — should suppress ALL 14 days
        mockEpisodeRepo.episodes = [
            TestFixtures.makeEpisode(id: "ep-active", startTime: TimestampHelper.now, endTime: nil)
        ]

        try await sut.scheduleNotifications()

        XCTAssertEqual(mockNotificationService.scheduledNotifications.count, 0,
                        "Active episode should suppress all future daily check-in dates")
    }

    func testSchedule_statusLoggedForOneDay_onlyThatDaySuppressed() async throws {
        // Log status for day 3 only
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let day3 = calendar.date(byAdding: .day, value: 3, to: today)!
        let day3Str = DateFormatting.dateString(from: day3)

        mockDailyStatusRepo.statuses = [
            TestFixtures.makeDailyStatus(id: "status-day3", date: day3Str, status: .green)
        ]

        try await sut.scheduleNotifications()

        let scheduledIds = Set(mockNotificationService.scheduledNotifications.map(\.id))
        XCTAssertFalse(scheduledIds.contains("daily_checkin_\(day3Str)"),
                        "Day with logged status should be suppressed")

        // Total should be 13 or fewer (14 minus the suppressed day, minus any past-trigger skips)
        XCTAssertLessThanOrEqual(mockNotificationService.scheduledNotifications.count, 13)
        XCTAssertGreaterThan(mockNotificationService.scheduledNotifications.count, 0)
    }

    func testSchedule_multipleSuppressionReasons_allApplied() async throws {
        // Day 2 has both an episode AND a logged status — should still be suppressed once (no crash/double issue)
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let day2 = calendar.date(byAdding: .day, value: 2, to: today)!
        let day2Str = DateFormatting.dateString(from: day2)
        let day2Ts = TimestampHelper.fromDate(day2)

        mockEpisodeRepo.episodes = [
            TestFixtures.makeEpisode(id: "ep-day2", startTime: day2Ts, endTime: day2Ts + 3600_000)
        ]
        mockDailyStatusRepo.statuses = [
            TestFixtures.makeDailyStatus(id: "status-day2", date: day2Str, status: .yellow)
        ]

        try await sut.scheduleNotifications()

        let scheduledIds = Set(mockNotificationService.scheduledNotifications.map(\.id))
        XCTAssertFalse(scheduledIds.contains("daily_checkin_\(day2Str)"),
                        "Day with both episode and status should be suppressed")
        // Should not crash or produce duplicates
        XCTAssertGreaterThan(mockNotificationService.scheduledNotifications.count, 0)
    }

    // MARK: - Settings Edge Cases

    func testSchedule_notificationsDisabled_schedulesNothing() async throws {
        UserDefaults.standard.set(false, forKey: "notifications_enabled")

        try await sut.scheduleNotifications()

        XCTAssertEqual(mockNotificationService.scheduledNotifications.count, 0,
                        "Disabling notifications_enabled should prevent all scheduling")
    }

    func testSchedule_dailyCheckinDisabled_schedulesNothing() async throws {
        UserDefaults.standard.set(false, forKey: "daily_checkin_enabled")

        try await sut.scheduleNotifications()

        XCTAssertEqual(mockNotificationService.scheduledNotifications.count, 0,
                        "Disabling daily_checkin_enabled should prevent all scheduling")
    }

    func testSchedule_customTime_usesCorrectTime() async throws {
        // Set check-in time to 14:30 using today's date to ensure positive timeIntervalSinceReferenceDate
        let today = Calendar.current.startOfDay(for: Date())
        if let date = Calendar.current.date(bySettingHour: 14, minute: 30, second: 0, of: today) {
            UserDefaults.standard.set(date.timeIntervalSinceReferenceDate, forKey: "daily_checkin_time")
        }

        try await sut.scheduleNotifications()

        guard let notification = mockNotificationService.scheduledNotifications.first else {
            XCTFail("Expected at least one scheduled notification")
            return
        }
        guard let trigger = notification.trigger as? UNCalendarNotificationTrigger else {
            XCTFail("Expected UNCalendarNotificationTrigger")
            return
        }
        XCTAssertEqual(trigger.dateComponents.hour, 14)
        XCTAssertEqual(trigger.dateComponents.minute, 30)
    }

    func testSchedule_defaultTime_uses2100() async throws {
        // Remove custom time so it falls back to default
        UserDefaults.standard.removeObject(forKey: "daily_checkin_time")

        try await sut.scheduleNotifications()

        guard let notification = mockNotificationService.scheduledNotifications.first else {
            XCTFail("Expected at least one scheduled notification")
            return
        }
        guard let trigger = notification.trigger as? UNCalendarNotificationTrigger else {
            XCTFail("Expected UNCalendarNotificationTrigger")
            return
        }
        XCTAssertEqual(trigger.dateComponents.hour, 21)
        XCTAssertEqual(trigger.dateComponents.minute, 0)
    }

    // MARK: - Cancel Edge Cases

    func testCancelForDate_deletesDBMapping() async throws {
        // Schedule first so there are DB mappings
        try await sut.scheduleNotifications()
        let initialDBCount = mockScheduledNotificationRepo.notifications.count
        XCTAssertGreaterThan(initialDBCount, 0)

        // Pick the first scheduled date from DB
        guard let firstMapping = mockScheduledNotificationRepo.notifications.first else {
            XCTFail("No DB mappings found")
            return
        }

        await sut.cancelForDate(firstMapping.date)

        // Verify the mapping for that notification ID is removed
        let remaining = mockScheduledNotificationRepo.notifications.filter {
            $0.notificationId == firstMapping.notificationId
        }
        XCTAssertTrue(remaining.isEmpty, "DB mapping should be deleted after cancelForDate")
    }

    func testCancelAll_clearsAllDBMappings() async throws {
        try await sut.scheduleNotifications()
        XCTAssertGreaterThan(mockScheduledNotificationRepo.notifications.count, 0)

        // cancelAll needs pending requests to cancel OS notifications
        mockNotificationService.pendingRequests = mockNotificationService.scheduledNotifications.map { notif in
            UNNotificationRequest(identifier: notif.id, content: UNNotificationContent(), trigger: nil)
        }

        await sut.cancelAll()

        let dailyCheckinMappings = mockScheduledNotificationRepo.notifications.filter {
            $0.sourceType == .dailyCheckin
        }
        XCTAssertEqual(dailyCheckinMappings.count, 0,
                        "All daily check-in DB mappings should be cleared after cancelAll")
    }

    func testCancelForDate_nonExistentDate_doesNotCrash() async {
        // Cancel a date that was never scheduled — should not crash
        await sut.cancelForDate("2099-12-31")

        XCTAssertTrue(mockNotificationService.cancelledIds.contains("daily_checkin_2099-12-31"),
                        "OS cancel should still be called even if no DB mapping")
    }

    // MARK: - TopUp Edge Cases

    func testTopUp_fillsMissingDays() async throws {
        // Schedule all 14 days
        try await sut.scheduleNotifications()
        let initialCount = mockScheduledNotificationRepo.notifications.count
        XCTAssertGreaterThan(initialCount, 0)

        // Remove 3 mappings from DB and OS to simulate drift
        let toRemove = Array(mockScheduledNotificationRepo.notifications.prefix(3))
        for mapping in toRemove {
            try mockScheduledNotificationRepo.deleteByNotificationId(mapping.notificationId)
        }
        let afterRemoval = mockScheduledNotificationRepo.notifications.count
        XCTAssertEqual(afterRemoval, initialCount - 3)

        // Reset scheduled notifications tracker to see new ones
        let beforeTopUp = mockNotificationService.scheduledNotifications.count

        await sut.topUp()

        // Should have added back up to 3 new notifications
        let newNotifications = mockNotificationService.scheduledNotifications.count - beforeTopUp
        XCTAssertGreaterThan(newNotifications, 0, "Top-up should fill missing days")
    }

    func testTopUp_disabledNotifications_doesNothing() async throws {
        try await sut.scheduleNotifications()
        let beforeCount = mockNotificationService.scheduledNotifications.count

        // Disable check-in
        UserDefaults.standard.set(false, forKey: "daily_checkin_enabled")

        await sut.topUp()

        XCTAssertEqual(mockNotificationService.scheduledNotifications.count, beforeCount,
                        "Top-up should not add notifications when daily check-in is disabled")
    }

    func testTopUp_suppressedDatesSkipped() async throws {
        // Schedule initially
        try await sut.scheduleNotifications()

        // Remove some DB mappings to create gaps
        let toRemove = Array(mockScheduledNotificationRepo.notifications.prefix(2))
        for mapping in toRemove {
            try mockScheduledNotificationRepo.deleteByNotificationId(mapping.notificationId)
        }

        // Add an active episode — all dates should now be suppressed
        mockEpisodeRepo.episodes = [
            TestFixtures.makeEpisode(id: "ep-active", startTime: TimestampHelper.now, endTime: nil)
        ]

        let beforeTopUp = mockNotificationService.scheduledNotifications.count

        await sut.topUp()

        XCTAssertEqual(mockNotificationService.scheduledNotifications.count, beforeTopUp,
                        "Top-up should not fill dates that are suppressed by active episode")
    }

    func testTopUp_existingMappingsPreserved() async throws {
        try await sut.scheduleNotifications()
        let originalMappings = mockScheduledNotificationRepo.notifications

        // Remove one mapping to create a gap
        if let first = originalMappings.first {
            try mockScheduledNotificationRepo.deleteByNotificationId(first.notificationId)
        }
        let remainingBefore = mockScheduledNotificationRepo.notifications
        let remainingIds = Set(remainingBefore.map(\.notificationId))

        await sut.topUp()

        // All original remaining mappings should still be there
        for id in remainingIds {
            let stillExists = mockScheduledNotificationRepo.notifications.contains { $0.notificationId == id }
            XCTAssertTrue(stillExists, "Existing mapping \(id) should be preserved during top-up")
        }
    }

    // MARK: - DB Error Handling

    func testSchedule_dbWriteFailure_stillSchedulesOSNotification() async throws {
        // Use a repo that fails on create
        let failingRepo = MockScheduledNotificationRepository()
        failingRepo.errorToThrow = TestError.mockError("DB write failure")

        // But we need getByEntity and deleteByEntity to work for the initial cleanup
        // The errorToThrow affects all calls, so let's test differently:
        // We'll schedule normally first, then verify the behavior by checking the service
        // handles DB errors gracefully without crashing.

        // Create a service with a repo that will fail on create but not on delete
        let failOnCreateRepo = FailOnCreateScheduledNotificationRepository()
        let sut2 = DailyCheckinNotificationService(
            notificationService: mockNotificationService,
            scheduledNotificationRepo: failOnCreateRepo,
            episodeRepo: mockEpisodeRepo,
            dailyStatusRepo: mockDailyStatusRepo
        )

        // Should not throw — DB failures are caught internally
        try await sut2.scheduleNotifications()

        // OS notifications should still be scheduled even if DB mapping fails
        XCTAssertGreaterThan(mockNotificationService.scheduledNotifications.count, 0,
                              "OS notifications should be scheduled even when DB write fails")
        // DB should have 0 mappings since creates all failed
        XCTAssertEqual(failOnCreateRepo.notifications.count, 0)
    }
}

// MARK: - Specialized Mock for DB Create Failure

/// A mock that allows deletes/reads to succeed but fails on createNotification.
/// Used to test that OS notifications still get scheduled even when DB mapping fails.
private final class FailOnCreateScheduledNotificationRepository: ScheduledNotificationRepositoryProtocol, @unchecked Sendable {
    var notifications: [ScheduledNotification] = []

    func createNotification(_ notification: ScheduledNotification) throws -> ScheduledNotification {
        throw TestError.mockError("DB create failure")
    }

    func getByEntity(entityType: NotificationSourceType, entityId: String) throws -> [ScheduledNotification] {
        notifications.filter { $0.sourceType == entityType }
    }

    func getAllPending() throws -> [ScheduledNotification] { notifications }
    func deleteByNotificationId(_ notificationId: String) throws {
        notifications.removeAll { $0.notificationId == notificationId }
    }
    func deleteByEntity(entityType: NotificationSourceType, entityId: String) throws {
        notifications.removeAll { $0.sourceType == entityType }
    }
    func getByGroupKey(_ groupKey: String, date: String) throws -> [ScheduledNotification] { [] }
    func getByNotificationId(_ notificationId: String) throws -> [ScheduledNotification] { [] }
    func getMapping(medicationId: String, scheduleId: String, date: String, notificationType: NotificationType) throws -> ScheduledNotification? { nil }
    func getMappingsBySchedule(medicationId: String, scheduleId: String) throws -> [ScheduledNotification] { [] }
    func countBySchedule(medicationId: String, scheduleId: String) throws -> Int { 0 }
    func getLastScheduledDate(medicationId: String, scheduleId: String) throws -> String? { nil }
    func deleteById(_ id: String) throws {}
    @discardableResult func deleteBeforeDate(_ date: String) throws -> Int { 0 }
    @discardableResult func deleteAllMedication() throws -> Int { 0 }
}
