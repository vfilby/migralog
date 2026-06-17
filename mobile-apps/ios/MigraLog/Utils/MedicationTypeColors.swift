import SwiftUI

/// Medication type color definitions — see spec/functional-specification.md §5.2.
enum MedicationTypeColors {
    /// Get the badge color for a medication type, adapting to light/dark mode
    static func color(for type: MedicationType) -> Color {
        switch type {
        case .preventative: DesignTokens.Medication.preventative
        case .rescue: DesignTokens.Medication.rescue
        case .other: DesignTokens.Medication.other
        }
    }

    /// Get the display label for a medication type
    static func label(for type: MedicationType) -> String {
        switch type {
        case .preventative: "Preventative"
        case .rescue: "Rescue"
        case .other: "Other"
        }
    }
}
