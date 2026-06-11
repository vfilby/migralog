import SwiftUI
import UIKit
import UserNotifications

@main
struct MigraLogApp: App {
    /// Owns the shared `SyncService` and registers the background-refresh task before the
    /// app finishes launching (BGTaskScheduler requires registration at launch — #462).
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
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
                .environment(appDelegate.syncService)
                .task {
                    await reconciliationService.reconcile()
                    await medicationNotificationService.topUp()
                    try? await dailyCheckinService.scheduleNotifications()
                    await timezoneChangeService.checkForChange()
                }
        }
    }
}

/// Owns the single shared `SyncService` and registers the background-refresh task. A
/// `UIApplicationDelegate` is required because `BGTaskScheduler.register` must run before
/// `didFinishLaunchingWithOptions` returns — SwiftUI's `App` lifecycle has no equivalent
/// pre-launch hook (#462).
@MainActor
final class AppDelegate: NSObject, UIApplicationDelegate {
    let syncService = SyncService()

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        BackgroundSyncScheduler.register(syncService: syncService)
        return true
    }
}

@Observable
final class AppState {
    var isOnboardingComplete: Bool = false
    var isLoading: Bool = true

    // MARK: - Cross-tab navigation

    /// Tab selection lives here so any screen (e.g. Dashboard cards) can
    /// switch tabs and preselect an item in that tab's split view.
    var selectedTab: TabSection = .dashboard
    /// Selection for the Episodes split view (iPad regular width).
    var selectedEpisodeId: String?
    /// Selection for the Medications split view (iPad regular width).
    var selectedMedicationId: String?

    /// Switch to the Episodes tab with the given episode selected.
    func showEpisode(_ episodeId: String) {
        selectedEpisodeId = episodeId
        selectedTab = .episodes
    }

    /// Switch to the Medications tab with the given medication selected.
    func showMedication(_ medicationId: String) {
        selectedMedicationId = medicationId
        selectedTab = .medications
    }

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

