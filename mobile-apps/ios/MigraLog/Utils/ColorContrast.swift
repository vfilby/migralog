import SwiftUI

enum ColorContrast {
    /// Calculate the relative luminance of an sRGB color
    static func relativeLuminance(red: Double, green: Double, blue: Double) -> Double {
        func linearize(_ component: Double) -> Double {
            component <= 0.03928
                ? component / 12.92
                : pow((component + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue)
    }

    /// Calculate the contrast ratio between two luminance values
    static func contrastRatio(luminance1: Double, luminance2: Double) -> Double {
        let lighter = max(luminance1, luminance2)
        let darker = min(luminance1, luminance2)
        return (lighter + 0.05) / (darker + 0.05)
    }

    /// Calculate contrast ratio from hex strings
    static func contrastRatio(hex1: String, hex2: String) -> Double {
        let (r1, g1, b1) = hexToRGB(hex1)
        let (r2, g2, b2) = hexToRGB(hex2)
        let lum1 = relativeLuminance(red: r1, green: g1, blue: b1)
        let lum2 = relativeLuminance(red: r2, green: g2, blue: b2)
        return contrastRatio(luminance1: lum1, luminance2: lum2)
    }

    /// Check if two colors meet WCAG AA standard (4.5:1 for normal text)
    static func meetsWCAGAA(hex1: String, hex2: String) -> Bool {
        contrastRatio(hex1: hex1, hex2: hex2) >= 4.5
    }

    private static func hexToRGB(_ hex: String) -> (Double, Double, Double) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r = Double((int >> 16) & 0xFF) / 255.0
        let g = Double((int >> 8) & 0xFF) / 255.0
        let b = Double(int & 0xFF) / 255.0
        return (r, g, b)
    }
}
