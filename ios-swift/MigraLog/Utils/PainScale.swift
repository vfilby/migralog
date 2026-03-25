import SwiftUI

enum PainScale {
    /// Get color for a pain intensity (0-10)
    static func color(for intensity: Double) -> Color {
        switch intensity {
        case 0..<1: return Color(hex: "#4CAF50")    // Green
        case 1..<2: return Color(hex: "#66BB6A")
        case 2..<3: return Color(hex: "#8BC34A")    // Light green
        case 3..<4: return Color(hex: "#CDDC39")    // Lime
        case 4..<5: return Color(hex: "#FFC107")    // Amber
        case 5..<6: return Color(hex: "#FF9800")    // Orange
        case 6..<7: return Color(hex: "#FF5722")    // Deep orange
        case 7..<8: return Color(hex: "#F44336")    // Red
        case 8..<9: return Color(hex: "#E91E63")    // Pink
        case 9...10: return Color(hex: "#9C27B0")   // Purple
        default: return Color.gray
        }
    }

    /// Get label for a pain intensity (0-10)
    static func label(for intensity: Double) -> String {
        switch intensity {
        case 0: return "No Pain"
        case 0..<2: return "Minimal"
        case 2..<4: return "Mild"
        case 4..<6: return "Moderate"
        case 6..<8: return "Severe"
        case 8..<10: return "Very Severe"
        case 10: return "Worst Possible"
        default: return "Unknown"
        }
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
