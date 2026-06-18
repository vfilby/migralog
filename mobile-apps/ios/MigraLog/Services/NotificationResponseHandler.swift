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
    private let doseLogger: MedicationDoseLoggerProtocol
    private let logger = AppLogger.shared

    init(
        medicationNotificationService: MedicationNotificationServiceProtocol,
        medicationRepository: MedicationRepositoryProtocol,
        notificationService: NotificationServiceProtocol,
        dailyStatusRepo: DailyStatusRepositoryProtocol,
        dailyCheckinService: DailyCheckinNotificationServiceProtocol,
        doseLogger: MedicationDoseLoggerProtocol? = nil
    ) {
        self.medicationNotificationService = medicationNotificationService
        self.medicationRepository = medicationRepository
        self.notificationService = notificationService
        self.dailyStatusRepo = dailyStatusRepo
        self.dailyCheckinService = dailyCheckinService
        self.doseLogger = doseLogger ?? MedicationDoseLogger(
            medicationRepo: medicationRepository,
            notificationService: medicationNotificationService
        )
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

            // UNUserNotificationCenterDelegate requires the completion handler to
            // be called on the main thread. Invoking it from this unstructured
            // Task would run it off the main actor and trip a UIKit state
            // restoration assertion (see issue #397 / TestFlight 1.0.26 crash).
            await MainActor.run {
                completionHandler()
            }
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
            let logged = await logDoseFromNotification(medicationId: medicationId, status: .taken, scheduleId: scheduleId)
            // Only advance reminder state if the dose actually persisted — when the
            // DB is unavailable (locked device) we deferred, so leave the reminder
            // intact for the re-delivered prompt (#527).
            if logged {
                await medicationNotificationService.handleTakenResponse(medicationId: medicationId, scheduleId: scheduleId)
            }

        case NotificationAction.medicationSkipped:
            let logged = await logDoseFromNotification(medicationId: medicationId, status: .skipped, scheduleId: scheduleId)
            if logged {
                await medicationNotificationService.handleSkippedResponse(medicationId: medicationId, scheduleId: scheduleId)
            }

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
        // BFU guard (#527): refuse to write a clear-day status into the empty
        // in-memory fallback when the device is locked, or it would be silently
        // lost. The check-in reminder remains scheduled so the user is re-prompted.
        if DatabaseManager.isUsingInMemoryFallback {
            logger.warn("Skipping clear-day log from notification: database unavailable (locked device)")
            ErrorLogger.shared.logError(
                DatabaseManager.initializationError
                    ?? DatabaseInitializationError.protectedDataUnavailable(
                        underlying: NSError(domain: "DatabaseManager", code: -1)
                    ),
                context: ["action": "clearDay.deferred", "reason": "inMemoryFallback"]
            )
            return
        }
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
            ErrorLogger.shared.logError(error, context: ["action": "clearDay"])
        }
    }

    // MARK: - Helpers

    /// Persist a dose logged from a notification action.
    ///
    /// Returns `true` when the dose was written, `false` when it was deferred
    /// because the database is unavailable (locked-device in-memory fallback) or
    /// the medication couldn't be found. Callers use the result to avoid advancing
    /// reminder state for a dose that didn't actually land (#527).
    @discardableResult
    func logDoseFromNotification(medicationId: String, status: DoseStatus, scheduleId: String? = nil) async -> Bool {
        // BFU guard: if the on-disk DB couldn't be opened because the device is
        // still locked (boot→first-unlock), the live queue is an empty in-memory
        // fallback. Writing here would "succeed" against a throwaway DB and the
        // dose would be silently lost (#527). Refuse to write so the dose is NOT
        // dropped — re-deliver the action so the user can retry after unlock.
        if DatabaseManager.isUsingInMemoryFallback {
            logger.warn("Skipping dose log from notification: database unavailable (locked device)")
            ErrorLogger.shared.logError(
                DatabaseManager.initializationError
                    ?? DatabaseInitializationError.protectedDataUnavailable(
                        underlying: NSError(domain: "DatabaseManager", code: -1)
                    ),
                context: [
                    "handler": "NotificationResponseHandler",
                    "action": "logDoseFromNotification.deferred",
                    "reason": "inMemoryFallback"
                ]
            )
            await redeliverMissedDoseAction(medicationId: medicationId, scheduleId: scheduleId)
            return false
        }
        do {
            guard let medication = try medicationRepository.getMedicationById(medicationId) else {
                logger.warn("Medication not found for notification response: \(medicationId)")
                return false
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

            _ = try await doseLogger.record(dose)
            logger.info("Dose logged via notification: \(medication.id) - \(status)")

            await MainActor.run {
                NotificationCenter.default.post(name: .medicationDataChanged, object: nil)
            }
            return true
        } catch {
            logger.error("Failed to log dose from notification", error: error)
            ErrorLogger.shared.logError(error, context: [
                "handler": "NotificationResponseHandler",
                "action": "logDoseFromNotification",
                "medicationId": medicationId,
                "status": "\(status)"
            ])
            return false
        }
    }

    /// The database was unavailable (locked device) when a dose action arrived, so the
    /// write was deferred rather than dropped (#527). Re-deliver the medication reminder
    /// a short interval out so the user is prompted again once the device has likely been
    /// unlocked, at which point the on-disk DB is reopened and the dose can be logged.
    /// Best-effort: failure to reschedule is logged, never silently swallowed.
    private func redeliverMissedDoseAction(medicationId: String, scheduleId: String?) async {
        let retryId = "bfu_retry_\(medicationId)_\(UUID().uuidString)"
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 600, repeats: false)
        var userInfo: [String: Any] = ["medicationId": medicationId]
        if let scheduleId { userInfo["scheduleId"] = scheduleId }
        do {
            try await notificationService.scheduleNotification(
                id: retryId,
                title: "Reminder",
                body: "Tap to log your medication.",
                trigger: trigger,
                categoryIdentifier: NotificationCategory.medication,
                userInfo: userInfo
            )
            logger.info("Re-delivered deferred medication reminder after locked-device defer")
        } catch {
            logger.error("Failed to re-deliver deferred medication reminder", error: error)
            ErrorLogger.shared.logError(error, context: [
                "handler": "NotificationResponseHandler",
                "action": "redeliverMissedDoseAction"
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