        if arguments.contains("--load-screenshot-data") {
            resetForUITesting()
            UserDefaults.standard.set(true, forKey: onboardingKey)
            self.isOnboardingComplete = true
            self.onboardingSetByUITesting = true
            loadScreenshotData()
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

    /// Loads a richer dataset for App Store screenshot generation: 90 days of episodes,
    /// daily statuses, medication doses, and a calendar overlay so every screen has
    /// realistic-looking content. Distinct from `loadFixtureData()` to keep
    /// existing UI tests stable.
    // swiftlint:disable:next function_body_length
    private func loadScreenshotData() {
        let db = DatabaseManager.shared
        let now = TimestampHelper.now
        let cal = Calendar.current

        do {
            try db.dbQueue.write { database in
                // --- Medications (generic names throughout) ---
                let erenumabId = "screenshot-med-erenumab"
                try database.execute(sql: """
                    INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, default_quantity, schedule_frequency, active, category, created_at, updated_at)
                    VALUES (?, 'Erenumab', 'preventative', 70.0, 'mg', 1.0, 'monthly', 1, 'cgrp', ?, ?)
                    """, arguments: [erenumabId, now, now])
                try database.execute(sql: """
                    INSERT INTO medication_schedules (id, medication_id, time, timezone, dosage, enabled, reminder_enabled)
                    VALUES (?, ?, '08:00', ?, 1.0, 1, 1)
                    """, arguments: ["screenshot-sched-erenumab", erenumabId, TimeZone.current.identifier])

                let magnesiumId = "screenshot-med-magnesium"
                try database.execute(sql: """
                    INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, default_quantity, schedule_frequency, active, category, created_at, updated_at)
                    VALUES (?, 'Magnesium Glycinate', 'preventative', 400.0, 'mg', 1.0, 'daily', 1, 'supplement', ?, ?)
                    """, arguments: [magnesiumId, now, now])
                try database.execute(sql: """
                    INSERT INTO medication_schedules (id, medication_id, time, timezone, dosage, enabled, reminder_enabled)
                    VALUES (?, ?, '21:00', ?, 1.0, 1, 1)
                    """, arguments: ["screenshot-sched-magnesium", magnesiumId, TimeZone.current.identifier])

                let sumatriptanId = "screenshot-med-sumatriptan"
                try database.execute(sql: """
                    INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, default_quantity, active, category, min_interval_hours, created_at, updated_at)
                    VALUES (?, 'Sumatriptan', 'rescue', 100.0, 'mg', 1.0, 1, 'triptan', 2.0, ?, ?)
                    """, arguments: [sumatriptanId, now, now])

                let ibuprofenId = "screenshot-med-ibuprofen"
                try database.execute(sql: """
                    INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, default_quantity, active, category, min_interval_hours, created_at, updated_at)
                    VALUES (?, 'Ibuprofen', 'rescue', 400.0, 'mg', 2.0, 1, 'nsaid', 6.0, ?, ?)
                    """, arguments: [ibuprofenId, now, now])

                // --- Closed historical episodes spread over the last ~80 days ---
                // Tuples: (daysAgo, durationHours, peakIntensity, symptoms JSON, triggers JSON, locations JSON, notes)
                // swiftlint:disable:next large_tuple
                let episodes: [(Int, Double, Double, String, String, String, String)] = [
                    (78, 6.0, 8.0, "[\"nausea\",\"photophobia\"]", "[\"weather\"]", "[\"left_temple\"]", "Storm front rolling in."),
                    (71, 4.5, 6.0, "[\"photophobia\"]", "[\"sleep\"]", "[\"forehead\"]", "Slept 5 hours, woke up with it."),
                    (62, 7.0, 9.0, "[\"nausea\",\"photophobia\",\"phonophobia\"]", "[\"stress\"]", "[\"right_temple\",\"right_eye\"]", "Bad week at work."),
                    (54, 3.0, 5.0, "[\"nausea\"]", "[\"food\"]", "[\"forehead\"]", ""),
                    (45, 5.5, 7.0, "[\"photophobia\"]", "[\"weather\",\"stress\"]", "[\"left_temple\",\"left_eye\"]", "Heat wave."),
                    (38, 4.0, 6.0, "[\"nausea\"]", "[\"hormonal\"]", "[\"forehead\",\"right_temple\"]", ""),
                    (30, 8.0, 9.0, "[\"nausea\",\"photophobia\",\"phonophobia\"]", "[\"stress\",\"sleep\"]", "[\"right_temple\",\"right_eye\",\"neck\"]", "Worst this month."),
                    (24, 2.5, 4.0, "[]", "[\"food\"]", "[\"forehead\"]", "Caught it early."),
                    (17, 6.0, 7.0, "[\"photophobia\"]", "[\"weather\"]", "[\"left_temple\"]", ""),
                    (11, 4.0, 6.0, "[\"nausea\"]", "[\"stress\"]", "[\"forehead\",\"left_temple\"]", "Long meeting day."),
                    (5, 5.0, 7.0, "[\"photophobia\",\"phonophobia\"]", "[\"sleep\"]", "[\"right_temple\"]", ""),
                    (2, 3.5, 5.0, "[\"nausea\"]", "[\"food\"]", "[\"forehead\"]", "Skipped lunch.")
                ]

                for (idx, ep) in episodes.enumerated() {
                    let (daysAgo, durationHours, peak, symptoms, triggers, locations, notes) = ep
                    let day = cal.date(byAdding: .day, value: -daysAgo, to: Date())!
                    let startOfDay = cal.startOfDay(for: day)
                    let startHour = 9 + (idx % 6) // vary start time 9am-2pm
                    let episodeStart = startOfDay.addingTimeInterval(Double(startHour) * 3600)
                    let episodeEnd = episodeStart.addingTimeInterval(durationHours * 3600)
                    let startMs = TimestampHelper.fromDate(episodeStart)
                    let endMs = TimestampHelper.fromDate(episodeEnd)
                    let episodeId = "screenshot-episode-\(daysAgo)"
                    let notesValue: String? = notes.isEmpty ? nil : notes

                    try database.execute(sql: """
                        INSERT INTO episodes (id, start_time, end_time, locations, qualities, symptoms, triggers, notes, created_at, updated_at)
                        VALUES (?, ?, ?, ?, '[\"throbbing\"]', ?, ?, ?, ?, ?)
                        """, arguments: [episodeId, startMs, endMs, locations, symptoms, triggers, notesValue, startMs, endMs])

                    // Intensity readings spread across the episode: rise → peak → fall
                    let durationMs = Int64(durationHours * 3_600_000)
                    let r1Time = startMs + durationMs / 5            // 20% in
                    let peakTime = startMs + (durationMs * 11 / 20)  // 55% in (peak)
                    let r3Time = startMs + (durationMs * 17 / 20)    // 85% in
                    let r1 = max(2.0, peak - 4.0)
                    let r2 = peak
                    let r3 = max(1.0, peak - 5.0)
                    try database.execute(sql: """
                        INSERT INTO intensity_readings (id, episode_id, timestamp, intensity, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """, arguments: ["\(episodeId)-r1", episodeId, r1Time, r1, r1Time, r1Time])
                    try database.execute(sql: """
                        INSERT INTO intensity_readings (id, episode_id, timestamp, intensity, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """, arguments: ["\(episodeId)-r2", episodeId, peakTime, r2, peakTime, peakTime])
                    try database.execute(sql: """
                        INSERT INTO intensity_readings (id, episode_id, timestamp, intensity, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """, arguments: ["\(episodeId)-r3", episodeId, r3Time, r3, r3Time, r3Time])

                    // Rescue dose for moderate+ episodes, ~30% into the episode
                    if peak >= 6.0 {
                        let doseTime = startMs + (durationMs * 3 / 10)
                        let doseMed = peak >= 7.0 ? sumatriptanId : ibuprofenId
                        let doseAmount: Double = peak >= 7.0 ? 100.0 : 400.0
                        let doseUnit = "mg"
                        try database.execute(sql: """
                            INSERT INTO medication_doses (id, medication_id, timestamp, quantity, dosage_amount, dosage_unit, status, episode_id, effectiveness_rating, created_at, updated_at)
                            VALUES (?, ?, ?, 1.0, ?, ?, 'taken', ?, ?, ?, ?)
                            """, arguments: ["\(episodeId)-dose", doseMed, doseTime, doseAmount, doseUnit, episodeId, 7.0, doseTime, doseTime])
                    }
                }

                // --- Active episode: started 2 hours ago, no end_time ---
                let activeStart = Date().addingTimeInterval(-2 * 3600)
                let activeStartMs = TimestampHelper.fromDate(activeStart)
                let activeId = "screenshot-episode-active"
                try database.execute(sql: """
                    INSERT INTO episodes (id, start_time, locations, qualities, symptoms, triggers, notes, created_at, updated_at)
                    VALUES (?, ?, '[\"left_temple\",\"left_eye\"]', '[\"throbbing\"]', '[\"photophobia\"]', '[\"weather\"]', 'Started after lunch.', ?, ?)
                    """, arguments: [activeId, activeStartMs, activeStartMs, activeStartMs])
                let activeMidMs = activeStartMs + 3600 * 1000
                try database.execute(sql: """
                    INSERT INTO intensity_readings (id, episode_id, timestamp, intensity, created_at, updated_at)
                    VALUES (?, ?, ?, 4.0, ?, ?)
                    """, arguments: ["\(activeId)-r1", activeId, activeStartMs, activeStartMs, activeStartMs])
                try database.execute(sql: """
                    INSERT INTO intensity_readings (id, episode_id, timestamp, intensity, created_at, updated_at)
                    VALUES (?, ?, ?, 6.0, ?, ?)
                    """, arguments: ["\(activeId)-r2", activeId, activeMidMs, activeMidMs, activeMidMs])
                try database.execute(sql: """
                    INSERT INTO medication_doses (id, medication_id, timestamp, quantity, dosage_amount, dosage_unit, status, episode_id, created_at, updated_at)
                    VALUES (?, ?, ?, 1.0, 100.0, 'mg', 'taken', ?, ?, ?)
                    """, arguments: ["\(activeId)-dose", sumatriptanId, activeMidMs, activeId, activeMidMs, activeMidMs])

                // --- Daily status logs covering the last 90 days ---
                // Episode days are 'red'; a few yellow prodrome/postdrome days; the rest 'green'.
                let redDays = Set(episodes.map { $0.0 })
                let postdromeDays = Set(episodes.map { $0.0 - 1 }.filter { $0 > 0 })
                let prodromeDays: Set<Int> = [13, 26, 41, 73]
                for daysAgo in 1...90 {
                    let date = cal.date(byAdding: .day, value: -daysAgo, to: Date())!
                    let dateStr = TimestampHelper.dateString(from: date)
                    let status: String
                    let statusType: String?
                    if redDays.contains(daysAgo) {
                        status = "red"
                        statusType = nil
                    } else if postdromeDays.contains(daysAgo) {
                        status = "yellow"
                        statusType = "postdrome"
                    } else if prodromeDays.contains(daysAgo) {
                        status = "yellow"
                        statusType = "prodrome"
                    } else {
                        status = "green"
                        statusType = nil
                    }
                    try database.execute(sql: """
                        INSERT INTO daily_status_logs (id, date, status, status_type, prompted, created_at, updated_at)
                        VALUES (?, ?, ?, ?, 1, ?, ?)
                        """, arguments: ["screenshot-status-\(daysAgo)", dateStr, status, statusType, now, now])
                }

                // --- Calendar overlay (e.g. travel) ---
                let overlayStart = cal.date(byAdding: .day, value: -50, to: Date())!
                let overlayEnd = cal.date(byAdding: .day, value: -43, to: Date())!
                try database.execute(sql: """
                    INSERT INTO calendar_overlays (id, start_date, end_date, label, exclude_from_stats, created_at, updated_at)
                    VALUES (?, ?, ?, 'Vacation', 0, ?, ?)
                    """, arguments: [
                        "screenshot-overlay-vacation",
                        TimestampHelper.dateString(from: overlayStart),
                        TimestampHelper.dateString(from: overlayEnd),
                        now, now
                    ])

                // --- Routine doses ---
                // Erenumab: monthly 70mg injection at 8am, last 3 months
                for monthsAgo in 1...3 {
                    let date = cal.date(byAdding: .month, value: -monthsAgo, to: Date())!
                    let morning = cal.startOfDay(for: date).addingTimeInterval(8 * 3600)
                    let mMs = TimestampHelper.fromDate(morning)
                    try database.execute(sql: """
                        INSERT INTO medication_doses (id, medication_id, timestamp, quantity, dosage_amount, dosage_unit, status, created_at, updated_at)
                        VALUES (?, ?, ?, 1.0, 70.0, 'mg', 'taken', ?, ?)
                        """, arguments: ["screenshot-dose-eren-\(monthsAgo)", erenumabId, mMs, mMs, mMs])
                }
                // Magnesium: nightly 400mg, last 30 days
                for daysAgo in 1...30 {
                    let date = cal.date(byAdding: .day, value: -daysAgo, to: Date())!
                    let evening = cal.startOfDay(for: date).addingTimeInterval(21 * 3600)
                    let eMs = TimestampHelper.fromDate(evening)
                    try database.execute(sql: """
                        INSERT INTO medication_doses (id, medication_id, timestamp, quantity, dosage_amount, dosage_unit, status, created_at, updated_at)
                        VALUES (?, ?, ?, 1.0, 400.0, 'mg', 'taken', ?, ?)
                        """, arguments: ["screenshot-dose-mag-\(daysAgo)", magnesiumId, eMs, eMs, eMs])
                }
            }
        } catch {
            print("UI Testing: Failed to load screenshot data: \(error)")
        }
    }
}
