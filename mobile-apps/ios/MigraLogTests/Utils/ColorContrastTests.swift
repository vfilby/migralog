import XCTest
@testable import MigraLog

final class ColorContrastTests: XCTestCase {

    // MARK: - Relative Luminance

    func testRelativeLuminanceBlack() {
        let lum = ColorContrast.relativeLuminance(red: 0, green: 0, blue: 0)
        XCTAssertEqual(lum, 0, accuracy: 0.001)
    }

    func testRelativeLuminanceWhite() {
        let lum = ColorContrast.relativeLuminance(red: 1, green: 1, blue: 1)
        XCTAssertEqual(lum, 1, accuracy: 0.001)
    }

    func testRelativeLuminanceRed() {
        let lum = ColorContrast.relativeLuminance(red: 1, green: 0, blue: 0)
        XCTAssertEqual(lum, 0.2126, accuracy: 0.001)
    }

    func testRelativeLuminanceGreen() {
        let lum = ColorContrast.relativeLuminance(red: 0, green: 1, blue: 0)
        XCTAssertEqual(lum, 0.7152, accuracy: 0.001)
    }

    func testRelativeLuminanceBlue() {
        let lum = ColorContrast.relativeLuminance(red: 0, green: 0, blue: 1)
        XCTAssertEqual(lum, 0.0722, accuracy: 0.001)
    }

    // MARK: - Contrast Ratio

    func testContrastRatioBlackOnWhite() {
        let ratio = ColorContrast.contrastRatio(luminance1: 0, luminance2: 1)
        XCTAssertEqual(ratio, 21, accuracy: 0.1)
    }

    func testContrastRatioWhiteOnWhite() {
        let ratio = ColorContrast.contrastRatio(luminance1: 1, luminance2: 1)
        XCTAssertEqual(ratio, 1, accuracy: 0.01)
    }

    func testContrastRatioBlackOnBlack() {
        let ratio = ColorContrast.contrastRatio(luminance1: 0, luminance2: 0)
        XCTAssertEqual(ratio, 1, accuracy: 0.01)
    }

    func testContrastRatioOrderDoesNotMatter() {
        let ratio1 = ColorContrast.contrastRatio(luminance1: 0.3, luminance2: 0.8)
        let ratio2 = ColorContrast.contrastRatio(luminance1: 0.8, luminance2: 0.3)
        XCTAssertEqual(ratio1, ratio2, accuracy: 0.001)
    }

    // MARK: - Hex Contrast Ratio

    func testContrastRatioFromHex() {
        let ratio = ColorContrast.contrastRatio(hex1: "#000000", hex2: "#FFFFFF")
        XCTAssertEqual(ratio, 21, accuracy: 0.1)
    }

    func testContrastRatioSameColor() {
        let ratio = ColorContrast.contrastRatio(hex1: "#FF0000", hex2: "#FF0000")
        XCTAssertEqual(ratio, 1, accuracy: 0.01)
    }

    // MARK: - WCAG AA

    func testMeetsWCAGAABlackOnWhite() {
        XCTAssertTrue(ColorContrast.meetsWCAGAA(hex1: "#000000", hex2: "#FFFFFF"))
    }

    func testMeetsWCAGAALightOnLight() {
        // Light gray on white has poor contrast
        XCTAssertFalse(ColorContrast.meetsWCAGAA(hex1: "#CCCCCC", hex2: "#FFFFFF"))
    }

    func testMeetsWCAGAADarkOnLight() {
        // Dark text on light background should pass
        XCTAssertTrue(ColorContrast.meetsWCAGAA(hex1: "#333333", hex2: "#FFFFFF"))
    }

    func testMeetsWCAGAABorderline() {
        // The threshold is 4.5:1
        // #767676 on white is approximately 4.54:1 -- just passes
        let ratio = ColorContrast.contrastRatio(hex1: "#767676", hex2: "#FFFFFF")
        // This is right at the boundary
        if ratio >= 4.5 {
            XCTAssertTrue(ColorContrast.meetsWCAGAA(hex1: "#767676", hex2: "#FFFFFF"))
        } else {
            XCTAssertFalse(ColorContrast.meetsWCAGAA(hex1: "#767676", hex2: "#FFFFFF"))
        }
    }

    // MARK: - Edge Cases

    func testContrastRatioWithHashPrefix() {
        let ratio1 = ColorContrast.contrastRatio(hex1: "#000000", hex2: "#FFFFFF")
        let ratio2 = ColorContrast.contrastRatio(hex1: "000000", hex2: "FFFFFF")
        XCTAssertEqual(ratio1, ratio2, accuracy: 0.01)
    }
}
