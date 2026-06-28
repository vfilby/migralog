import Foundation

/// A snapshot of the user's state used to decide whether a tip is timely.
/// Built from the repositories on each refresh — see `DidYouKnowViewModel`.
struct TipContext: Sendable, Equatable {
    var episodeCount: Int = 0
    /// True only when an explicit `DailyStatusLog` exists. Episode-derived red
    /// calendar days are computed on the fly and do NOT count here.
    var hasTrackedDay: Bool = false
    /// Whole days between the user's earliest episode and now (0 if none logged).
    var daysOfHistory: Int = 0
}

/// What a tip's call-to-action button does. Routing lives in the host view.
enum TipCTA: Equatable {
    case openCalendar
    case openTrends
    case exportDoctorSummary

    var label: String {
        switch self {
        case .openCalendar: return "Open Calendar"
        case .openTrends: return "See Trends"
        case .exportDoctorSummary: return "Export Summary"
        }
    }
}

/// The catalog of *surgical* contextual tips shown in the dashboard's
/// "Did you know?" slot.
///
/// These are deliberately not an everyday rotation. Each tip has a meaningful
/// trigger (`isEligible`) and only appears when it's genuinely useful. The slot
/// shows the single highest-priority eligible, non-dismissed tip; the view model
/// caps it to at most one tip surfacing per day and never replaces a dismissed
/// tip the same day. Setup actions (add meds) live in the separate
/// `SetupChecklist`, not here.
enum Tip: String, CaseIterable, Identifiable {
    /// You're logging episodes but have never marked how a day felt.
    case trackADay
    /// Enough episodes logged to spot patterns.
    case seeTrends
    /// Enough history for a meaningful doctor's summary.
    case doctorSummary

    var id: String { rawValue }

    /// Lower wins when several tips qualify at once.
    var priority: Int {
        switch self {
        case .trackADay: return 10
        case .seeTrends: return 20
        case .doctorSummary: return 30
        }
    }

    var icon: String {
        switch self {
        case .trackADay: return "calendar"
        case .seeTrends: return "chart.bar"
        case .doctorSummary: return "doc.richtext"
        }
    }

    var title: String {
        switch self {
        case .trackADay: return "Track how each day feels"
        case .seeTrends: return "Your trends are ready"
        case .doctorSummary: return "Heading to a doctor?"
        }
    }

    var message: String {
        switch self {
        case .trackADay:
            return "Tap any day on the calendar to mark it clear or not-clear — even migraine-free days tell a story."
        case .seeTrends:
            return "You've logged enough episodes to spot patterns. Take a look at your trends."
        case .doctorSummary:
            return "Export a one-page summary of your last 30 days and 6-month trend to share."
        }
    }

    var cta: TipCTA {
        switch self {
        case .trackADay: return .openCalendar
        case .seeTrends: return .openTrends
        case .doctorSummary: return .exportDoctorSummary
        }
    }

    /// When true, tapping the CTA dismisses the tip. Used for tips with no data
    /// signal that they were satisfied (you can't tell from data that someone
    /// "saw" their trends). `trackADay` instead clears once a day is tracked.
    var dismissesOnAction: Bool {
        switch self {
        case .seeTrends, .doctorSummary: return true
        case .trackADay: return false
        }
    }

    /// Episodes required before the "see your trends" tip is worth showing.
    static let trendsEpisodeThreshold = 3
    /// Days of history before the doctor-summary tip is worth showing.
    static let doctorSummaryDayThreshold = 30

    func isEligible(_ context: TipContext) -> Bool {
        switch self {
        case .trackADay:
            // Surgical: only once they're actually logging episodes but haven't
            // discovered daily tracking.
            return context.episodeCount >= 1 && !context.hasTrackedDay
        case .seeTrends:
            return context.episodeCount >= Self.trendsEpisodeThreshold
        case .doctorSummary:
            return context.daysOfHistory >= Self.doctorSummaryDayThreshold
        }
    }

    /// The single tip to show: highest-priority eligible, non-dismissed tip, or
    /// nil when there's nothing timely to say.
    static func select(context: TipContext, dismissed: Set<String>) -> Tip? {
        allCases
            .filter { !dismissed.contains($0.id) && $0.isEligible(context) }
            .min { $0.priority < $1.priority }
    }
}
