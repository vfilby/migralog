import Foundation
import UserNotifications

/// Handles user responses to notifications (e.g., tapping "Taken" or "Skipped" on medication reminders).
/// Implements UNUserNotificationCenterDelegate and is set as the delegate on app launch.
final class NotificationResponseHandler: NSObject, UNUserNotificationCenterDelegate {
    private let medicationNotificationService: MedicationNotificationServiceProtocol
    private let medicationRepository: MedicationRepositoryProtocol
    private let notificationService: NotificationServiceProtocol
    private let dailyStatusRepo: DailyStatusRepositoryProtocol
    private let dailyCheckinService: DailyCheckinNotificationServiceProtocol
    private let logger = AppLogger.shared

    init(
        medicationNotificationService: MedicationNotificationServiceProtocol,
        medicationRepository: MedicationRepositoryProtocol,
        notificationService: NotificationServiceProtocol,
        dailyStatusRepo: DailyStatusRepositoryProtocol,
        dailyCheckinService: DailyCheckinNotificationServiceProtocol
    ) {
        self.medicationNotificationService = medicationNotificationService
        self.medicationRepository = medicationRepository
        self.notificationService = notificationService
        self.dailyStatusRepo = dailyStatusRepo
        self.dailyCheckinService = dailyCheckinService
        super.init()
    }

    // MARK: - UNUserNotificationCenterDelegate

    /// Called when the user interacts with a notification (taps it or selects an action).
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let content = response.notification.request.content
        let categoryIdentifier = content.categoryIdentifier
        let actionIdentifier = response.actionIdentifier
        let userInfo = content.userInfo

        logger.info("Notification response: category=\(categoryIdentifier), action=\(actionIdentifier)")

