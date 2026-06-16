import Foundation
import Observation

/// Per-medication notification override settings.
struct MedicationNotificationOverride: Equatable, Codable, Identifiable {
    let medicationId: String
    var enabled: Bool
    var timeSensitive: Bool
    var followUpDelay: Int // minutes

    var id: String { medicationId }
}

@Observable
final class NotificationSettingsViewModel {
    // MARK: - State

    var notificationsEnabled: Bool = true
    var timeSensitiveEnabled: Bool = false
    var followUpDelay: Int = 30 // minutes
    var criticalAlertsEnabled: Bool = false
    var liveActivitiesEnabled: Bool = true
    var showMedicationNames: Bool = true
    var dailyCheckinEnabled: Bool = true
    var dailyCheckinTime: Date = {
        var components = DateComponents()
        components.hour = 9
        components.minute = 0
        return Calendar.current.date(from: components) ?? Date()
    }()
    var medicationOverrides: [MedicationNotificationOverride] = []
    var error: String?

    // MARK: - UserDefaults Keys

    private enum Keys {
        static let notificationsEnabled = "notifications_enabled"
        static let timeSensitiveEnabled = "notification_time_sensitive_enabled"
        static let followUpDelay = "notification_follow_up_delay"
        static let criticalAlertsEnabled = "notification_critical_alerts_enabled"
        static let liveActivitiesEnabled = "live_activities_enabled"
        static let medicationOverrides = "notification_medication_overrides"
        static let showMedicationNames = "notification_show_medication_names"
        static let dailyCheckinEnabled = "daily_checkin_enabled"
        static let dailyCheckinTime = "daily_checkin_time"
    }

    // MARK: - Dependencies

    private let defaults: UserDefaults
    private let dailyCheckinService: DailyCheckinNotificationServiceProtocol
    private let notificationService: NotificationServiceProtocol
    private let medicationNotificationService: MedicationNotificationServiceProtocol?
    private let liveActivityManager: LiveActivityManaging

    // MARK: - Init

    init(
        defaults: UserDefaults = .standard,
        dailyCheckinService: DailyCheckinNotificationServiceProtocol = DailyCheckinNotificationService(
            notificationService: NotificationService.shared,
            scheduledNotificationRepo: ScheduledNotificationRepository(dbManager: DatabaseManager.shared),
            episodeRepo: EpisodeRepository(dbManager: DatabaseManager.shared),
            dailyStatusRepo: DailyStatusRepository(dbManager: DatabaseManager.shared)
        ),
        notificationService: NotificationServiceProtocol = NotificationService.shared,
        medicationNotificationService: MedicationNotificationServiceProtocol? = MedicationNotificationScheduler(
            notificationService: NotificationService.shared,
            scheduledNotificationRepo: ScheduledNotificationRepository(dbManager: DatabaseManager.shared),
            medicationRepo: MedicationRepository(dbManager: DatabaseManager.shared)
        ),
        liveActivityManager: LiveActivityManaging = LiveActivityManager.shared
    ) {
        self.defaults = defaults
        self.dailyCheckinService = dailyCheckinService
        self.notificationService = notificationService
        self.medicationNotificationService = medicationNotificationService
        self.liveActivityManager = liveActivityManager
    }

    // MARK: - Actions

    func loadSettings() {
        notificationsEnabled = defaults.object(forKey: Keys.notificationsEnabled) as? Bool ?? true
        timeSensitiveEnabled = defaults.bool(forKey: Keys.timeSensitiveEnabled)
        followUpDelay = defaults.object(forKey: Keys.followUpDelay) as? Int ?? 30
        criticalAlertsEnabled = defaults.bool(forKey: Keys.criticalAlertsEnabled)
        liveActivitiesEnabled = defaults.object(forKey: Keys.liveActivitiesEnabled) as? Bool ?? true
        showMedicationNames = defaults.object(forKey: Keys.showMedicationNames) as? Bool ?? true
        dailyCheckinEnabled = defaults.object(forKey: Keys.dailyCheckinEnabled) as? Bool ?? true

        if let timeInterval = defaults.object(forKey: Keys.dailyCheckinTime) as? TimeInterval {
            dailyCheckinTime = Date(timeIntervalSinceReferenceDate: timeInterval)
        }

        if let data = defaults.data(forKey: Keys.medicationOverrides),
           let overrides = try? JSONDecoder().decode([MedicationNotificationOverride].self, from: data) {
            medicationOverrides = overrides
        }
    }

