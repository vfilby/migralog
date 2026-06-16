import SwiftUI

/// Shared visual constants and small formatting helpers for the episode Live
/// Activity presentations. Kept local to the widget extension.
enum LiveActivityStyle {
    /// The "active episode" accent — a warm red used for the icon, keyline and
    /// duration emphasis.
    static let activeColor = Color(red: 0.84, green: 0.23, blue: 0.30)

    /// A softer tint used for the post-episode close state.
    static let calmColor = Color(red: 0.30, green: 0.55, blue: 0.50)

    static func intensityLabel(_ intensity: Double?) -> String? {
        guard let intensity else { return nil }
        return "\(Int(intensity.rounded()))/10"
    }

    /// Whole-day/hour/minute label for a finished duration, e.g. "4h 20m".
    static func durationLabel(from start: Date, to end: Date) -> String {
        let seconds = max(0, Int(end.timeIntervalSince(start)))
        let days = seconds / 86_400
        let hours = (seconds % 86_400) / 3_600
        let minutes = (seconds % 3_600) / 60
        if days > 0 { return "\(days)d \(hours)h" }
        if hours > 0 { return "\(hours)h \(minutes)m" }
        return "\(minutes)m"
    }
}
