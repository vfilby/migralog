import Foundation

/// Describes a pending timezone change the user should be informed about.
struct TimezoneChangeInfo: Equatable {
    let previousTimezone: String
    let currentTimezone: String
    let scheduleCount: Int

    var previousDisplayName: String {
        TimeZone(identifier: previousTimezone)?.localizedName(for: .generic, locale: .current) ?? previousTimezone
    }

    var currentDisplayName: String {
        TimeZone(identifier: currentTimezone)?.localizedName(for: .generic, locale: .current) ?? currentTimezone
    }
}

/// Detects timezone changes between app launches and notifies the user.
///
/// Medication notifications float with the device: a schedule set for 9:00 PM in PT fires
/// at 9:00 PM local time after the user travels to ET. Users are informed of this behavior
/// on first launch in a new timezone and offered a shortcut to review their schedules if
/// they'd prefer a different firing time.
@Observable
@MainActor
final class TimezoneChangeService {
    private static let lastKnownTimezoneKey = "lastKnownTimezoneIdentifier"

    private let medicationRepo: MedicationRepository

    /// The pending change, if any. Views observe this to present an informational alert.
    var pendingChange: TimezoneChangeInfo?

    init(medicationRepo: MedicationRepository) {
        self.medicationRepo = medicationRepo
    }

    /// Call at app startup. Sets `pendingChange` if the device timezone differs from the
    /// stored value and there are schedules to inform the user about.
    func checkForChange() async {
        let current = TimeZone.current.identifier
        let defaults = UserDefaults.standard

        guard let stored = defaults.string(forKey: Self.lastKnownTimezoneKey) else {
            defaults.set(current, forKey: Self.lastKnownTimezoneKey)
            return
        }

        guard stored != current else { return }

        let scheduleCount = (try? medicationRepo.countAllSchedules()) ?? 0
        guard scheduleCount > 0 else {
            defaults.set(current, forKey: Self.lastKnownTimezoneKey)
            return
        }

        pendingChange = TimezoneChangeInfo(
            previousTimezone: stored,
            currentTimezone: current,
            scheduleCount: scheduleCount
        )
    }

    /// Record that the user has seen (or dismissed) the prompt so it isn't shown again
    /// for this device/zone combination.
    func dismissChange() {
        guard let change = pendingChange else { return }
        UserDefaults.standard.set(change.currentTimezone, forKey: Self.lastKnownTimezoneKey)
        pendingChange = nil
    }
}
