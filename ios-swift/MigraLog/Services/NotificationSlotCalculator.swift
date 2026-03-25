import Foundation

/// Calculates notification slot allocation to stay within iOS's 64-notification limit.
///
/// iOS limits the total number of scheduled local notifications to 64.
/// This calculator determines how many days of notifications to schedule
/// based on the current medication configuration.
enum NotificationSlotCalculator {
    static let iosNotificationLimit = 64

    /// Reserved slots: 14 for daily check-in (14 days) + 2 buffer
    static let reservedSlots = 16

    /// Available slots for medication notifications
    static let availableSlots = iosNotificationLimit - reservedSlots // 48

    /// Calculate how many days of notifications to schedule.
    ///
    /// - Parameter slotsPerDay: Total notification slots needed per day.
    ///   Each schedule with follow-up = 2 slots, without = 1 slot.
    /// - Returns: Number of days to schedule, clamped to 3–14.
    static func calculateNotificationDays(slotsPerDay: Int) -> Int {
        guard slotsPerDay > 0 else { return 0 }
        let maxDays = availableSlots / slotsPerDay
        return max(3, min(maxDays, 14))
    }

    /// Calculate slots needed per day from active schedules.
    ///
    /// - Parameters:
    ///   - scheduleCount: Number of active medication schedules
    ///   - followUpCount: Number of those schedules that have follow-up enabled
    /// - Returns: Total slots needed per day
    static func slotsNeededPerDay(scheduleCount: Int, followUpCount: Int) -> Int {
        // Each schedule = 1 slot (reminder), follow-up adds 1 more
        scheduleCount + followUpCount
    }
}
