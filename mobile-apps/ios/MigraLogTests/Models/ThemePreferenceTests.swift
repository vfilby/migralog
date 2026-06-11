import SwiftUI
import XCTest
@testable import MigraLog

final class ThemePreferenceTests: XCTestCase {
    func test_light_forcesLightColorScheme() {
        XCTAssertEqual(ThemePreference.light.colorScheme, .light)
    }

    func test_dark_forcesDarkColorScheme() {
        XCTAssertEqual(ThemePreference.dark.colorScheme, .dark)
    }

    func test_system_followsSystemColorScheme() {
        XCTAssertNil(ThemePreference.system.colorScheme)
    }

    func test_rawValues_matchLegacyStoredStrings() {
        // The Settings picker historically stored these exact strings under
        // the `selectedTheme` key; the enum must keep decoding them.
        XCTAssertEqual(ThemePreference(rawValue: "light"), .light)
        XCTAssertEqual(ThemePreference(rawValue: "dark"), .dark)
        XCTAssertEqual(ThemePreference(rawValue: "system"), .system)
    }
}
