import Foundation
import UserNotifications

// MARK: - Protocol

protocol DoseCheckinNotificationServiceProtocol: Sendable {
    /// Schedule a "how are you feeling?" check-in for a just-logged dose, when
    /// eligible. Best-effort: never throws, so dose logging can't fail because
    /// a notification couldn't be scheduled.
    func scheduleCheckin(for dose: MedicationDose) async
    /// Cancel any pending or delivered check-ins tied to the episode (e.g. when
    /// it ends — the outcome is known, so the prompt is stale).
    func cancelCheckins(forEpisodeId episodeId: String) async
}

// MARK: - Implementation

/// Beta (`FeatureFlags.doseCheckin`): 2 hours after a rescue dose is taken
/// during an episode, prompt the user to log an update. Two hours is the
/// standard clinical marker for acute treatment response, and the prompted
/// intensity reading feeds the derived time-to-relief in
/// `AnalyticsInsights.medicationEffectiveness` — no new data model needed.
///
/// At most one check-in is pending per episode: a newer dose resets the
/// 2-hour clock, since response is measured from the most recent treatment.
/// State lives entirely in the notification center (deterministic IDs +
/// `userInfo`), so unlike the reminder pipeline there is no DB bookkeeping.
final class DoseCheckinNotificationService: DoseCheckinNotificationServiceProtocol {
    static let idPrefix = "dose_checkin_"
    static let checkinDelay: TimeInterval = 2 * 60 * 60

    private let notificationService: NotificationServiceProtocol
    private let medicationRepo: MedicationRepositoryProtocol
    private let logger = AppLogger.shared

    init(
        notificationService: NotificationServiceProtocol,
        medicationRepo: MedicationRepositoryProtocol
    ) {
        self.notificationService = notificationService
        self.medicationRepo = medicationRepo
    }

    func scheduleCheckin(for dose: MedicationDose) async {
        guard FeatureFlags.isEnabled(.doseCheckin), notificationsEnabled() else { return }
        guard dose.status == .taken, let episodeId = dose.episodeId else { return }
        guard let medication = try? medicationRepo.getMedicationById(dose.medicationId),
              medication.type == .rescue else { return }

        // A newer dose supersedes any earlier pending check-in for the episode.
        await cancelPendingCheckins(forEpisodeId: episodeId)

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: Self.checkinDelay, repeats: false)
        do {
            try await notificationService.scheduleNotification(
                id: Self.idPrefix + dose.id,
                title: "How are you feeling?",
                body: "It's been 2 hours since your medication. Tap to log an update.",
                trigger: trigger,
                categoryIdentifier: NotificationCategory.doseCheckin,
                userInfo: [
                    "type": "dose_checkin",
                    "doseId": dose.id,
                    "episodeId": episodeId,
                    "medicationId": dose.medicationId
                ]
            )
            logger.info("Scheduled 2h dose check-in for dose \(dose.id)")
        } catch {
            logger.error("Failed to schedule dose check-in", error: error)
        }
    }

    func cancelCheckins(forEpisodeId episodeId: String) async {
        await cancelPendingCheckins(forEpisodeId: episodeId)

        let delivered = await notificationService.getDeliveredNotifications()
        for notification in delivered where matches(notification.request, episodeId: episodeId) {
            notificationService.removeDeliveredNotification(id: notification.request.identifier)
        }
    }

    // MARK: - Private

    private func cancelPendingCheckins(forEpisodeId episodeId: String) async {
        let pending = await notificationService.getPendingNotifications()
        for request in pending where matches(request, episodeId: episodeId) {
            notificationService.cancelNotification(id: request.identifier)
        }
    }

    private func matches(_ request: UNNotificationRequest, episodeId: String) -> Bool {
        request.identifier.hasPrefix(Self.idPrefix)
            && request.content.userInfo["episodeId"] as? String == episodeId
    }

    private func notificationsEnabled() -> Bool {
        UserDefaults.standard.object(forKey: "notifications_enabled") as? Bool ?? true
    }
}
