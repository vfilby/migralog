import Foundation

enum MedicationFormatting {
    static func formatDosage(amount: Double, unit: String) -> String {
        let amountStr = amount.truncatingRemainder(dividingBy: 1) == 0
            ? String(Int(amount))
            : String(format: "%.1f", amount)
        if unit.lowercased() == "tablets" || unit.lowercased() == "capsules" {
            return "\(amountStr) \(unit)"
        }
        return "\(amountStr)\(unit)"
    }

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
