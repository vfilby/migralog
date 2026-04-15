import Foundation

/// Status for per-category medication usage against a configured limit.
/// Powers MOH (medication overuse headache) risk warnings on dose-log buttons.
enum CategoryUsageStatus: Equatable {
    case noLimit
    case ok(daysUsed: Int, maxDays: Int, windowDays: Int)
    case approaching(daysUsed: Int, maxDays: Int, windowDays: Int)
    case atOrOver(daysUsed: Int, maxDays: Int, windowDays: Int)

    /// Thresholds:
    /// - `atOrOver` when `daysUsed >= maxDays`
    /// - `approaching` when `daysUsed >= maxDays - 2` (i.e. max-2, max-1)
    /// - `ok` otherwise
    static func evaluate(daysUsed: Int, limit: CategoryUsageLimit?) -> CategoryUsageStatus {
        guard let limit else { return .noLimit }
        if daysUsed >= limit.maxDays {
            return .atOrOver(daysUsed: daysUsed, maxDays: limit.maxDays, windowDays: limit.windowDays)
        }
        if daysUsed >= limit.maxDays - 2 {
            return .approaching(daysUsed: daysUsed, maxDays: limit.maxDays, windowDays: limit.windowDays)
        }
        return .ok(daysUsed: daysUsed, maxDays: limit.maxDays, windowDays: limit.windowDays)
    }

    /// Short UI summary, e.g. "NSAIDs used 13 of 15 days in last 30".
    /// Returns nil when there is no limit or when usage is safely under threshold.
    func summary(category: MedicationCategory) -> String? {
        switch self {
        case .noLimit, .ok:
            return nil
        case .approaching(let used, let max, let window),
             .atOrOver(let used, let max, let window):
            return "\(category.displayName) used \(used) of \(max) days in last \(window)"
        }
    }

    /// True when a warning (either approaching or at/over) should be shown.
    var isWarning: Bool {
        switch self {
        case .approaching, .atOrOver: return true
        default: return false
        }
    }

    /// True when the warning is the strong (red) variant.
    var isStrong: Bool {
        if case .atOrOver = self { return true }
        return false
    }
}
