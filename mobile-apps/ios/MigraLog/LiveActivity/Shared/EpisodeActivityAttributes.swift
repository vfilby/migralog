import ActivityKit
import Foundation

/// ActivityKit contract for the "active migraine episode" Live Activity (#416).
///
/// This type is compiled into BOTH the MigraLog app target (which starts,
/// updates and ends activities) and the MigraLogWidgets extension (which renders
/// them on the Lock Screen and in the Dynamic Island). Keep it dependency-free —
/// no app models, repositories or helpers — so it stays portable across targets.
struct EpisodeActivityAttributes: ActivityAttributes {
    /// The live, mutable portion of the activity. The app pushes a new value via
    /// `Activity.update(...)` whenever the episode's surfaced state changes.
    ///
    /// Duration is intentionally NOT stored here: it is rendered live from
    /// `startDate` with `Text(_:style:.timer)`, which ticks without an update.
    struct ContentState: Codable, Hashable {
        /// Last-logged pain intensity on the 0–10 scale, if any has been logged.
        var currentIntensity: Double?

        /// Display name of the most recent rescue-category dose, if any.
        var lastRescueMedName: String?

        /// When that most recent rescue dose was taken.
        var lastRescueMedAt: Date?

        /// Set once the episode ends. Drives the warm post-episode close state
        /// that lingers briefly before the activity is dismissed.
        var endedAt: Date?

        var isEnded: Bool { endedAt != nil }

        var hasRescueMed: Bool { lastRescueMedName != nil && lastRescueMedAt != nil }
    }

    /// Stable identifier of the episode this activity tracks. Used by deep links
    /// so a tapped action routes back to the correct episode.
    var episodeId: String

    /// Episode start time. The duration badge counts up live from this value.
    var startDate: Date
}
