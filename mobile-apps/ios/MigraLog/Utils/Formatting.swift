import Foundation

enum MedicationFormatting {
    /// Format just the dosage: "200mg", "75mg", "1 capsule"
    static func formatDosage(amount: Double, unit: String) -> String {
        let amountStr = amount.truncatingRemainder(dividingBy: 1) == 0
            ? String(Int(amount))
            : String(format: "%.1f", amount)
        let needsSpace = unit.first?.isLetter == true && unit.first?.isUppercase == false
            && !["mg", "ml", "mcg", "g", "iu"].contains(unit.lowercased())
        return needsSpace ? "\(amountStr) \(unit)" : "\(amountStr)\(unit)"
    }

    /// Format a dose with quantity: "2 × 200mg", "1 × 75mg"
    static func formatDose(quantity: Double, amount: Double, unit: String) -> String {
        let qtyStr = quantity.truncatingRemainder(dividingBy: 1) == 0
            ? String(Int(quantity))
            : String(format: "%.1f", quantity)
        return "\(qtyStr) × \(formatDosage(amount: amount, unit: unit))"
    }

    static func formatMedicationDisplay(_ medication: Medication) -> String {
        "\(medication.name) · \(formatDosage(amount: medication.dosageAmount, unit: medication.dosageUnit))"
    }
}

enum AnalyticsFormatting {
    static func formatDayCount(_ count: Int, label: String) -> String {
        "\(count) \(label)\(count == 1 ? "" : "s")"
    }
}
