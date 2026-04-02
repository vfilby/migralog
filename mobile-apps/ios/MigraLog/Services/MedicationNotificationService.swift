import Foundation
import UserNotifications

// MARK: - Protocol

protocol MedicationNotificationServiceProtocol: Sendable {
    func rescheduleAllMedicationNotifications() async throws
    func cancelMedicationReminders(for medicationId: String) async
    func cancelNotificationForDate(
        medicationId: String, scheduleId: String,
        date: String, notificationType: NotificationType
    ) async
    func dismissMedicationNotification(medicationId: String, scheduleId: String) async
    func handleTakenResponse(medicationId: String, scheduleId: String) async
    func handleSkippedResponse(medicationId: String, scheduleId: String) async
    func topUp(threshold: Int) async
    func rebalance() async
}

extension MedicationNotificationServiceProtocol {
    func topUp() async {
        await topUp(threshold: 3)
    }
}

// MARK: - Actor

actor MedicationNotificationScheduler: MedicationNotificationServiceProtocol {
    private let notificationService: NotificationServiceProtocol
    private let scheduledNotificationRepo: ScheduledNotificationRepositoryProtocol
    private let medicationRepo: MedicationRepositoryProtocol
    private let logger = AppLogger.shared

    init(
        notificationService: NotificationServiceProtocol,
        scheduledNotificationRepo: ScheduledNotificationRepositoryProtocol,
        medicationRepo: MedicationRepositoryProtocol
    ) {
        self.notificationService = notificationService
        self.scheduledNotificationRepo = scheduledNotificationRepo
        self.medicationRepo = medicationRepo
    }

    // MARK: - Reschedule All

    func rescheduleAllMedicationNotifications() async throws {
        logger.info("Rescheduling all medication notifications")

        // 1. Cancel all pending OS medication notifications
        let pending = await notificationService.getPendingNotifications()
        for request in pending {
            let userInfo = request.content.userInfo
            let isMedication =
                userInfo["medicationId"] != nil ||
                userInfo["medicationIds"] != nil ||
                request.content.categoryIdentifier == NotificationCategory.medication ||
                request.content.categoryIdentifier == NotificationCategory.multipleMedication
            if isMedication {
                notificationService.cancelNotification(id: request.identifier)
            }
        }

        // 2. Dismiss all delivered medication notifications
        let delivered = await notificationService.getDeliveredNotifications()
        for notification in delivered {
            let userInfo = notification.request.content.userInfo
            let isMedication =
                userInfo["medicationId"] != nil ||
                userInfo["medicationIds"] != nil
            if isMedication {
                notificationService.removeDeliveredNotification(id: notification.request.identifier)
            }
        }

        // 3. Clear DB
        try scheduledNotificationRepo.deleteAllMedication()

        // 4. Load active preventative daily medications
        let activeMedications = try medicationRepo.getActiveMedications()
        let preventativeDailyMeds = activeMedications.filter {
            $0.type == .preventative && $0.scheduleFrequency == .daily
        }

        // 5. Gather enabled schedules
        var items: [(Medication, MedicationSchedule)] = []
        var slotsPerDay = 0
        let followUpDelay = UserDefaults.standard.integer(forKey: "notification_follow_up_delay")

        for medication in preventativeDailyMeds {
            let schedules = try medicationRepo.getSchedulesByMedicationId(medication.id)
            let enabledSchedules = schedules.filter(\.enabled)
            for schedule in enabledSchedules {
                items.append((medication, schedule))
                slotsPerDay += 1
                if followUpDelay > 0 {
                    slotsPerDay += 1
                }
            }
        }

        guard !items.isEmpty else {
            logger.info("No active medication schedules to notify for")
            return
        }

        // 6. Calculate days and schedule
        let days = NotificationSlotCalculator.calculateNotificationDays(slotsPerDay: slotsPerDay)
        logger.info("Scheduling medication notifications: \(items.count) items, \(days) days ahead")
        try await scheduleGroupedNotificationsForDays(items: items, days: days)
    }

    // MARK: - Grouped Scheduling

    private func scheduleGroupedNotificationsForDays(
        items: [(Medication, MedicationSchedule)],
        days: Int
    ) async throws {
        // Group items by schedule time (HH:mm)
        var timeGroups: [String: [(Medication, MedicationSchedule)]] = [:]
        for item in items {
            let time = item.1.time
            timeGroups[time, default: []].append(item)
        }

        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())

        for dayOffset in 0..<days {
            guard let targetDay = calendar.date(byAdding: .day, value: dayOffset, to: today) else { continue }
            let dateString = DateFormatting.dateString(from: targetDay)

            for (time, group) in timeGroups {
                guard let trigger = triggerDate(dateString: dateString, time: time) else { continue }
                guard trigger > Date() else { continue }

                if group.count == 1 {
                    let (medication, schedule) = group[0]
                    try await scheduleIndividualNotification(
                        medication: medication,
                        schedule: schedule,
                        dateString: dateString,
                        triggerDate: trigger,
                        notificationType: .reminder
                    )
                } else {
                    try await scheduleGroupedNotification(
                        items: group,
                        dateString: dateString,
                        time: time,
                        triggerDate: trigger,
                        notificationType: .reminder
                    )
                }

                // Schedule follow-up if enabled
                let followUpDelay = UserDefaults.standard.integer(forKey: "notification_follow_up_delay")
                if followUpDelay > 0 {
                    guard let followUpTrigger = calendar.date(byAdding: .minute, value: followUpDelay, to: trigger) else { continue }
                    guard followUpTrigger > Date() else { continue }

                    if group.count == 1 {
                        let (medication, schedule) = group[0]
                        try await scheduleIndividualNotification(
                            medication: medication,
                            schedule: schedule,
                            dateString: dateString,
                            triggerDate: followUpTrigger,
                            notificationType: .followUp,
                            isFollowUp: true
                        )
                    } else {
                        try await scheduleGroupedNotification(
                            items: group,
                            dateString: dateString,
                            time: time,
                            triggerDate: followUpTrigger,
                            notificationType: .followUp,
                            isFollowUp: true
                        )
                    }
                }
            }
        }
    }

    // MARK: - Atomic Scheduling

    private func scheduleIndividualNotification(
        medication: Medication,
        schedule: MedicationSchedule,
        dateString: String,
        triggerDate: Date,
        notificationType: NotificationType,
        isFollowUp: Bool = false
    ) async throws {
        let notificationId = UUID().uuidString
        let trigger = makeTrigger(from: triggerDate)
        let title = isFollowUp ? "Follow-Up Reminder" : "Medication Reminder"
        let body = "Time to take \(medication.name) (\(medication.dosageAmount)\(medication.dosageUnit))"

        var userInfo: [String: Any] = [
            "medicationId": medication.id,
            "scheduleId": schedule.id
        ]
        if isFollowUp {
            userInfo["isFollowUp"] = true
        }

        try await notificationService.scheduleNotification(
            id: notificationId,
            title: title,
            body: body,
            trigger: trigger,
            categoryIdentifier: NotificationCategory.medication,
            userInfo: userInfo
        )

        let mapping = ScheduledNotification(
            id: UUID().uuidString,
            medicationId: medication.id,
            scheduleId: schedule.id,
            date: dateString,
            notificationId: notificationId,
            notificationType: notificationType,
            isGrouped: false,
            groupKey: nil,
            sourceType: .medication,
            medicationName: medication.name,
            scheduledTriggerTime: schedule.time,
            notificationTitle: title,
            notificationBody: body,
            categoryIdentifier: NotificationCategory.medication,
            createdAt: TimestampHelper.now
        )

        do {
            _ = try scheduledNotificationRepo.createNotification(mapping)
        } catch {
            // Compensating rollback: cancel the OS notification on DB failure
            notificationService.cancelNotification(id: notificationId)
            logger.error("Failed to save notification mapping, rolled back OS notification", error: error)
            throw error
        }
    }

    private func scheduleGroupedNotification(
        items: [(Medication, MedicationSchedule)],
        dateString: String,
        time: String,
        triggerDate: Date,
        notificationType: NotificationType,
        isFollowUp: Bool = false
    ) async throws {
        let notificationId = UUID().uuidString
        let trigger = makeTrigger(from: triggerDate)
        let names = items.map(\.0.name)
        let title = isFollowUp ? "Follow-Up Reminder" : "Medication Reminder"
        let body = "Time to take: \(names.joined(separator: ", "))"
        let groupKey = "\(time)_\(notificationType.rawValue)"

        let medicationIds = items.map(\.0.id)
        let scheduleIds = items.map(\.1.id)

        var userInfo: [String: Any] = [
            "medicationIds": medicationIds,
            "scheduleIds": scheduleIds,
            "time": time
        ]
        if isFollowUp {
            userInfo["isFollowUp"] = true
        }

        try await notificationService.scheduleNotification(
            id: notificationId,
            title: title,
            body: body,
            trigger: trigger,
            categoryIdentifier: NotificationCategory.multipleMedication,
            userInfo: userInfo
        )

        // Create a mapping for each medication in the group
        var savedMappings: [ScheduledNotification] = []
        do {
            for (medication, schedule) in items {
                let mapping = ScheduledNotification(
                    id: UUID().uuidString,
                    medicationId: medication.id,
                    scheduleId: schedule.id,
                    date: dateString,
                    notificationId: notificationId,
                    notificationType: notificationType,
                    isGrouped: true,
                    groupKey: groupKey,
                    sourceType: .medication,
                    medicationName: medication.name,
                    scheduledTriggerTime: time,
                    notificationTitle: title,
                    notificationBody: body,
                    categoryIdentifier: NotificationCategory.multipleMedication,
                    createdAt: TimestampHelper.now
                )
                _ = try scheduledNotificationRepo.createNotification(mapping)
                savedMappings.append(mapping)
            }
        } catch {
            // Compensating rollback
            notificationService.cancelNotification(id: notificationId)
            for saved in savedMappings {
                try? scheduledNotificationRepo.deleteById(saved.id)
            }
            logger.error("Failed to save grouped notification mappings, rolled back", error: error)
            throw error
        }
    }

    // MARK: - Cancellation

    func cancelMedicationReminders(for medicationId: String) async {
        let pending = await notificationService.getPendingNotifications()
        for request in pending {
            let userInfo = request.content.userInfo
            if let medId = userInfo["medicationId"] as? String, medId == medicationId {
                notificationService.cancelNotification(id: request.identifier)
            } else if let medIds = userInfo["medicationIds"] as? [String], medIds.contains(medicationId) {
                notificationService.cancelNotification(id: request.identifier)
            }
        }

        do {
            try scheduledNotificationRepo.deleteByEntity(entityType: .medication, entityId: medicationId)
        } catch {
            logger.error("Failed to delete notification mappings for medication \(medicationId)", error: error)
        }

        logger.info("Cancelled reminders for medication: \(medicationId)")
    }

    func cancelNotificationForDate(
        medicationId: String, scheduleId: String,
        date: String, notificationType: NotificationType
    ) async {
        do {
            guard let mapping = try scheduledNotificationRepo.getMapping(
                medicationId: medicationId,
                scheduleId: scheduleId,
                date: date,
                notificationType: notificationType
            ) else {
                return
            }

            if !mapping.isGrouped {
                // Simple case: cancel the single notification
                notificationService.cancelNotification(id: mapping.notificationId)
                try scheduledNotificationRepo.deleteById(mapping.id)
                logger.debug("Cancelled individual notification for \(medicationId) on \(date)")
                return
            }

            // Grouped case
            guard let groupKey = mapping.groupKey else { return }
            let groupMappings = try scheduledNotificationRepo.getByGroupKey(groupKey, date: date)
            let remaining = groupMappings.filter {
                $0.notificationType == notificationType && $0.medicationId != medicationId
            }

            // Cancel the current OS notification
            notificationService.cancelNotification(id: mapping.notificationId)
            // Delete this mapping
            try scheduledNotificationRepo.deleteById(mapping.id)

            if remaining.isEmpty {
                // No remaining: delete all group mappings for this date
                for m in groupMappings where m.id != mapping.id {
                    try scheduledNotificationRepo.deleteById(m.id)
                }
            } else if remaining.count == 1 {
                // Convert to individual notification
                let single = remaining[0]
                guard let singleMedId = single.medicationId,
                      let singleSchedId = single.scheduleId,
                      let medication = try medicationRepo.getMedicationById(singleMedId) else { return }
                let schedules = try medicationRepo.getSchedulesByMedicationId(singleMedId)
                guard let schedule = schedules.first(where: { $0.id == singleSchedId }) else { return }

                // Delete old grouped mapping
                try scheduledNotificationRepo.deleteById(single.id)

                // Schedule new individual notification
                if let trigger = triggerDate(dateString: date, time: schedule.time), trigger > Date() {
                    try await scheduleIndividualNotification(
                        medication: medication,
                        schedule: schedule,
                        dateString: date,
                        triggerDate: trigger,
                        notificationType: notificationType,
                        isFollowUp: notificationType == .followUp
                    )
                }
            } else {
                // 2+ remaining: recreate grouped notification without this med
                // Delete old mappings
                for m in remaining {
                    try scheduledNotificationRepo.deleteById(m.id)
                }

                // Look up medications and schedules for remaining
                var newItems: [(Medication, MedicationSchedule)] = []
                for m in remaining {
                    guard let medId = m.medicationId,
                          let schedId = m.scheduleId,
                          let medication = try medicationRepo.getMedicationById(medId) else { continue }
                    let schedules = try medicationRepo.getSchedulesByMedicationId(medId)
                    if let schedule = schedules.first(where: { $0.id == schedId }) {
                        newItems.append((medication, schedule))
                    }
                }

                guard !newItems.isEmpty,
                      let time = remaining.first?.scheduledTriggerTime,
                      let trigger = triggerDate(dateString: date, time: time),
                      trigger > Date() else { return }

                try await scheduleGroupedNotification(
                    items: newItems,
                    dateString: date,
                    time: time,
                    triggerDate: trigger,
                    notificationType: notificationType,
                    isFollowUp: notificationType == .followUp
                )
            }
        } catch {
            logger.error("Failed to cancel notification for date", error: error)
        }
    }

    // MARK: - Dismissal

    func dismissMedicationNotification(medicationId: String, scheduleId: String) async {
        let delivered = await notificationService.getDeliveredNotifications()

        for notification in delivered {
            let userInfo = notification.request.content.userInfo

            // Single notification
            if let medId = userInfo["medicationId"] as? String,
               let schedId = userInfo["scheduleId"] as? String,
               medId == medicationId && schedId == scheduleId {
                notificationService.removeDeliveredNotification(id: notification.request.identifier)
                continue
            }

            // Grouped notification: only dismiss if ALL meds in group are logged
            if let medIds = userInfo["medicationIds"] as? [String], medIds.contains(medicationId) {
                let today = DateFormatting.dateString(from: Date())
                var allLogged = true
                for groupMedId in medIds {
                    do {
                        let logged = try medicationRepo.wasLoggedForScheduleToday(
                            medicationId: groupMedId,
                            date: today
                        )
                        if !logged {
                            allLogged = false
                            break
                        }
                    } catch {
                        allLogged = false
                        break
                    }
                }
                if allLogged {
                    notificationService.removeDeliveredNotification(id: notification.request.identifier)
                }
            }
        }
    }

    // MARK: - Top-Up & Rebalance

    func topUp(threshold: Int = 3) async {
        do {
            let activeMedications = try medicationRepo.getActiveMedications()
            let preventativeDailyMeds = activeMedications.filter {
                $0.type == .preventative && $0.scheduleFrequency == .daily
            }

            var items: [(Medication, MedicationSchedule)] = []
            let followUpDelay = UserDefaults.standard.integer(forKey: "notification_follow_up_delay")
            var slotsPerDay = 0

            for medication in preventativeDailyMeds {
                let schedules = try medicationRepo.getSchedulesByMedicationId(medication.id)
                let enabledSchedules = schedules.filter(\.enabled)
                for schedule in enabledSchedules {
                    items.append((medication, schedule))
                    slotsPerDay += 1
                    if followUpDelay > 0 {
                        slotsPerDay += 1
                    }
                }
            }

            guard slotsPerDay > 0 else { return }
            let targetDays = NotificationSlotCalculator.calculateNotificationDays(slotsPerDay: slotsPerDay)
            let calendar = Calendar.current
            let today = calendar.startOfDay(for: Date())

            // Collect dates that need scheduling per time group
            // Group items by time so top-up respects grouping (prevents split notifications)
            var timeGroups: [String: [(Medication, MedicationSchedule)]] = [:]
            for item in items {
                timeGroups[item.1.time, default: []].append(item)
            }

            // For each time group, find which dates need scheduling
            var datesToSchedule: [String: Set<String>] = [:] // time -> set of dateStrings

            for (medication, schedule) in items {
                let count = try scheduledNotificationRepo.countBySchedule(
                    medicationId: medication.id,
                    scheduleId: schedule.id
                )

                if count < threshold {
                    let lastDateStr = try scheduledNotificationRepo.getLastScheduledDate(
                        medicationId: medication.id,
                        scheduleId: schedule.id
                    )

                    var startOffset: Int
                    if let lastDateStr, let lastDate = DateFormatting.date(from: lastDateStr) {
                        let daysBetween = calendar.dateComponents([.day], from: today, to: lastDate).day ?? 0
                        startOffset = daysBetween + 1
                    } else {
                        startOffset = 0
                    }

                    let daysToAdd = targetDays - count
                    guard daysToAdd > 0 else { continue }

                    let time = schedule.time
                    for dayIdx in 0..<daysToAdd {
                        let dayOffset = startOffset + dayIdx
                        guard let targetDay = calendar.date(byAdding: .day, value: dayOffset, to: today) else { continue }
                        let dateString = DateFormatting.dateString(from: targetDay)
                        datesToSchedule[time, default: []].insert(dateString)
                    }
                }
            }

            // Schedule using proper grouping for each time slot and date
            for (time, dateStrings) in datesToSchedule {
                let group = timeGroups[time] ?? []
                guard !group.isEmpty else { continue }

                for dateString in dateStrings.sorted() {
                    guard let trigger = triggerDate(dateString: dateString, time: time),
                          trigger > Date() else { continue }

                    if group.count == 1 {
                        let (medication, schedule) = group[0]
                        // Only schedule if this specific med/schedule doesn't already have a mapping
                        let existing = try scheduledNotificationRepo.getMapping(
                            medicationId: medication.id, scheduleId: schedule.id,
                            date: dateString, notificationType: .reminder
                        )
                        if existing == nil {
                            try await scheduleIndividualNotification(
                                medication: medication, schedule: schedule,
                                dateString: dateString, triggerDate: trigger,
                                notificationType: .reminder
                            )
                        }
                    } else {
                        try await scheduleGroupedNotification(
                            items: group, dateString: dateString, time: time,
                            triggerDate: trigger, notificationType: .reminder
                        )
                    }

                    // Schedule follow-up if enabled
                    if followUpDelay > 0 {
                        guard let followUpTrigger = calendar.date(byAdding: .minute, value: followUpDelay, to: trigger),
                              followUpTrigger > Date() else { continue }

                        if group.count == 1 {
                            let (medication, schedule) = group[0]
                            let existing = try scheduledNotificationRepo.getMapping(
                                medicationId: medication.id, scheduleId: schedule.id,
                                date: dateString, notificationType: .followUp
                            )
                            if existing == nil {
                                try await scheduleIndividualNotification(
                                    medication: medication, schedule: schedule,
                                    dateString: dateString, triggerDate: followUpTrigger,
                                    notificationType: .followUp, isFollowUp: true
                                )
                            }
                        } else {
                            try await scheduleGroupedNotification(
                                items: group, dateString: dateString, time: time,
                                triggerDate: followUpTrigger, notificationType: .followUp,
                                isFollowUp: true
                            )
                        }
                    }
                }
            }

            logger.info("Top-up complete")
        } catch {
            logger.error("Top-up failed", error: error)
        }
    }

    func rebalance() async {
        do {
            let activeMedications = try medicationRepo.getActiveMedications()
            let preventativeDailyMeds = activeMedications.filter {
                $0.type == .preventative && $0.scheduleFrequency == .daily
            }

            var slotsPerDay = 0
            let followUpDelay = UserDefaults.standard.integer(forKey: "notification_follow_up_delay")

            var allSchedules: [(Medication, MedicationSchedule)] = []
            for medication in preventativeDailyMeds {
                let schedules = try medicationRepo.getSchedulesByMedicationId(medication.id)
                let enabledSchedules = schedules.filter(\.enabled)
                for schedule in enabledSchedules {
                    allSchedules.append((medication, schedule))
                    slotsPerDay += 1
                    if followUpDelay > 0 {
                        slotsPerDay += 1
                    }
                }
            }

            guard slotsPerDay > 0 else { return }
            let newTargetDays = NotificationSlotCalculator.calculateNotificationDays(slotsPerDay: slotsPerDay)

            // Trim excess notifications per schedule
            for (medication, schedule) in allSchedules {
                let mappings = try scheduledNotificationRepo.getMappingsBySchedule(
                    medicationId: medication.id,
                    scheduleId: schedule.id
                )

                if mappings.count > newTargetDays {
                    // Sort by date descending to trim the latest ones
                    let sorted = mappings.sorted { $0.date > $1.date }
                    let excess = sorted.prefix(mappings.count - newTargetDays)
                    for mapping in excess {
                        notificationService.cancelNotification(id: mapping.notificationId)
                        try scheduledNotificationRepo.deleteById(mapping.id)
                    }
                }
            }

            logger.info("Rebalance complete, target days: \(newTargetDays)")
        } catch {
            logger.error("Rebalance failed", error: error)
        }

        // Top up to fill any gaps
        await topUp()
    }

    // MARK: - Response Handlers

    func handleTakenResponse(medicationId: String, scheduleId: String) async {
        logger.info("Medication taken via notification: \(medicationId), schedule: \(scheduleId)")
        await dismissMedicationNotification(medicationId: medicationId, scheduleId: scheduleId)
    }

    func handleSkippedResponse(medicationId: String, scheduleId: String) async {
        logger.info("Medication skipped via notification: \(medicationId), schedule: \(scheduleId)")
        await dismissMedicationNotification(medicationId: medicationId, scheduleId: scheduleId)
    }

    // MARK: - Helpers

    private func makeTrigger(from date: Date) -> UNCalendarNotificationTrigger {
        let components = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: date)
        return UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
    }

    private func triggerDate(dateString: String, time: String) -> Date? {
        guard let date = DateFormatting.date(from: dateString),
              let components = parseTime(time) else { return nil }
        return Calendar.current.date(bySettingHour: components.hour, minute: components.minute, second: 0, of: date)
    }

    private func parseTime(_ time: String) -> (hour: Int, minute: Int)? {
        let parts = time.split(separator: ":")
        guard parts.count == 2, let h = Int(parts[0]), let m = Int(parts[1]) else { return nil }
        return (h, m)
    }
}
