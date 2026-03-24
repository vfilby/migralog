import Foundation
import UserNotifications

// MARK: - Protocol

protocol DailyCheckinNotificationServiceProtocol: Sendable {
    func scheduleNotifications() async throws
    func cancelAll() async
    func cancelForDate(_ date: String) async
    func topUp() async
    func isScheduled() async -> Bool
}

// MARK: - Implementation

final class DailyCheckinNotificationService: DailyCheckinNotificationServiceProtocol {
    static let scheduleDaysAhead = 14

    private let notificationService: NotificationServiceProtocol
    private let scheduledNotificationRepo: ScheduledNotificationRepositoryProtocol
    private let episodeRepo: EpisodeRepositoryProtocol
    private let dailyStatusRepo: DailyStatusRepositoryProtocol
    private let logger = AppLogger.shared

    init(
        notificationService: NotificationServiceProtocol,
        scheduledNotificationRepo: ScheduledNotificationRepositoryProtocol,
        episodeRepo: EpisodeRepositoryProtocol,
        dailyStatusRepo: DailyStatusRepositoryProtocol
    ) {
        self.notificationService = notificationService
        self.scheduledNotificationRepo = scheduledNotificationRepo
        self.episodeRepo = episodeRepo
        self.dailyStatusRepo = dailyStatusRepo
    }

    // MARK: - Schedule

    func scheduleNotifications() async throws {
        // 1. Cancel all existing daily check-in notifications
        let pending = await notificationService.getPendingNotifications()
        for request in pending where request.identifier.hasPrefix("daily_checkin_") {
            notificationService.cancelNotification(id: request.identifier)
        }
        do {
            try scheduledNotificationRepo.deleteByEntity(entityType: .dailyCheckin, entityId: "")
        } catch {
            logger.error("Failed to delete existing daily check-in mappings", error: error)
        }

        // 2. Read check-in time from UserDefaults
        let (hour, minute) = readCheckinTime()

        // Check if notifications are enabled
        guard isCheckinEnabled() else {
            logger.info("Daily check-in notifications disabled, skipping schedule")
            return
        }

        // 3. Schedule for each day
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())

