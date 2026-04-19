import SwiftUI

/// Small banner rows shown above medication dose-log buttons to surface safety
/// information: per-medication cooldown, category-wide cooldown, and MOH risk.
/// Renders 0, 1, 2, or 3 lines depending on which statuses apply. Used on the
/// Dashboard rows, the Log Medication cards, and inside the Log Dose sheet.
struct MedicationSafetyBanners: View {
    /// Per-med cooldown status (pre-evaluated). Shown whenever the medication
    /// has a prior dose, regardless of whether the cooldown has expired.
    var cooldown: MedicationCooldown.Status?
    /// Category-wide cooldown status (pre-evaluated). Shown whenever a prior
    /// dose in the category exists AND a category cooldown rule is configured.
    var categoryCooldown: CategoryCooldown.Status?
    /// Category MOH status (pre-evaluated). Shown only when the status is
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

            if let categoryCooldown,
               let medicationCategory,
               let text = categoryCooldownText(categoryCooldown, category: medicationCategory) {
                Label(text, systemImage: "clock.arrow.2.circlepath")
                    .font(.caption)
                    .foregroundStyle(categoryCooldownColor(categoryCooldown))
                    .accessibilityIdentifier(medicationId.map { "category-cooldown-warning-\($0)" } ?? "")
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

    // MARK: - Per-med cooldown helpers

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

    // MARK: - Category cooldown helpers

    private func categoryCooldownText(_ status: CategoryCooldown.Status, category: MedicationCategory) -> String? {
        guard status.minIntervalHours != nil,
              let elapsed = status.hoursSinceLastDose,
              let medName = status.lastMedicationName else {
            return nil
        }
        let elapsedStr = formatDuration(elapsed)
        let categoryLabel = category.displayName
        if status.isOnCooldown {
            let waitStr = formatDuration(status.hoursUntilNextDose)
            return "Last \(categoryLabel) (\(medName)) \(elapsedStr) ago — wait \(waitStr)"
        }
        return "Last \(categoryLabel) (\(medName)) \(elapsedStr) ago"
    }

    private func categoryCooldownColor(_ status: CategoryCooldown.Status) -> Color {
        status.isOnCooldown ? .orange : .secondary
    }

    // MARK: - Duration formatting

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