        Task {
            switch categoryIdentifier {
            case NotificationCategory.medication:
                await handleSingleMedicationResponse(
                    actionIdentifier: actionIdentifier,
                    userInfo: userInfo,
                    content: content
                )

            case NotificationCategory.multipleMedication:
                await handleGroupedMedicationResponse(
                    actionIdentifier: actionIdentifier,
                    userInfo: userInfo,
                    content: content
                )

            case NotificationCategory.dailyCheckin:
                let checkinUserInfo = response.notification.request.content.userInfo
                await handleDailyCheckinResponse(actionIdentifier: actionIdentifier, userInfo: checkinUserInfo)

            default:
                logger.debug("Unhandled notification category: \(categoryIdentifier)")
            }

            completionHandler()
        }
    }

    /// Called when a notification arrives while the app is in the foreground.
    /// Suppresses the notification if the dose has already been logged today.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        let content = notification.request.content
        let shouldShow = shouldShowNotification(
            categoryIdentifier: content.categoryIdentifier,
            userInfo: content.userInfo
        )

        if shouldShow {
            completionHandler([.banner, .sound])
        } else {
            completionHandler([])
        }
    }

    // MARK: - Foreground Suppression Logic

    /// Check if a notification should be suppressed based on current state.
    /// Returns true if the notification should be shown, false if it should be suppressed.
    func shouldShowNotification(categoryIdentifier: String, userInfo: [AnyHashable: Any]) -> Bool {
        do {
            switch categoryIdentifier {
            case NotificationCategory.medication:
                if let medicationId = userInfo["medicationId"] as? String {
                    let today = TimestampHelper.dateString(from: Date())
                    let alreadyLogged = try medicationRepository.wasLoggedForScheduleToday(
                        medicationId: medicationId,
                        date: today
                    )
                    if alreadyLogged {
                        logger.info("Suppressing single medication notification — dose already logged for \(medicationId)")
                        return false
                    }
                }

            case NotificationCategory.multipleMedication:
                if let medicationIds = userInfo["medicationIds"] as? [String], !medicationIds.isEmpty {
                    let today = TimestampHelper.dateString(from: Date())
                    let allLogged = try medicationIds.allSatisfy { medId in
                        try medicationRepository.wasLoggedForScheduleToday(
                            medicationId: medId,
                            date: today
                        )
                    }
                    if allLogged {
                        logger.info("Suppressing grouped medication notification — all doses already logged")
                        return false
                    }
                }

            default:
                break
            }
        } catch {
            // Fail-safe: on any error, show the notification
            logger.error("Error checking suppression, showing notification", error: error)
        }

        return true
    }

    // MARK: - Single Medication Response Handling

    func handleSingleMedicationResponse(
        actionIdentifier: String,
        userInfo: [AnyHashable: Any],
        content: UNNotificationContent? = nil
    ) async {
        guard let medicationId = userInfo["medicationId"] as? String,
              let scheduleId = userInfo["scheduleId"] as? String else {
            logger.warn("Missing medicationId or scheduleId in single medication notification userInfo")
            return
        }

        switch actionIdentifier {
        case NotificationAction.medicationTaken:
            await logDoseFromNotification(medicationId: medicationId, status: .taken)
            await medicationNotificationService.handleTakenResponse(medicationId: medicationId, scheduleId: scheduleId)

        case NotificationAction.medicationSkipped:
            await logDoseFromNotification(medicationId: medicationId, status: .skipped)
            await medicationNotificationService.handleSkippedResponse(medicationId: medicationId, scheduleId: scheduleId)

        case NotificationAction.medicationSnooze:
            if let content = content {
                await scheduleSnoozedNotification(content: content, userInfo: userInfo, category: NotificationCategory.medication)
            } else {
                await scheduleSnoozedNotificationFromUserInfo(userInfo: userInfo, category: NotificationCategory.medication)
            }
            logger.info("Medication snoozed for 10 minutes: \(medicationId)")

        case UNNotificationDefaultActionIdentifier:
            logger.info("Medication notification tapped, opening app for medication: \(medicationId)")

        default:
            logger.debug("Unhandled single medication action: \(actionIdentifier)")
        }
    }

    // MARK: - Grouped Medication Response Handling

    func handleGroupedMedicationResponse(
        actionIdentifier: String,
        userInfo: [AnyHashable: Any],
        content: UNNotificationContent? = nil
    ) async {
        guard let medicationIds = userInfo["medicationIds"] as? [String] else {
            logger.warn("Missing medicationIds in grouped medication notification userInfo")
            return
        }

        switch actionIdentifier {
        case NotificationAction.takeAllNow:
            for medicationId in medicationIds {
                await logDoseFromNotification(medicationId: medicationId, status: .taken)
            }
            logger.info("Logged \(medicationIds.count) medications as taken from grouped notification")

        case NotificationAction.skipAll:
            for medicationId in medicationIds {
                await logDoseFromNotification(medicationId: medicationId, status: .skipped)
            }
            logger.info("Logged \(medicationIds.count) medications as skipped from grouped notification")

        case NotificationAction.remindLater:
            if let content = content {
                await scheduleSnoozedNotification(content: content, userInfo: userInfo, category: NotificationCategory.multipleMedication)
            } else {
                await scheduleSnoozedNotificationFromUserInfo(userInfo: userInfo, category: NotificationCategory.multipleMedication)
            }
            logger.info("Grouped medication reminder snoozed for 10 minutes")

        case UNNotificationDefaultActionIdentifier:
            logger.info("Grouped medication notification tapped, opening app")

        default:
            logger.debug("Unhandled grouped medication action: \(actionIdentifier)")
        }
    }

    // MARK: - Daily Check-in Response Handling

    func handleDailyCheckinResponse(actionIdentifier: String, userInfo: [AnyHashable: Any]) async {
        switch actionIdentifier {
        case NotificationAction.clearDay:
            // Log green status directly from notification
            guard let dateString = userInfo["date"] as? String else {
                logger.warn("No date in daily check-in notification userInfo")
                return
            }
            await logClearDay(date: dateString)

        case NotificationAction.notClear, UNNotificationDefaultActionIdentifier:
            // Opens app to daily status prompt (foreground option handles opening)
            logger.info("Daily check-in: user wants to log details, opening app")

        default:
            logger.debug("Unhandled daily check-in action: \(actionIdentifier)")
        }
    }

    func logClearDay(date: String) async {
        let now = TimestampHelper.now
        let status = DailyStatusLog(
            id: UUID().uuidString,
            date: date,
            status: .green,
            statusType: nil,
            notes: nil,
            prompted: true,
            createdAt: now,
            updatedAt: now
        )
        do {
            _ = try dailyStatusRepo.createStatus(status)
            logger.info("Logged clear day via notification for \(date)")

            // Cancel the notification for this date and top up
            await dailyCheckinService.cancelForDate(date)
            await dailyCheckinService.topUp()

            // Notify UI
            await MainActor.run {
                NotificationCenter.default.post(name: .dailyStatusDataChanged, object: nil)
            }
        } catch {
            logger.error("Failed to log clear day from notification", error: error)
            ErrorLogger.shared.logError(error, context: ["action": "clearDay", "date": date])
        }
    }

    // MARK: - Helpers

    func logDoseFromNotification(medicationId: String, status: DoseStatus) async {
        do {
            guard let medication = try medicationRepository.getMedicationById(medicationId) else {
                logger.warn("Medication not found for notification response: \(medicationId)")
                return
            }

            let now = TimestampHelper.now
            let dose = MedicationDose(
                id: UUID().uuidString,
                medicationId: medicationId,
                timestamp: now,
                quantity: medication.defaultQuantity ?? 1.0,
                dosageAmount: medication.dosageAmount,
                dosageUnit: medication.dosageUnit,
                status: status,
                episodeId: nil,
                effectivenessRating: nil,
                timeToRelief: nil,
                sideEffects: [],
                notes: "Logged via notification",
                createdAt: now,
                updatedAt: now
            )

            _ = try medicationRepository.createDose(dose)
            logger.info("Dose logged via notification: \(medication.name) - \(status)")

            await MainActor.run {
                NotificationCenter.default.post(name: .medicationDataChanged, object: nil)
            }
        } catch {
            logger.error("Failed to log dose from notification", error: error)
            ErrorLogger.shared.logError(error, context: [
                "handler": "NotificationResponseHandler",
                "action": "logDoseFromNotification",
                "medicationId": medicationId,
                "status": "\(status)"
            ])
        }
    }

    /// Schedules a snoozed notification for 10 minutes from now with the same content and userInfo.
    func scheduleSnoozedNotification(
        content: UNNotificationContent,
        userInfo: [AnyHashable: Any],
        category: String
    ) async {
        let snoozeId = "snooze_\(UUID().uuidString)"
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 600, repeats: false)

        // Convert userInfo to [String: Any] for the notification service
        var stringUserInfo: [String: Any] = [:]
        for (key, value) in userInfo {
            if let stringKey = key as? String {
                stringUserInfo[stringKey] = value
            }
        }

        do {
            try await notificationService.scheduleNotification(
                id: snoozeId,
                title: content.title,
                body: content.body,
                trigger: trigger,
                categoryIdentifier: category,
                userInfo: stringUserInfo
            )
        } catch {
            logger.error("Failed to schedule snoozed notification", error: error)
            ErrorLogger.shared.logError(error, context: [
                "handler": "NotificationResponseHandler",
                "action": "scheduleSnoozedNotification",
                "category": category
            ])
        }
    }

    /// Schedules a snoozed notification from userInfo only (when UNNotificationContent is not available, e.g., in tests).
    func scheduleSnoozedNotificationFromUserInfo(
        userInfo: [AnyHashable: Any],
        category: String
    ) async {
        let snoozeId = "snooze_\(UUID().uuidString)"
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 600, repeats: false)

        var stringUserInfo: [String: Any] = [:]
        for (key, value) in userInfo {
            if let stringKey = key as? String {
                stringUserInfo[stringKey] = value
            }
        }

        let title = userInfo["title"] as? String ?? "Reminder"
        let body = userInfo["body"] as? String ?? ""

        do {
            try await notificationService.scheduleNotification(
                id: snoozeId,
                title: title,
                body: body,
                trigger: trigger,
                categoryIdentifier: category,
                userInfo: stringUserInfo
            )
        } catch {
            logger.error("Failed to schedule snoozed notification", error: error)
            ErrorLogger.shared.logError(error, context: [
                "handler": "NotificationResponseHandler",
                "action": "scheduleSnoozedNotificationFromUserInfo",
                "category": category
            ])
        }
    }
}
