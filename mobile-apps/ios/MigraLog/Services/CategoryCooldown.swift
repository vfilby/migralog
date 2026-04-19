import Foundation

/// Pure functions for evaluating category-wide cooldown state — the minimum
/// interval between any dose in a medication category (e.g. NSAIDs). Mirrors
/// `MedicationCooldown` but across meds within a category.
enum CategoryCooldown {
    struct Status: Equatable {
        let isOnCooldown: Bool
        let hoursSinceLastDose: Double?
        let hoursUntilNextDose: Double
        let minIntervalHours: Double?
        let lastMedicationName: String?
    }

    /// Evaluate category cooldown status.
    /// - Parameters:
    ///   - category: The category being evaluated (carried for future use; not
    ///     used today but keeps the signature symmetric with MedicationCooldown).
    ///   - lastDoseInCategory: The most recent 'taken' dose in the category and
    ///     its medication's display name, or nil if none.
    ///   - cooldownRule: The configured cooldown rule (type == .cooldown) or nil.
    ///   - now: The evaluation moment. Defaults to Date().
    static func evaluate(
        category: MedicationCategory,
        lastDoseInCategory: (dose: MedicationDose, medicationName: String)?,
        cooldownRule: CategorySafetyRule?,
        now: Date = Date()
    ) -> Status {
        guard let rule = cooldownRule, rule.type == .cooldown, rule.periodHours > 0 else {
            return Status(
                isOnCooldown: false,
                hoursSinceLastDose: nil,
                hoursUntilNextDose: 0,
                minIntervalHours: nil,
                lastMedicationName: lastDoseInCategory?.medicationName
            )
        }
        guard let last = lastDoseInCategory else {
            return Status(
                isOnCooldown: false,
                hoursSinceLastDose: nil,
                hoursUntilNextDose: 0,
                minIntervalHours: rule.periodHours,
                lastMedicationName: nil
            )
        }
        let elapsed = now.timeIntervalSince(last.dose.date) / 3600.0
        let remaining = max(0, rule.periodHours - elapsed)
        return Status(
            isOnCooldown: remaining > 0,
            hoursSinceLastDose: elapsed,
            hoursUntilNextDose: remaining,
            minIntervalHours: rule.periodHours,
            lastMedicationName: last.medicationName
        )
    }
}
