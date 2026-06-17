import SwiftUI

/// MigraLog design tokens — the single source of truth for brand colors,
/// domain color palettes, spacing, radius and typography.
///
/// Mirrors the brand guidelines in `website/branding.html` so the iOS app and
/// the marketing site stay visually in sync. When a value changes here it must
/// change there too (and vice-versa). Domain palettes (pain scale, medication
/// types) intentionally live here as well so every surface reads the same hex.
///
/// This file is compiled into both the app and the widget extension targets, so
/// it must not reference app-only domain types — the medication-type *mapping*
/// stays in `MedicationTypeColors.swift`; only the raw colors live here.
enum DesignTokens {

    // MARK: - Brand

    /// Core brand palette. Orange is the primary accent (see `AccentColor`),
    /// navy anchors headings and dark surfaces.
    enum Brand {
        static let navy = Color(hex: "#152233")
        static let navyLight = Color(hex: "#2A3D54")
        static let navyLighter = Color(hex: "#3F5875")

        static let orange = Color(hex: "#FF552A")        // primary accent
        static let orangeHover = Color(hex: "#E64D26")
        static let orangeLight = Color(hex: "#FF7055")
    }

    // MARK: - Neutrals

    /// Brand-neutral greys. Prefer the system semantic colors
    /// (`Color(.systemBackground)`, `.secondary`, …) for adaptive light/dark
    /// surfaces; reach for these only when a fixed brand neutral is required.
    enum Neutral {
        static let white = Color(hex: "#FFFFFF")
        static let gray50 = Color(hex: "#F8F9FA")
        static let gray600 = Color(hex: "#6C757D")
        static let gray900 = Color(hex: "#343A40")
        /// Tinted "orange 50" surface used behind orange iconography/callouts.
        static let orange50 = Color(hex: "#FFF8F0")
    }

    // MARK: - Semantic status

    /// Success / danger pairs (text foreground, fill background, border) used by
    /// added/removed badges and resolved/active episode chrome.
    enum Status {
        static let successText = Color(hex: "#2E7D32")
        static let successFill = Color(hex: "#E8F5E9")
        static let successBorder = Color(hex: "#66BB6A")

        static let dangerText = Color(hex: "#C62828")
        static let dangerFill = Color(hex: "#FFEBEE")
        static let dangerBorder = Color(hex: "#FFCDD2")
    }

    // MARK: - Pain scale (0–10)

    /// Pain-intensity gradient from 0 (calm green) through orange to 10 (purple).
    /// The single owner of these hexes — `PainScale` and the intensity sparkline
    /// both read from here. See spec/functional-specification.md §5.1.
    enum Pain {
        static let palette: [Color] = [
            Color(hex: "#2E7D32"), // 0  — Dark green
            Color(hex: "#558B2F"), // 1
            Color(hex: "#689F38"), // 2
            Color(hex: "#F9A825"), // 3
            Color(hex: "#FF8F00"), // 4
            Color(hex: "#EF6C00"), // 5
            Color(hex: "#E65100"), // 6
            Color(hex: "#D84315"), // 7
            Color(hex: "#C62828"), // 8
            Color(hex: "#EC407A"), // 9
            Color(hex: "#AB47BC"), // 10 — Purple
        ]

        /// Color for a 0–10 pain level, clamped into range.
        static func color(at level: Int) -> Color {
            palette[max(0, min(palette.count - 1, level))]
        }
    }

    // MARK: - Medication types

    /// Raw medication-type badge colors. Type → color mapping stays in
    /// `MedicationTypeColors`. See spec/functional-specification.md §5.2.
    enum Medication {
        static let preventative = Color(hex: "#32D65F") // green
        static let rescue = Color(hex: "#0066CC")       // blue
        static let other = Color(hex: "#AEAEB2")        // gray
    }

    // MARK: - Live Activity

    /// Episode Live Activity accents. Kept as exact sRGB components to preserve
    /// the existing rendered tints.
    enum LiveActivity {
        /// Warm red for the active-episode icon, keyline and duration emphasis.
        static let active = Color(red: 0.84, green: 0.23, blue: 0.30)
        /// Softer tint for the post-episode close state.
        static let calm = Color(red: 0.30, green: 0.55, blue: 0.50)
    }

    // MARK: - Spacing

    /// 4-pt spacing scale. Use for stack spacing, padding and gaps.
    enum Spacing {
        static let xs: CGFloat = 4
        static let sm: CGFloat = 8
        static let md: CGFloat = 12
        static let lg: CGFloat = 16
        static let xl: CGFloat = 24
        static let xxl: CGFloat = 32
    }

    // MARK: - Radius

    /// Corner-radius scale. `lg` (12) is the default card/button radius.
    enum Radius {
        static let sm: CGFloat = 4
        static let md: CGFloat = 8
        static let lg: CGFloat = 12
        static let pill: CGFloat = 999
    }

    // MARK: - Typography

    /// Display font sizes used for hero/empty-state numerals and glyphs that sit
    /// outside Dynamic Type's text styles. Body/heading text should keep using
    /// the semantic styles (`.largeTitle`, `.headline`, `.caption`, …) so it
    /// scales with the user's accessibility settings.
    enum Typography {
        static let displayXL: CGFloat = 80
        static let displayLarge: CGFloat = 60
        static let displayMedium: CGFloat = 56
    }
}

// MARK: - Color(hex:)

extension Color {
    /// Create a Color from a `#RRGGBB` or `#AARRGGBB` hex string.
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
