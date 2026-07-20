import Foundation

/// Lightweight, `UserDefaults`-backed feature flag for pre-release builds.
///
/// Flags let us land in-progress features behind a toggle so they ship to
/// TestFlight (where evaluators can opt in via **Settings → Beta Features**)
/// while staying off by default and invisible in App Store builds.
///
/// To add a flag, declare a `static let` below and append it to `all`; the Beta
/// Features screen renders a toggle for every entry automatically. Read a flag
/// anywhere with `FeatureFlags.isEnabled(.someFlag)`, or observe it reactively
/// in a view with `@AppStorage(FeatureFlag.someFlag.storageKey)`.
struct FeatureFlag: Identifiable {
    /// Stable identifier; also forms the persistence key. Never reuse a key for
    /// a different feature.
    let key: String
    /// Short label shown next to the toggle.
    let title: String
    /// One-line explanation shown beneath the toggle.
    let details: String
    /// State when the user has never touched the toggle.
    var defaultValue: Bool = false

    var id: String { key }

    /// `@AppStorage` / `UserDefaults` key. Namespaced so flags can never collide
    /// with other persisted settings.
    var storageKey: String { "featureFlag.\(key)" }

    // MARK: - Registry

    // Declare experimental flags here, e.g.:
    // static let newInsightsDashboard = FeatureFlag(
    //     key: "newInsightsDashboard",
    //     title: "New Insights Dashboard",
    //     details: "Replaces the trends tab with the redesigned dashboard."
    // )

    static let postdromeTracking = FeatureFlag(
        key: "postdromeTracking",
        title: "Post-drome Tracking",
        details: "Transition an attack into a post-drome phase to track after "
            + "effects (medications, symptoms, notes) without pain levels."
    )

    static let doseCheckin = FeatureFlag(
        key: "doseCheckin",
        title: "2-Hour Medication Check-in",
        details: "Two hours after you take a rescue medication during an attack, "
            + "get a reminder to log how you're feeling."
    )

    /// Every flag surfaced in Beta Features, in display order.
    static let all: [FeatureFlag] = [
        .postdromeTracking,
        .doseCheckin,
    ]
}

/// Accessor for reading flags from app logic and views.
enum FeatureFlags {
    static func isEnabled(_ flag: FeatureFlag) -> Bool {
        guard UserDefaults.standard.object(forKey: flag.storageKey) != nil else {
            return flag.defaultValue
        }
        return UserDefaults.standard.bool(forKey: flag.storageKey)
    }
}
