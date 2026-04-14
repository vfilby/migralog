import Foundation

/// Pure functions for evaluating medication dose cooldown state.
enum MedicationCooldown {
    struct Status: Equatable {
        let isOnCooldown: Bool
        let hoursSinceLastDose: Double?  // nil if no prior dose
        let hoursUntilNextDose: Double   // 0 if not on cooldown
        let minIntervalHours: Double?
    }

    static func evaluate(
        medication: Medication,
        lastDose: MedicationDose?,
        now: Date = Date()
    ) -> Status {
        guard let interval = medication.minIntervalHours, interval > 0 else {
            return Status(
                isOnCooldown: false,
                hoursSinceLastDose: nil,
                hoursUntilNextDose: 0,
                minIntervalHours: nil
            )
        }
        guard let last = lastDose else {
            return Status(
                isOnCooldown: false,
                hoursSinceLastDose: nil,
                hoursUntilNextDose: 0,
                minIntervalHours: interval
            )
        }
        let elapsed = now.timeIntervalSince(last.date) / 3600.0
        let remaining = max(0, interval - elapsed)
        return Status(
            isOnCooldown: remaining > 0,
            hoursSinceLastDose: elapsed,
            hoursUntilNextDose: remaining,
            minIntervalHours: interval
        )
    }

    /// Short human-friendly summary: "Last dose 3h ago — wait 21h"
    static func summary(_ status: Status) -> String? {
        guard let elapsed = status.hoursSinceLastDose else { return nil }
        let elapsedStr = formatHours(elapsed)
        if status.isOnCooldown {
            let waitStr = formatHours(status.hoursUntilNextDose)
            return "Last dose \(elapsedStr) ago — wait \(waitStr)"
        } else {
            return "Last dose \(elapsedStr) ago"
        }
    }

    private static func formatHours(_ hours: Double) -> String {
        if hours < 1 {
            let minutes = Int((hours * 60).rounded())
            return "\(minutes)m"
        } else if hours < 24 {
            return String(format: "%.1fh", hours)
        } else {
            return String(format: "%.1fd", hours / 24)
        }
    }
}
