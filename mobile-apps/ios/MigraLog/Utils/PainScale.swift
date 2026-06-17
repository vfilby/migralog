import SwiftUI

/// Pain scale definitions — see spec/functional-specification.md §5.1.
/// Reference: https://www.painscale.com/tools/migraine-pain-scale/
enum PainScale {
    struct Level {
        let value: Int
        let label: String
        let description: String
        let color: Color
    }

    // Colors come from the shared palette in DesignTokens.Pain — the single
    // owner of the pain-scale hexes.
    static let levels: [Level] = [
        Level(value: 0, label: "No Pain", description: "Pain-free", color: DesignTokens.Pain.color(at: 0)),
        Level(value: 1, label: "Minimal", description: "Very mild, barely noticeable", color: DesignTokens.Pain.color(at: 1)),
        Level(value: 2, label: "Mild", description: "Minor annoyance, can be ignored", color: DesignTokens.Pain.color(at: 2)),
        Level(value: 3, label: "Mild", description: "Noticeable but can function normally", color: DesignTokens.Pain.color(at: 3)),
        Level(value: 4, label: "Uncomfortable", description: "Distracting but manageable", color: DesignTokens.Pain.color(at: 4)),
        Level(value: 5, label: "Moderate", description: "Interferes with concentration", color: DesignTokens.Pain.color(at: 5)),
        Level(value: 6, label: "Distressing", description: "Difficult to ignore, limits activities", color: DesignTokens.Pain.color(at: 6)),
        Level(value: 7, label: "Severe", description: "Dominant focus, impedes daily function", color: DesignTokens.Pain.color(at: 7)),
        Level(value: 8, label: "Intense", description: "Overwhelming, unable to function", color: DesignTokens.Pain.color(at: 8)),
        Level(value: 9, label: "Excruciating", description: "Unbearable, incapacitating", color: DesignTokens.Pain.color(at: 9)),
        Level(value: 10, label: "Debilitating", description: "Worst imaginable, requires emergency care", color: DesignTokens.Pain.color(at: 10)),
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

// Note: the `Color(hex:)` initializer now lives in DesignTokens.swift, the
// shared design-system source.
