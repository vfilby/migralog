import SwiftUI
import UIKit
import UserNotifications

@main
struct MigraLogApp: App {
    /// Owns the shared `SyncService` and registers the background-refresh task before the
    /// app finishes launching (BGTaskScheduler requires registration at launch — #462).
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var appState = AppState()
    @AppStorage("selectedTheme") private var selectedTheme: ThemePreference = .system

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
                .preferredColorScheme(selectedTheme.colorScheme)
                .task {
                    await reconciliationService.reconcile()
                    await medicationNotificationService.topUp()
                    try? await dailyCheckinService.scheduleNotifications()
                    await timezoneChangeService.checkForChange()
                    // Note: the active-episode Live Activity is reconciled from
                    // ContentView's `.active` scene-phase handler, not here — a
                    // launch-time `.task` runs before the scene is foreground and
                    // ActivityKit rejects `Activity.request()` with a `visibility`
                    // error if the app isn't yet active.
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
        // If we cold-launched in the BFU window onto the in-memory fallback, the
        // device may already be unlocked by now; reopen the real on-disk DB and
        // make the Class C protection class explicit on the file (#527). No-op
        // when already on disk or when protected data is still unavailable.
        DatabaseManager.shared.reopenOnDiskDatabaseIfNeeded()
        return true
    }

    /// Protected data became available (device unlocked for the first time after
    /// boot). Reopen the real on-disk database if we fell back to in-memory during
    /// the BFU window, so deferred writes and sync resume against persistent
    /// storage rather than the throwaway in-memory DB (#527).
    func applicationProtectedDataDidBecomeAvailable(_ application: UIApplication) {
        DatabaseManager.shared.reopenOnDiskDatabaseIfNeeded()
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

    /// When set, the Trends tab should open on this section instead of its
    /// default Calendar view (e.g. the "See your trends" tip deep-links to
    /// Insights). The Trends screens consume and clear it so it fires once.
    var pendingAnalyticsSection: AnalyticsSection?

    /// A surface an open Episode Detail should present once it loads, set when a
    /// Live Activity deep link asks for more than just opening the episode
    /// (log a rescue med, log intensity, or end the episode). `EpisodeDetailScreen`
    /// consumes and clears this so it fires once per link.
    var pendingEpisodeAction: PendingEpisodeAction?

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

    /// Switch to the Trends tab, optionally opening on a specific section
    /// (e.g. `.insights`) rather than the default Calendar view.
    func showTrends(section: AnalyticsSection? = nil) {
        pendingAnalyticsSection = section
        selectedTab = .trends
    }

    // MARK: - Deep links

    /// Route an incoming `migralog://` URL (from a Live Activity quick action).
    /// Non-`migralog` or malformed URLs are ignored. Every recognized target
    /// selects the episode in the Episodes tab; sub-actions additionally queue a
    /// surface for `EpisodeDetailScreen` to present.
    func handle(url: URL) {
        guard let target = DeepLinkParser.parse(url) else { return }
        route(to: target)
    }

    /// Apply a parsed deep-link target to navigation state. Split out from
    /// `handle(url:)` so tests can exercise routing without constructing URLs.
    func route(to target: DeepLinkTarget) {
        showEpisode(target.episodeId)
        switch target {
        case .openEpisode:
            pendingEpisodeAction = nil
        case .logRescueMed:
            pendingEpisodeAction = .logMedication
        case .logIntensity:
            pendingEpisodeAction = .logIntensity
        case .endEpisode:
            pendingEpisodeAction = .endConfirm
        }
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

                // Create rescue medication: Test Ibuprofen (400mg, as needed).
                // Categorized (otc) so category safety-rule UI tests have a medication
                // to list in the rule editor's inclusion checklist.
                let ibuId = "fixture-med-ibuprofen"
                try database.execute(sql: """
                    INSERT INTO medications (id, name, type, dosage_amount, dosage_unit, default_quantity, active, category, created_at, updated_at)
                    VALUES (?, 'Test Ibuprofen', 'rescue', 400.0, 'mg', 1.0, 1, 'otc', ?, ?)
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
    /// existing UI tests stable. Shares its dataset with the in-app "Load Sample
    /// Data" tool via `SampleDataLoader`.
    private func loadScreenshotData() {
        do {
            try SampleDataLoader.load()
        } catch {
            print("UI Testing: Failed to load screenshot data: \(error)")
        }
    }
}