        for dayOffset in 0..<Self.scheduleDaysAhead {
            guard let targetDay = calendar.date(byAdding: .day, value: dayOffset, to: today) else { continue }
            let dateString = DateFormatting.dateString(from: targetDay)

            guard let triggerDate = calendar.date(bySettingHour: hour, minute: minute, second: 0, of: targetDay) else { continue }

            // Skip past trigger times
            guard triggerDate > Date() else { continue }

            // Suppression check
            guard !shouldSuppressForDate(dateString) else { continue }

            // Schedule OS notification
            let notificationId = "daily_checkin_\(dateString)"
            let components = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: triggerDate)
            let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)

            do {
                try await notificationService.scheduleNotification(
                    id: notificationId,
                    title: "Daily Check-in",
                    body: "How was your day? Tap to log your daily status.",
                    trigger: trigger,
                    categoryIdentifier: NotificationCategory.dailyCheckin,
                    userInfo: ["type": "daily_checkin", "date": dateString]
                )
            } catch {
                logger.error("Failed to schedule daily check-in for \(dateString)", error: error)
                continue
            }

            // Save DB mapping
            let mapping = ScheduledNotification(
                id: UUID().uuidString,
                medicationId: nil,
                scheduleId: nil,
                date: dateString,
                notificationId: notificationId,
                notificationType: .dailyCheckin,
                isGrouped: false,
                groupKey: nil,
                sourceType: .dailyCheckin,
                medicationName: nil,
                scheduledTriggerTime: "\(hour):\(String(format: "%02d", minute))",
                notificationTitle: "Daily Check-in",
                notificationBody: "How was your day? Tap to log your daily status.",
                categoryIdentifier: NotificationCategory.dailyCheckin,
                createdAt: TimestampHelper.now
            )
            do {
                _ = try scheduledNotificationRepo.createNotification(mapping)
            } catch {
                logger.error("Failed to save daily check-in mapping for \(dateString)", error: error)
            }
        }

        logger.info("Scheduled daily check-in notifications for up to \(Self.scheduleDaysAhead) days")
    }

    // MARK: - Cancel

    func cancelAll() async {
        let pending = await notificationService.getPendingNotifications()
        for request in pending where request.identifier.hasPrefix("daily_checkin_") {
            notificationService.cancelNotification(id: request.identifier)
        }
        do {
            try scheduledNotificationRepo.deleteByEntity(entityType: .dailyCheckin, entityId: "")
        } catch {
            logger.error("Failed to delete daily check-in mappings", error: error)
        }
        logger.info("Cancelled all daily check-in notifications")
    }

    func cancelForDate(_ date: String) async {
        let notificationId = "daily_checkin_\(date)"
        notificationService.cancelNotification(id: notificationId)
        do {
            try scheduledNotificationRepo.deleteByNotificationId(notificationId)
        } catch {
            logger.error("Failed to delete daily check-in mapping for \(date)", error: error)
        }
        logger.debug("Cancelled daily check-in for \(date)")
    }

    // MARK: - Top Up

    func topUp() async {
        // 1. Get existing mappings
        let existingMappings: [ScheduledNotification]
        do {
            existingMappings = try scheduledNotificationRepo.getByEntity(entityType: .dailyCheckin, entityId: "")
        } catch {
            logger.error("Failed to get existing daily check-in mappings", error: error)
            return
        }

        // 2. Build set of already-scheduled date strings
        let scheduledDates = Set(existingMappings.map { $0.date })

        // 3. Read check-in time from UserDefaults
        let (hour, minute) = readCheckinTime()

        // 4. Check if notifications are enabled
        guard isCheckinEnabled() else {
            logger.debug("Daily check-in notifications disabled, skipping top-up")
            return
        }

        // 5. Schedule missing dates
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        var added = 0

        for dayOffset in 0..<Self.scheduleDaysAhead {
            guard let targetDay = calendar.date(byAdding: .day, value: dayOffset, to: today) else { continue }
            let dateString = DateFormatting.dateString(from: targetDay)

            // Skip if already scheduled
            guard !scheduledDates.contains(dateString) else { continue }

            guard let triggerDate = calendar.date(bySettingHour: hour, minute: minute, second: 0, of: targetDay) else { continue }

            // Skip past trigger times
            guard triggerDate > Date() else { continue }

            // Suppression check
            guard !shouldSuppressForDate(dateString) else { continue }

            // Schedule OS notification
            let notificationId = "daily_checkin_\(dateString)"
            let components = calendar.dateComponents([.year, .month, .day, .hour, .minute], from: triggerDate)
            let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)

            do {
                try await notificationService.scheduleNotification(
                    id: notificationId,
                    title: "Daily Check-in",
                    body: "How was your day? Tap to log your daily status.",
                    trigger: trigger,
                    categoryIdentifier: NotificationCategory.dailyCheckin,
                    userInfo: ["type": "daily_checkin", "date": dateString]
                )
            } catch {
                logger.error("Failed to schedule daily check-in for \(dateString)", error: error)
                continue
            }

            // Save DB mapping
            let mapping = ScheduledNotification(
                id: UUID().uuidString,
                medicationId: nil,
                scheduleId: nil,
                date: dateString,
                notificationId: notificationId,
                notificationType: .dailyCheckin,
                isGrouped: false,
                groupKey: nil,
                sourceType: .dailyCheckin,
                medicationName: nil,
                scheduledTriggerTime: "\(hour):\(String(format: "%02d", minute))",
                notificationTitle: "Daily Check-in",
                notificationBody: "How was your day? Tap to log your daily status.",
                categoryIdentifier: NotificationCategory.dailyCheckin,
                createdAt: TimestampHelper.now
            )
            do {
                _ = try scheduledNotificationRepo.createNotification(mapping)
                added += 1
            } catch {
                logger.error("Failed to save daily check-in mapping for \(dateString)", error: error)
            }
        }

        logger.debug("Top-up added \(added) daily check-in notifications")
    }

    // MARK: - Status

    func isScheduled() async -> Bool {
        let pending = await notificationService.getPendingNotifications()
        return pending.contains { $0.identifier.hasPrefix("daily_checkin_") }
    }

    // MARK: - Private Helpers

    private func shouldSuppressForDate(_ date: String) -> Bool {
        do {
            // 1. Active episode = implicit red day
            if let _ = try episodeRepo.getCurrentEpisode() {
                return true
            }

            // 2. Any episode on this date = red day
            if let dateObj = DateFormatting.date(from: date) {
                let startOfDay = Int64(dateObj.timeIntervalSince1970 * 1000)
                let endOfDay = Int64(dateObj.addingTimeInterval(86400).timeIntervalSince1970 * 1000)
                let episodes = try episodeRepo.getEpisodesByDateRange(start: startOfDay, end: endOfDay)
                if !episodes.isEmpty {
                    return true
                }
            }

            // 3. Status already logged
            if let _ = try dailyStatusRepo.getStatusByDate(date) {
                return true
            }

            return false
        } catch {
            // Fail-safe: don't suppress on error (better to show than miss)
            return false
        }
    }

    private func readCheckinTime() -> (hour: Int, minute: Int) {
        let defaults = UserDefaults.standard
        let storedInterval = defaults.double(forKey: "daily_checkin_time")
        if storedInterval > 0 {
            let storedDate = Date(timeIntervalSinceReferenceDate: storedInterval)
            let components = Calendar.current.dateComponents([.hour, .minute], from: storedDate)
            return (components.hour ?? 21, components.minute ?? 0)
        }
        return (21, 0)
    }

    private func isCheckinEnabled() -> Bool {
        let defaults = UserDefaults.standard
        // Default to true if not set
        let checkinEnabled = defaults.object(forKey: "daily_checkin_enabled") as? Bool ?? true
        let notificationsEnabled = defaults.object(forKey: "notifications_enabled") as? Bool ?? true
        return checkinEnabled && notificationsEnabled
    }
}
