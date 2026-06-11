import SwiftUI

/// User-selected appearance preference, persisted in UserDefaults under
/// `selectedTheme`. Raw values match the strings the Settings picker has
/// always stored, so existing selections carry over.
enum ThemePreference: String, CaseIterable, Identifiable {
    case light
    case dark
    case system

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .light: return "Light"
        case .dark: return "Dark"
        case .system: return "System"
        }
    }

    /// The color scheme to force on the window, or nil to follow the system.
    var colorScheme: ColorScheme? {
        switch self {
        case .light: return .light
        case .dark: return .dark
        case .system: return nil
        }
    }
}
