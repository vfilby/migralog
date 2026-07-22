import SwiftUI

/// Shared visual constants and small formatting helpers for the episode Live
/// Activity presentations. Kept local to the widget extension.
enum LiveActivityStyle {
    /// The "active episode" accent — a warm red used for the icon, keyline and
    /// duration emphasis.
    static let activeColor = DesignTokens.LiveActivity.active

    /// A softer tint used for the post-episode close state.
    static let calmColor = DesignTokens.LiveActivity.calm

    /// Indigo accent for the beta post-drome (recovery) phase.
    static let postdromeColor = DesignTokens.LiveActivity.postdrome

    /// Accent for the current phase: red while the attack is active, indigo in
    /// the post-drome recovery phase, calm green once ended.
    static func tint(for state: EpisodeActivityAttributes.ContentState) -> Color {
        if state.isEnded { return calmColor }
        if state.isInPostdrome { return postdromeColor }
        return activeColor
    }

    /// Phase glyph: a calming moon during recovery, the bolt-heart otherwise.
    static func symbol(for state: EpisodeActivityAttributes.ContentState) -> String {
        state.isInPostdrome ? "moon.zzz.fill" : "bolt.heart.fill"
    }

    /// Lock Screen / VoiceOver headline for the ongoing phase.
    static func phaseLabel(for state: EpisodeActivityAttributes.ContentState) -> String {
        state.isInPostdrome ? "Post-drome" : "In migraine"
    }

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
