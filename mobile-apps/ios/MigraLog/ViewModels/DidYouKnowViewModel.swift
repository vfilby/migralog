import Foundation
import Observation

/// Drives the dashboard "Did you know?" tip slot and the Settings → Help → Tips
/// screen.
///
/// Tips are surgical, not a daily rotation. This selects the single most relevant
/// tip, but rate-limits the slot to at most one tip *surfacing* per day: once the
/// user dismisses a tip, the slot stays empty for the rest of that day rather than
/// immediately replacing it with the next eligible tip. Dismissals are persisted
/// per-tip so users can re-show them from Settings.
@MainActor
@Observable
final class DidYouKnowViewModel {
    /// The tip currently shown, or nil when nothing's timely (the common case).
    private(set) var currentTip: Tip?
    private(set) var hasLoaded = false

    private let episodeRepository: EpisodeRepositoryProtocol
    private let dailyStatusRepository: DailyStatusRepositoryProtocol
    private let defaults: UserDefaults
    /// Returns today's date as "YYYY-MM-DD"; injectable for tests.
    private let today: () -> String

    private var dismissed: Set<String>
    /// The day on which a tip was last dismissed; while it equals today, the slot
    /// stays empty so a dismissed tip isn't replaced the same day.
    private var lastDismissedDay: String?

    private static let dismissedKey = "didYouKnow.dismissedTips"
    private static let lastDismissedDayKey = "didYouKnow.lastDismissedDay"
    private static let earliestDate = "0000-01-01"
    private static let latestDate = "9999-12-31"
    private static let millisPerDay: Int64 = 1000 * 60 * 60 * 24

    init(
        episodeRepository: EpisodeRepositoryProtocol = EpisodeRepository(dbManager: DatabaseManager.shared),
        dailyStatusRepository: DailyStatusRepositoryProtocol = DailyStatusRepository(dbManager: DatabaseManager.shared),
        defaults: UserDefaults = .standard,
        today: @escaping () -> String = { TimestampHelper.dateString() }
    ) {
        self.episodeRepository = episodeRepository
        self.dailyStatusRepository = dailyStatusRepository
        self.defaults = defaults
        self.today = today
        self.dismissed = Set(defaults.stringArray(forKey: Self.dismissedKey) ?? [])
        self.lastDismissedDay = defaults.string(forKey: Self.lastDismissedDayKey)
    }

    // MARK: - Refresh

    /// Rebuilds the context and reselects the tip, honoring the one-per-day cap.
    /// Read failures are logged and swallowed — a tip must never block the
    /// dashboard or surface an error.
    func refresh() {
        hasLoaded = true
        // Dismissed something already today → leave the slot empty until tomorrow.
        if lastDismissedDay == today() {
            currentTip = nil
            return
        }
        currentTip = Tip.select(context: buildContext(), dismissed: dismissed)
    }

    private func buildContext() -> TipContext {
        var context = TipContext()
        do {
            // getAllEpisodes() is ordered by start_time DESC, so .last is oldest.
            let episodes = try episodeRepository.getAllEpisodes()
            context.episodeCount = episodes.count
            if let oldest = episodes.last {
                let elapsed = max(0, TimestampHelper.now - oldest.startTime)
                context.daysOfHistory = Int(elapsed / Self.millisPerDay)
            }
            let statuses = try dailyStatusRepository.getStatusesByDateRange(
                start: Self.earliestDate,
                end: Self.latestDate
            )
            context.hasTrackedDay = !statuses.isEmpty
        } catch {
            ErrorLogger.shared.logError(
                error,
                context: ["viewModel": "DidYouKnowViewModel", "action": "buildContext"]
            )
        }
        return context
    }

    // MARK: - Card actions

    /// Permanently dismiss a tip (until restored from Settings) and keep the slot
    /// empty for the rest of today.
    func dismiss(_ tip: Tip) {
        dismissed.insert(tip.id)
        lastDismissedDay = today()
        defaults.set(Array(dismissed), forKey: Self.dismissedKey)
        defaults.set(lastDismissedDay, forKey: Self.lastDismissedDayKey)
        currentTip = nil
    }

    /// Called when the user taps a tip's CTA. Tips with no data-completion signal
    /// are dismissed here since acting on them is the only "done" signal.
    func registerAction(on tip: Tip) {
        if tip.dismissesOnAction {
            dismiss(tip)
        }
    }

    // MARK: - Tips catalog (Settings)

    var allTips: [Tip] { Tip.allCases.sorted { $0.priority < $1.priority } }

    func isDismissed(_ tip: Tip) -> Bool { dismissed.contains(tip.id) }

    /// Re-show a previously dismissed tip (eligible again next refresh). Also
    /// lifts today's one-per-day cap so the user sees the effect immediately.
    func restore(_ tip: Tip) {
        dismissed.remove(tip.id)
        lastDismissedDay = nil
        defaults.set(Array(dismissed), forKey: Self.dismissedKey)
        defaults.removeObject(forKey: Self.lastDismissedDayKey)
    }

    var hasDismissedTips: Bool { !dismissed.isEmpty }

    func restoreAll() {
        dismissed.removeAll()
        lastDismissedDay = nil
        defaults.set(Array(dismissed), forKey: Self.dismissedKey)
        defaults.removeObject(forKey: Self.lastDismissedDayKey)
    }
}
