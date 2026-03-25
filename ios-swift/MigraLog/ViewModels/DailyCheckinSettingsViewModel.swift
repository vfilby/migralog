import Foundation
import Observation

@Observable
final class DailyCheckinSettingsViewModel {
    // MARK: - State

    var enabled: Bool = true
    var checkInTime: String = "09:00" // HH:mm format
    var timeSensitive: Bool = false
    var error: String?

    // MARK: - UserDefaults Keys

    private enum Keys {
        static let enabled = "daily_checkin_enabled"
        static let checkInTime = "daily_checkin_time"
        static let timeSensitive = "daily_checkin_time_sensitive"
    }

    // MARK: - Dependencies

    private let defaults: UserDefaults

    // MARK: - Init

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    // MARK: - Actions

    func loadSettings() {
        enabled = defaults.object(forKey: Keys.enabled) as? Bool ?? true
        checkInTime = defaults.string(forKey: Keys.checkInTime) ?? "09:00"
        timeSensitive = defaults.bool(forKey: Keys.timeSensitive)
    }

    func updateSettings(
        enabled: Bool? = nil,
        checkInTime: String? = nil,
        timeSensitive: Bool? = nil
    ) {
        if let value = enabled {
            self.enabled = value
            defaults.set(value, forKey: Keys.enabled)
        }
        if let value = checkInTime {
            self.checkInTime = value
            defaults.set(value, forKey: Keys.checkInTime)
        }
        if let value = timeSensitive {
            self.timeSensitive = value
            defaults.set(value, forKey: Keys.timeSensitive)
        }
    }
}
