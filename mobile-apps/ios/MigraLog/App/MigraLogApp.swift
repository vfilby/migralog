import SwiftUI
import UserNotifications

@main
struct MigraLogApp: App {
    @State private var appState = AppState()

    /// Notification response handler — must be retained for the lifetime of the app.
    private let notificationResponseHandler: NotificationResponseHandler
    private let reconciliationService: NotificationReconciliationService
    private let medicationNotificationService: MedicationNotificationScheduler
    private let dailyCheckinService: DailyCheckinNotificationService
    @State private var timezoneChangeService: TimezoneChangeService

    init() {
        SentrySetup.start()

        let notificationService = NotificationService.shared
        let medicationRepository = MedicationRepository(dbManager: DatabaseManager.shared)
        let scheduledNotificationRepo = ScheduledNotificationRepository(dbManager: DatabaseManager.shared)
        let medNotifService = MedicationNotificationScheduler(
            notificationService: notificationService,
            scheduledNotificationRepo: scheduledNotificationRepo,
            medicationRepo: medicationRepository
        )
        self.medicationNotificationService = medNotifService

        self.reconciliationService = NotificationReconciliationService(
            notificationService: notificationService,
            scheduledNotificationRepo: scheduledNotificationRepo
        )

        let dailyStatusRepo = DailyStatusRepository(dbManager: DatabaseManager.shared)
        let episodeRepo = EpisodeRepository(dbManager: DatabaseManager.shared)
        let dailyCheckinSvc = DailyCheckinNotificationService(
            notificationService: notificationService,
            scheduledNotificationRepo: scheduledNotificationRepo,
            episodeRepo: episodeRepo,
            dailyStatusRepo: dailyStatusRepo
        )
        self.dailyCheckinService = dailyCheckinSvc

        let handler = NotificationResponseHandler(
            medicationNotificationService: medNotifService,
            medicationRepository: medicationRepository,
            notificationService: notificationService,
            dailyStatusRepo: dailyStatusRepo,
            dailyCheckinService: dailyCheckinSvc
        )
        self.notificationResponseHandler = handler

        // Set the delegate before the app finishes launching so we don't miss any responses
        UNUserNotificationCenter.current().delegate = handler

        self._timezoneChangeService = State(
            initialValue: TimezoneChangeService(medicationRepo: medicationRepository)
        )
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(appState)
                .environment(timezoneChangeService)
                .task {
                    await reconciliationService.reconcile()
                    await medicationNotificationService.topUp()
                    try? await dailyCheckinService.scheduleNotifications()
                    await timezoneChangeService.checkForChange()
                }
        }
    }
}

@Observable
final class AppState {
    var isOnboardingComplete: Bool = false
    var isLoading: Bool = true

    private let onboardingKey = "isOnboardingComplete"

    /// Whether the app is running under UI testing mode
    static var isUITesting: Bool {
        ProcessInfo.processInfo.arguments.contains("--uitesting")
    }

    /// Tracks whether UI testing arguments already set the onboarding state
    private var onboardingSetByUITesting = false

    init() {
        if Self.isUITesting {
            handleUITestingLaunchArguments()
        }
        checkOnboardingStatus()
    }

    func checkOnboardingStatus() {
        // Don't override the in-memory value if it was already set by UI testing arguments
        if !onboardingSetByUITesting {
            isOnboardingComplete = UserDefaults.standard.bool(forKey: onboardingKey)
        }
        isLoading = false
    }

    func completeOnboarding() {
        isOnboardingComplete = true
        UserDefaults.standard.set(true, forKey: onboardingKey)
    }

    func skipOnboarding() {
        completeOnboarding()
    }

    func resetOnboarding() {
        isOnboardingComplete = false
        UserDefaults.standard.set(false, forKey: onboardingKey)
    }

    // MARK: - UI Testing Support

    private func handleUITestingLaunchArguments() {
        let arguments = ProcessInfo.processInfo.arguments

        // Disable animations for faster, more reliable UI tests
        UIView.setAnimationsEnabled(false)

        if arguments.contains("--reset-database") {
            resetForUITesting()
        }

        if arguments.contains("--skip-onboarding") {
            UserDefaults.standard.set(true, forKey: onboardingKey)
            self.isOnboardingComplete = true
            self.onboardingSetByUITesting = true
        }

        if arguments.contains("--load-fixtures") {
            resetForUITesting()
            UserDefaults.standard.set(true, forKey: onboardingKey)
            self.isOnboardingComplete = true
            self.onboardingSetByUITesting = true
            loadFixtureData()
        }
    }

    private func resetForUITesting() {
        // Clear UserDefaults
        if let bundleId = Bundle.main.bundleIdentifier {
            UserDefaults.standard.removePersistentDomain(forName: bundleId)
        }
        UserDefaults.standard.set(false, forKey: onboardingKey)

        // Reset database
        do {
            try DatabaseManager.shared.resetDatabase()
        } catch {
            print("UI Testing: Failed to reset database: \(error)")
        }
    }

