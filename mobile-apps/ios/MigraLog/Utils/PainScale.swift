import SwiftUI

/// Pain scale definitions — MUST match react-native/src/utils/painScale.ts exactly.
/// Reference: https://www.painscale.com/tools/migraine-pain-scale/
enum PainScale {
    struct Level {
        let value: Int
        let label: String
        let description: String
        let color: Color
    }

    static let levels: [Level] = [
        Level(value: 0, label: "No Pain", description: "Pain-free", color: Color(hex: "#2E7D32")),
        Level(value: 1, label: "Minimal", description: "Very mild, barely noticeable", color: Color(hex: "#558B2F")),
        Level(value: 2, label: "Mild", description: "Minor annoyance, can be ignored", color: Color(hex: "#689F38")),
        Level(value: 3, label: "Mild", description: "Noticeable but can function normally", color: Color(hex: "#F9A825")),
        Level(value: 4, label: "Uncomfortable", description: "Distracting but manageable", color: Color(hex: "#FF8F00")),
        Level(value: 5, label: "Moderate", description: "Interferes with concentration", color: Color(hex: "#EF6C00")),
        Level(value: 6, label: "Distressing", description: "Difficult to ignore, limits activities", color: Color(hex: "#E65100")),
        Level(value: 7, label: "Severe", description: "Dominant focus, impedes daily function", color: Color(hex: "#D84315")),
        Level(value: 8, label: "Intense", description: "Overwhelming, unable to function", color: Color(hex: "#C62828")),
        Level(value: 9, label: "Excruciating", description: "Unbearable, incapacitating", color: Color(hex: "#EC407A")),
        Level(value: 10, label: "Debilitating", description: "Worst imaginable, requires emergency care", color: Color(hex: "#AB47BC")),
    ]

    /// Get the pain level for an intensity value (0-10)
    static func level(for intensity: Double) -> Level {
        let index = max(0, min(10, Int(intensity.rounded())))
        return levels[index]
    }

    /// Get color for a pain intensity (0-10)
    static func color(for intensity: Double) -> Color {
        level(for: intensity).color
    }

    /// Get label for a pain intensity (0-10)
    static func label(for intensity: Double) -> String {
        level(for: intensity).label
    }

    /// Get full description for a pain intensity (0-10)
    static func description(for intensity: Double) -> String {
        let l = level(for: intensity)
        return "\(l.label): \(l.description)"
    }
}

// MARK: - Color extension for hex

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 6:
            (a, r, g, b) = (255, (int >> 16) & 0xFF, (int >> 8) & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = ((int >> 24) & 0xFF, (int >> 16) & 0xFF, (int >> 8) & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
