import SwiftUI

/// Small banner rows shown above medication dose-log buttons to surface safety
/// information: cooldown (minimum interval since last dose) and MOH (medication
/// overuse headache) risk. Renders 0, 1, or 2 lines depending on which statuses
/// apply. Used on the Dashboard rows, the Log Medication cards, and inside the
/// Log Dose sheet so the same info is visible everywhere a dose can be logged.
struct MedicationSafetyBanners: View {
    /// Cooldown status (pre-evaluated). Banner shown whenever the medication has
    /// a prior dose, regardless of whether the cooldown has expired — users still
    /// want to see how long it's been since their last dose.
    var cooldown: MedicationCooldown.Status?
    /// Category MOH status (pre-evaluated). Banner shown only when the status is
    /// `.approaching` or `.atOrOver` — below that, it's just noise.
    var categoryStatus: CategoryUsageStatus?
    /// The medication's category — required to format the MOH summary string.
    var medicationCategory: MedicationCategory?
    /// Used to build stable accessibility identifiers. When nil, identifiers are omitted.
    var medicationId: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let cooldown, let text = cooldownText(cooldown) {
                Label(text, systemImage: "clock.fill")
                    .font(.caption)
                    .foregroundStyle(cooldownColor(cooldown))
                    .accessibilityIdentifier(medicationId.map { "cooldown-warning-\($0)" } ?? "")
            }

            if let categoryStatus, categoryStatus.isWarning,
               let medicationCategory,
               let summary = categoryStatus.summary(category: medicationCategory) {
                Label(summary, systemImage: "exclamationmark.triangle.fill")
                    .font(.caption)
                    .foregroundStyle(categoryStatus.isStrong ? Color.red : Color.orange)
                    .accessibilityIdentifier(medicationId.map { "category-warning-\($0)" } ?? "")
            }
        }
    }

    private func cooldownText(_ status: MedicationCooldown.Status) -> String? {
        guard let elapsed = status.hoursSinceLastDose else { return nil }
        let elapsedStr = formatDuration(elapsed)
        if status.isOnCooldown {
            let waitStr = formatDuration(status.hoursUntilNextDose)
            return "Last dose \(elapsedStr) ago — wait \(waitStr)"
        }
        return "Last dose \(elapsedStr) ago"
    }

    private func cooldownColor(_ status: MedicationCooldown.Status) -> Color {
        status.isOnCooldown ? .orange : .secondary
    }

    /// Friendlier duration format than the existing `MedicationCooldown.summary`
    /// ("2h 15m" / "45m" / "2.1d") — shown inline with prose so decimal hours
    /// and bare "h"/"m" suffixes read awkwardly.
    private func formatDuration(_ hours: Double) -> String {
        if hours < 1 {
            let minutes = Int((hours * 60).rounded())
            return "\(minutes)m"
        }
        if hours < 24 {
            let wholeHours = Int(hours)
            let mins = Int(((hours - Double(wholeHours)) * 60).rounded())
            if mins == 0 { return "\(wholeHours)h" }
            return "\(wholeHours)h \(mins)m"
        }
        let days = Int(hours / 24)
        let remHours = Int(hours.truncatingRemainder(dividingBy: 24))
        if remHours == 0 { return "\(days)d" }
        return "\(days)d \(remHours)h"
    }
}