    private func loadFixtureData() {
        let db = DatabaseManager.shared
        let now = TimestampHelper.now

        do {
            try db.dbQueue.write { database in
                // Create preventative medication: Test Topiramate (50mg, daily at 8:00 AM)
                let topId = "fixture-med-topiramate"
                try database.execute(sql: """
                    INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, default_quantity, schedule_frequency, active, created_at, updated_at)
                    VALUES (?, 'Test Topiramate', 'preventative', 50.0, 'mg', 1.0, 'daily', 1, ?, ?)
                    """, arguments: [topId, now, now])

                let topScheduleId = "fixture-schedule-topiramate"
                try database.execute(sql: """
                    INSERT INTO medication_schedules (id, medication_id, time, timezone, dosage, enabled, reminder_enabled)
                    VALUES (?, ?, '08:00', ?, 1.0, 1, 1)
                    """, arguments: [topScheduleId, topId, TimeZone.current.identifier])

                // Create preventative medication: Test Magnesium (400mg, daily at 8:00 AM)
                let magId = "fixture-med-magnesium"
                try database.execute(sql: """
                    INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, default_quantity, schedule_frequency, active, created_at, updated_at)
                    VALUES (?, 'Test Magnesium', 'preventative', 400.0, 'mg', 1.0, 'daily', 1, ?, ?)
                    """, arguments: [magId, now, now])

                let magScheduleId = "fixture-schedule-magnesium"
                try database.execute(sql: """
                    INSERT INTO medication_schedules (id, medication_id, time, timezone, dosage, enabled, reminder_enabled)
                    VALUES (?, ?, '08:00', ?, 1.0, 1, 1)
                    """, arguments: [magScheduleId, magId, TimeZone.current.identifier])

                // Create rescue medication: Test Ibuprofen (400mg, as needed)
                let ibuId = "fixture-med-ibuprofen"
                try database.execute(sql: """
                    INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, default_quantity, active, created_at, updated_at)
                    VALUES (?, 'Test Ibuprofen', 'rescue', 400.0, 'mg', 1.0, 1, ?, ?)
                    """, arguments: [ibuId, now, now])

                // Create closed episode from yesterday (4h duration, intensity 3->7->4)
                let episodeId = "fixture-episode-yesterday"
                let yesterday = Calendar.current.date(byAdding: .day, value: -1, to: Date())!
                let startOfYesterday = Calendar.current.startOfDay(for: yesterday)
                let episodeStart = startOfYesterday.addingTimeInterval(10 * 3600) // 10:00 AM
                let episodeEnd = episodeStart.addingTimeInterval(4 * 3600) // 4 hours later
                let startMs = TimestampHelper.fromDate(episodeStart)
                let endMs = TimestampHelper.fromDate(episodeEnd)

                try database.execute(sql: """
                    INSERT INTO episodes (id, start_time, end_time, locations, qualities, symptoms, triggers, notes, created_at, updated_at)
                    VALUES (?, ?, ?, '[]', '["throbbing"]', '["nausea"]', '["stress"]', 'Fixture episode', ?, ?)
                    """, arguments: [episodeId, startMs, endMs, startMs, endMs])

                // Intensity readings: 3 -> 7 -> 4
                let reading1Id = "fixture-reading-1"
                try database.execute(sql: """
                    INSERT INTO intensity_readings (id, episode_id, timestamp, intensity, created_at, updated_at)
                    VALUES (?, ?, ?, 3.0, ?, ?)
                    """, arguments: [reading1Id, episodeId, startMs, startMs, startMs])

                let midMs = startMs + 2 * 3600 * 1000 // 2 hours in
                let reading2Id = "fixture-reading-2"
                try database.execute(sql: """
                    INSERT INTO intensity_readings (id, episode_id, timestamp, intensity, created_at, updated_at)
                    VALUES (?, ?, ?, 7.0, ?, ?)
                    """, arguments: [reading2Id, episodeId, midMs, midMs, midMs])

                let reading3Id = "fixture-reading-3"
                try database.execute(sql: """
                    INSERT INTO intensity_readings (id, episode_id, timestamp, intensity, created_at, updated_at)
                    VALUES (?, ?, ?, 4.0, ?, ?)
                    """, arguments: [reading3Id, episodeId, endMs, endMs, endMs])

                // Create red daily status for yesterday (from the episode)
                let yesterdayStr = TimestampHelper.dateString(from: yesterday)
                let statusId = "fixture-status-yesterday"
                try database.execute(sql: """
                    INSERT INTO daily_status_logs (id, date, status, prompted, created_at, updated_at)
                    VALUES (?, ?, 'red', 0, ?, ?)
                    """, arguments: [statusId, yesterdayStr, now, now])
            }
        } catch {
            print("UI Testing: Failed to load fixture data: \(error)")
        }
    }
}
