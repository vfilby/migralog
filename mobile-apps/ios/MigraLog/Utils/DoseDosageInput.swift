import Foundation

/// Parses the dosage amount/unit text fields on the dose edit screens.
enum DoseDosageInput {
    /// Returns the parsed dosage, or nil if the input is invalid.
    /// Both fields empty is valid and yields (nil, nil) — doses logged before
    /// dosage snapshots existed have no values to preserve.
    static func parse(amount: String, unit: String) -> (amount: Double?, unit: String?)? {
        let trimmedAmount = amount.trimmingCharacters(in: .whitespaces)
        let trimmedUnit = unit.trimmingCharacters(in: .whitespaces)
        if trimmedAmount.isEmpty && trimmedUnit.isEmpty {
            return (nil, nil)
        }
        guard let value = Double(trimmedAmount), value > 0, !trimmedUnit.isEmpty else {
            return nil
        }
        return (value, trimmedUnit)
    }
}
