import Foundation
import Observation

/// Drives the dashboard "Get Started" onboarding checklist.
///
/// Completion is *derived from the data* on every `refresh()` rather than stored
/// as per-item flags, so the checklist self-heals: doing an action through the
/// normal flow (or deleting data) ticks/un-ticks the matching item automatically.
/// The only item that needs a persisted flag is "Check out your trends", since
/// visiting a tab leaves no data artifact.
///
/// Note on "Track a day": a calendar day shows red because an episode overlaps it
/// (computed on the fly in `AnalyticsViewModel`), *not* because a `DailyStatusLog`
/// row exists. So this item only completes on an explicit daily status — logging
/// episodes never satisfies it.
@MainActor
@Observable
final class OnboardingChecklistViewModel {
    /// Checklist items, in display order.
    enum Item: String, CaseIterable, Identifiable {
        case firstEpisode
        case trackDay
        case preventative
        case rescue
        case trends

        var id: String { rawValue }

        var title: String {
            switch self {
            case .firstEpisode: return "Track your first episode"
            case .trackDay: return "Track a day"
            case .preventative: return "Add a preventative medication"
            case .rescue: return "Add your rescue meds"
            case .trends: return "Check out your trends"
            }
        }

        /// Accent glyph shown on an incomplete row.
        var systemImage: String {
            switch self {
            case .firstEpisode: return "bolt.heart"
            case .trackDay: return "calendar"
            case .preventative: return "pills"
            case .rescue: return "cross.case"
            case .trends: return "chart.bar"
            }
        }
    }

    /// Episodes that must be logged before the trends item unlocks. Trends are
    /// meaningless with one data point, so we hold the nudge until there's a
    /// little history to look at.
    static let trendsUnlockThreshold = 3

    // MARK: - Data-derived state (recomputed on refresh)

    private(set) var episodeCount = 0
    private(set) var hasTrackedDay = false
    private(set) var hasPreventative = false
    private(set) var hasRescue = false
    /// False until the first `refresh()` completes, so the card doesn't flash in
    /// before we know whether the user has already finished onboarding.
    private(set) var hasLoaded = false

    // MARK: - Persisted UI flags (write-through to UserDefaults)

    /// Sticky once set, by either a manual dismiss or auto-retire when every
    /// visible item is complete. Keeps the card from resurrecting later (e.g. when
    /// the trends item unlocks).
    private(set) var isDismissed: Bool
    private(set) var visitedTrends: Bool

    // MARK: - Dependencies

    private let episodeRepository: EpisodeRepositoryProtocol
    private let medicationRepository: MedicationRepositoryProtocol
    private let dailyStatusRepository: DailyStatusRepositoryProtocol
    private let defaults: UserDefaults

    private static let dismissedKey = "onboardingChecklist.dismissed"
    private static let visitedTrendsKey = "onboardingChecklist.trendsVisited"

    /// Lexicographic bounds for the "any explicit daily status ever" query. Daily
    /// status dates are stored as "YYYY-MM-DD" strings, so these bracket all rows.
    private static let earliestDate = "0000-01-01"
    private static let latestDate = "9999-12-31"

    // MARK: - Init

    init(
        episodeRepository: EpisodeRepositoryProtocol = EpisodeRepository(dbManager: DatabaseManager.shared),
        medicationRepository: MedicationRepositoryProtocol = MedicationRepository(dbManager: DatabaseManager.shared),
        dailyStatusRepository: DailyStatusRepositoryProtocol = DailyStatusRepository(dbManager: DatabaseManager.shared),
        defaults: UserDefaults = .standard
    ) {
        self.episodeRepository = episodeRepository
        self.medicationRepository = medicationRepository
        self.dailyStatusRepository = dailyStatusRepository
        self.defaults = defaults
        self.isDismissed = defaults.bool(forKey: Self.dismissedKey)
        self.visitedTrends = defaults.bool(forKey: Self.visitedTrendsKey)
    }

    // MARK: - Refresh

    /// Recomputes every item's completion from the repositories. Failures are
    /// logged and swallowed — the checklist is a non-critical nudge, so a read
    /// error should never surface an error or block the dashboard.
    func refresh() {
        do {
            episodeCount = try episodeRepository.getAllEpisodes().count
            let activeMeds = try medicationRepository.getActiveMedications()
            hasPreventative = activeMeds.contains { $0.type == .preventative }
            hasRescue = activeMeds.contains { $0.type == .rescue }
            let statuses = try dailyStatusRepository.getStatusesByDateRange(
                start: Self.earliestDate,
                end: Self.latestDate
            )
            hasTrackedDay = !statuses.isEmpty
        } catch {
            ErrorLogger.shared.logError(
                error,
                context: ["viewModel": "OnboardingChecklistViewModel", "action": "refresh"]
            )
        }
        hasLoaded = true
        retireIfComplete()
    }

    // MARK: - Completion & visibility

    func isCompleted(_ item: Item) -> Bool {
        switch item {
        case .firstEpisode: return episodeCount > 0
        case .trackDay: return hasTrackedDay
        case .preventative: return hasPreventative
        case .rescue: return hasRescue
        case .trends: return visitedTrends
        }
    }

    /// The trends item stays locked (visible-but-greyed) until enough episodes
    /// are logged; all other items are always actionable.
    func isUnlocked(_ item: Item) -> Bool {
        item != .trends || episodeCount >= Self.trendsUnlockThreshold
    }

    /// Hint shown beneath a locked item explaining what unlocks it.
    func lockHint(for item: Item) -> String? {
        guard item == .trends, !isUnlocked(item) else { return nil }
        return "Unlocks after \(Self.trendsUnlockThreshold) episodes (\(episodeCount)/\(Self.trendsUnlockThreshold))"
    }

    var orderedItems: [Item] { Item.allCases }

    /// Count of unlocked items that are done (locked items aren't counted, so the
    /// "X of N" fraction stays honest).
    var completedCount: Int {
        orderedItems.filter { isUnlocked($0) && isCompleted($0) }.count
    }

    var totalCount: Int {
        orderedItems.filter { isUnlocked($0) }.count
    }

    /// Every currently-unlocked item is complete.
    private var allUnlockedComplete: Bool {
        totalCount > 0 && completedCount == totalCount
    }

    /// Whether the card should render at all.
    var shouldShow: Bool { hasLoaded && !isDismissed }

    // MARK: - Actions

    /// Auto-retire the card once the user has finished everything available to
    /// them. Sticky via `isDismissed` so it won't pop back when trends unlocks.
    private func retireIfComplete() {
        if !isDismissed && allUnlockedComplete {
            dismiss()
        }
    }

    func dismiss() {
        isDismissed = true
        defaults.set(true, forKey: Self.dismissedKey)
    }

    /// Records that the user opened trends from the checklist, completing that
    /// item. Tapping the row is the only thing that sets this — merely landing on
    /// the Trends tab via another item does not.
    func markTrendsVisited() {
        guard !visitedTrends else { return }
        visitedTrends = true
        defaults.set(true, forKey: Self.visitedTrendsKey)
    }
}
