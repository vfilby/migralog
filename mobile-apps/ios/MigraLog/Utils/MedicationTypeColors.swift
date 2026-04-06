import SwiftUI

/// Medication type color definitions — MUST match spec/functional-specification.md Section 5.2
/// and react-native/src/components/medication/MedicationBadges.tsx
enum MedicationTypeColors {
    /// Get the badge color for a medication type, adapting to light/dark mode
    static func color(for type: MedicationType) -> Color {
        switch type {
        case .preventative: Color(hex: "#32D65F") // green
        case .rescue: Color(hex: "#0066CC")       // blue
        case .other: Color(hex: "#AEAEB2")        // gray
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