    /// Persist all current settings to UserDefaults.
    func saveSettings() {
        defaults.set(notificationsEnabled, forKey: Keys.notificationsEnabled)
        defaults.set(timeSensitiveEnabled, forKey: Keys.timeSensitiveEnabled)
        defaults.set(followUpDelay, forKey: Keys.followUpDelay)
        defaults.set(criticalAlertsEnabled, forKey: Keys.criticalAlertsEnabled)
        defaults.set(liveActivitiesEnabled, forKey: Keys.liveActivitiesEnabled)
        defaults.set(showMedicationNames, forKey: Keys.showMedicationNames)
        defaults.set(dailyCheckinEnabled, forKey: Keys.dailyCheckinEnabled)
        defaults.set(dailyCheckinTime.timeIntervalSinceReferenceDate, forKey: Keys.dailyCheckinTime)
        persistMedicationOverrides()
    }

    /// Update daily check-in notification scheduling based on current settings.
    /// Call this after changing dailyCheckinEnabled or dailyCheckinTime.
    @MainActor
    func syncDailyCheckinNotification() async {
        if dailyCheckinEnabled && notificationsEnabled {
            do {
                // Request permission first if needed
                _ = await notificationService.requestPermission()
                try await dailyCheckinService.scheduleNotifications()
            } catch {
                self.error = error.localizedDescription
                AppLogger.shared.error("Failed to schedule daily check-in", error: error)
            }
        } else {
            await dailyCheckinService.cancelAll()
        }
    }

    func updateGlobalSettings(
        timeSensitive: Bool? = nil,
        followUpDelay: Int? = nil,
        criticalAlerts: Bool? = nil
    ) {
        if let value = timeSensitive {
            self.timeSensitiveEnabled = value
            defaults.set(value, forKey: Keys.timeSensitiveEnabled)
        }
        if let value = followUpDelay {
            self.followUpDelay = value
            defaults.set(value, forKey: Keys.followUpDelay)
        }
        if let value = criticalAlerts {
            self.criticalAlertsEnabled = value
            defaults.set(value, forKey: Keys.criticalAlertsEnabled)
        }

        // Reschedule medication notifications when settings change
        Task {
            await syncMedicationNotifications()
        }
    }

    /// Reschedule all medication notifications when settings change.
    /// rescheduleAll cancels everything first, then re-schedules based on current active meds.
    @MainActor
    func syncMedicationNotifications() async {
        do {
            try await medicationNotificationService?.rescheduleAllMedicationNotifications()
        } catch {
            AppLogger.shared.error("Failed to reschedule medication notifications after settings change", error: error)
        }
    }

    /// Apply a medication-notification setting change: re-request permission (in case the
    /// user just enabled critical alerts or time-sensitive, which require explicit auth)
    /// and reschedule all medication notifications so the new interruption level / sound
    /// is reflected in pending notifications.
    @MainActor
    func applyMedicationNotificationSettingChange() async {
        _ = await notificationService.requestPermission()
        await syncMedicationNotifications()
    }

    /// Apply a change to the Live Activities setting. Turning it off ends any
    /// running episode activity immediately; turning it on does nothing now (the
    /// next episode starts one). Call after `liveActivitiesEnabled` changes.
    func applyLiveActivitiesSettingChange() {
        if !liveActivitiesEnabled {
            liveActivityManager.endAll()
        }
    }

    func updateMedicationSettings(_ override: MedicationNotificationOverride) {
        if let index = medicationOverrides.firstIndex(where: { $0.medicationId == override.medicationId }) {
            medicationOverrides[index] = override
        } else {
            medicationOverrides.append(override)
        }
        persistMedicationOverrides()
    }

    func removeMedicationSettings(medicationId: String) {
        medicationOverrides.removeAll { $0.medicationId == medicationId }
        persistMedicationOverrides()
    }

    // MARK: - Private

    private func persistMedicationOverrides() {
        if let data = try? JSONEncoder().encode(medicationOverrides) {
            defaults.set(data, forKey: Keys.medicationOverrides)
        }
    }
}
