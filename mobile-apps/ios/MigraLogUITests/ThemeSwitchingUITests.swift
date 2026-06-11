import XCTest

/// Regression tests for the Settings theme picker. The picker used to persist
/// `selectedTheme` without anything applying it (`preferredColorScheme` was
/// never set), so switching themes had no visible effect. These tests assert
/// the rendered appearance actually changes by comparing screen luminance —
/// element-existence checks alone cannot catch that failure mode.
final class ThemeSwitchingUITests: XCTestCase {
    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = UITestHelpers.launchCleanDashboard()
        UITestHelpers.waitForDashboard(in: app)
    }

    override func tearDownWithError() throws {
        app = nil
    }

    func testSwitchingThemeChangesRenderedAppearance() throws {
        openSettings()

        tapTheme("theme-light")
        let lightLuminance = meanScreenLuminance()

        tapTheme("theme-dark")
        let darkLuminance = meanScreenLuminance()

        XCTAssertGreaterThan(lightLuminance, 0.5,
                             "Light theme should render a predominantly light screen")
        XCTAssertLessThan(darkLuminance, 0.5,
                          "Dark theme should render a predominantly dark screen")
        XCTAssertLessThan(darkLuminance, lightLuminance - 0.2,
                          "Switching light → dark should visibly darken the screen")

        // Back to system so the picker round-trips through every option.
        tapTheme("theme-system")
    }

    func testThemeSelectionPersistsAcrossRelaunch() throws {
        openSettings()
        tapTheme("theme-dark")

        // Relaunch WITHOUT --reset-database so UserDefaults survive.
        app.terminate()
        app = XCUIApplication()
        app.launchArguments = ["--uitesting", "--skip-onboarding"]
        app.launch()
        UITestHelpers.waitForDashboard(in: app)

        let luminance = meanScreenLuminance()
        XCTAssertLessThan(luminance, 0.5,
                          "Dark theme should still be applied after relaunch")
    }

    // MARK: - Helpers

    private func openSettings() {
        let settingsButton = app.buttons["settings-button"]
        UITestHelpers.waitForHittable(settingsButton)
        settingsButton.tap()

        let settingsTitle = app.navigationBars.staticTexts["Settings"]
        UITestHelpers.waitForElement(settingsTitle)
    }

    private func tapTheme(_ identifier: String) {
        let segment = app.buttons[identifier]
        UITestHelpers.waitForHittable(segment)
        segment.tap()
        // Allow the appearance transition to settle before screenshotting.
        Thread.sleep(forTimeInterval: UITestHelpers.animationWait)
    }

    /// Mean luminance (0 = black, 1 = white) of the app's current screenshot,
    /// sampled on a sparse grid. Text and accent colors are a small minority of
    /// pixels, so the mean cleanly separates light and dark appearances.
    private func meanScreenLuminance(file: StaticString = #file, line: UInt = #line) -> Double {
        guard let cgImage = app.screenshot().image.cgImage else {
            XCTFail("Could not capture screenshot pixels", file: file, line: line)
            return 0
        }

        let width = cgImage.width
        let height = cgImage.height
        var pixels = [UInt8](repeating: 0, count: width * height * 4)
        guard let context = CGContext(
            data: &pixels,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: width * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else {
            XCTFail("Could not create bitmap context", file: file, line: line)
            return 0
        }
        context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))

        let stride = 16
        var total = 0.0
        var count = 0
        for y in Swift.stride(from: 0, to: height, by: stride) {
            for x in Swift.stride(from: 0, to: width, by: stride) {
                let offset = (y * width + x) * 4
                let red = Double(pixels[offset])
                let green = Double(pixels[offset + 1])
                let blue = Double(pixels[offset + 2])
                total += (0.299 * red + 0.587 * green + 0.114 * blue) / 255.0
                count += 1
            }
        }
        return total / Double(count)
    }
}
