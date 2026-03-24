import Foundation
import UserNotifications

// MARK: - Notification Categories

enum NotificationCategory {
    static let medication = "MEDICATION_REMINDER"
    static let multipleMedication = "MULTIPLE_MEDICATION_REMINDER"
    static let dailyCheckin = "DAILY_CHECKIN"
}

enum NotificationAction {
    static let medicationTaken = "MEDICATION_TAKEN"
    static let medicationSkipped = "MEDICATION_SKIPPED"
    static let medicationSnooze = "MEDICATION_SNOOZE"
    static let takeAllNow = "TAKE_ALL_NOW"
    static let skipAll = "SKIP_ALL"
    static let remindLater = "REMIND_LATER"
    static let clearDay = "CLEAR_DAY"
    static let notClear = "NOT_CLEAR"
}

// MARK: - Notification Service Protocol

protocol NotificationServiceProtocol: Sendable {
    func requestPermission() async -> Bool
    func scheduleNotification(
        id: String,
        title: String,
        body: String,
        trigger: UNNotificationTrigger,
        categoryIdentifier: String?,
        userInfo: [String: Any]?
    ) async throws
    func cancelNotification(id: String)
    func cancelAllNotifications()
    func getPendingNotifications() async -> [UNNotificationRequest]
    func getDeliveredNotifications() async -> [UNNotification]
    func removeDeliveredNotification(id: String)
}

// MARK: - Notification Center Protocol (for testability)

protocol NotificationCenterProtocol: Sendable {
    func requestAuthorization(options: UNAuthorizationOptions) async throws -> Bool
    func add(_ request: UNNotificationRequest) async throws
    func removePendingNotificationRequests(withIdentifiers identifiers: [String])
    func removeAllPendingNotificationRequests()
    func pendingNotificationRequests() async -> [UNNotificationRequest]
    func deliveredNotifications() async -> [UNNotification]
    func removeDeliveredNotifications(withIdentifiers identifiers: [String])
    func setNotificationCategories(_ categories: Set<UNNotificationCategory>)
}

extension UNUserNotificationCenter: NotificationCenterProtocol {}

// MARK: - Protocol Default Implementations

extension NotificationServiceProtocol {
    func scheduleNotification(
        id: String,
        title: String,
        body: String,
        trigger: UNNotificationTrigger,
        categoryIdentifier: String?
    ) async throws {
        try await scheduleNotification(id: id, title: title, body: body, trigger: trigger, categoryIdentifier: categoryIdentifier, userInfo: nil)
    }
}

// MARK: - Notification Service

final class NotificationService: NotificationServiceProtocol {
    static let shared = NotificationService()

    private let center: NotificationCenterProtocol
    private let logger = AppLogger.shared

    init(center: NotificationCenterProtocol = UNUserNotificationCenter.current()) {
        self.center = center
        registerCategories()
    }

    // MARK: - Category Registration

    private func registerCategories() {
        let takenAction = UNNotificationAction(
            identifier: NotificationAction.medicationTaken,
            title: "Taken",
            options: []
        )
        let skippedAction = UNNotificationAction(
            identifier: NotificationAction.medicationSkipped,
            title: "Skipped",
            options: []
        )
        let snoozeAction = UNNotificationAction(
            identifier: NotificationAction.medicationSnooze,
            title: "Snooze 10min",
            options: []
        )
        let medicationCategory = UNNotificationCategory(
            identifier: NotificationCategory.medication,
            actions: [takenAction, skippedAction, snoozeAction],
            intentIdentifiers: [],
            options: []
        )

        let takeAllAction = UNNotificationAction(
            identifier: NotificationAction.takeAllNow,
            title: "Take All",
            options: []
        )
        let skipAllAction = UNNotificationAction(
            identifier: NotificationAction.skipAll,
            title: "Skip All",
            options: []
        )
        let remindLaterAction = UNNotificationAction(
            identifier: NotificationAction.remindLater,
            title: "Remind Later",
            options: []
        )
        let multipleMedicationCategory = UNNotificationCategory(
            identifier: NotificationCategory.multipleMedication,
            actions: [takeAllAction, skipAllAction, remindLaterAction],
            intentIdentifiers: [],
            options: []
        )

        let clearDayAction = UNNotificationAction(
            identifier: NotificationAction.clearDay,
            title: "✓ Clear Day",
            options: []
        )
        let notClearAction = UNNotificationAction(
            identifier: NotificationAction.notClear,
            title: "Not Clear",
            options: [.foreground]
        )
        let dailyCheckinCategory = UNNotificationCategory(
            identifier: NotificationCategory.dailyCheckin,
            actions: [clearDayAction, notClearAction],
            intentIdentifiers: [],
            options: []
        )

        center.setNotificationCategories([medicationCategory, multipleMedicationCategory, dailyCheckinCategory])
    }

    // MARK: - Permission

    func requestPermission() async -> Bool {
        do {
            let granted = try await center.requestAuthorization(
                options: [.alert, .sound, .badge]
            )
            logger.info("Notification permission \(granted ? "granted" : "denied")")
            return granted
        } catch {
            logger.error("Failed to request notification permission", error: error)
            return false
        }
    }

    // MARK: - Scheduling

    func scheduleNotification(
        id: String,
        title: String,
        body: String,
        trigger: UNNotificationTrigger,
        categoryIdentifier: String? = nil,
        userInfo: [String: Any]? = nil
    ) async throws {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.userInfo = userInfo ?? [:]
        if let category = categoryIdentifier {
            content.categoryIdentifier = category
        }

        let request = UNNotificationRequest(
            identifier: id,
            content: content,
            trigger: trigger
        )

        try await center.add(request)
        logger.debug("Scheduled notification: \(id)")
    }

    // MARK: - Cancellation

    func cancelNotification(id: String) {
        center.removePendingNotificationRequests(withIdentifiers: [id])
        logger.debug("Cancelled notification: \(id)")
    }

    func cancelAllNotifications() {
        center.removeAllPendingNotificationRequests()
        logger.info("Cancelled all notifications")
    }

    // MARK: - Retrieval

    func getPendingNotifications() async -> [UNNotificationRequest] {
        await center.pendingNotificationRequests()
    }

    func getDeliveredNotifications() async -> [UNNotification] {
        await center.deliveredNotifications()
    }

    func removeDeliveredNotification(id: String) {
        center.removeDeliveredNotifications(withIdentifiers: [id])
        logger.debug("Removed delivered notification: \(id)")
    }
}
