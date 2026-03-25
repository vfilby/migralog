import XCTest
import SwiftUI
@testable import MigraLog

final class PainScaleTests: XCTestCase {

    // MARK: - Label Tests

    func testLabelForZero() {
        XCTAssertEqual(PainScale.label(for: 0), "No Pain")
    }

    func testLabelForMinimal() {
        XCTAssertEqual(PainScale.label(for: 0.5), "Minimal")
        XCTAssertEqual(PainScale.label(for: 1.0), "Minimal")
        XCTAssertEqual(PainScale.label(for: 1.9), "Minimal")
    }

    func testLabelForMild() {
        XCTAssertEqual(PainScale.label(for: 2.0), "Mild")
        XCTAssertEqual(PainScale.label(for: 3.5), "Mild")
    }

    func testLabelForModerate() {
        XCTAssertEqual(PainScale.label(for: 4.0), "Moderate")
        XCTAssertEqual(PainScale.label(for: 5.5), "Moderate")
    }

    func testLabelForSevere() {
        XCTAssertEqual(PainScale.label(for: 6.0), "Severe")
        XCTAssertEqual(PainScale.label(for: 7.5), "Severe")
    }

    func testLabelForVerySevere() {
        XCTAssertEqual(PainScale.label(for: 8.0), "Very Severe")
        XCTAssertEqual(PainScale.label(for: 9.5), "Very Severe")
    }

    func testLabelForWorstPossible() {
        XCTAssertEqual(PainScale.label(for: 10.0), "Worst Possible")
    }

    func testLabelForNegative() {
        XCTAssertEqual(PainScale.label(for: -1.0), "Unknown")
    }

    func testLabelForAboveTen() {
        XCTAssertEqual(PainScale.label(for: 11.0), "Unknown")
    }

    // MARK: - Color Tests

    func testColorReturnsValueForEachRange() {
        // Verify each range returns a color without crashing
        let intensities: [Double] = [0, 0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10]
        for intensity in intensities {
            // Just ensure it returns a Color without crashing
            let _ = PainScale.color(for: intensity)
        }
    }

    func testColorForOutOfRange() {
        // Negative and above 10 should return gray
        let negColor = PainScale.color(for: -1.0)
        let overColor = PainScale.color(for: 11.0)
        // Both should be gray (default case)
        XCTAssertEqual(negColor, Color.gray)
        XCTAssertEqual(overColor, Color.gray)
    }

    // MARK: - Color Hex Extension

    func testColorHexInitSixDigit() {
        let color = Color(hex: "#FF0000")
        // Red color - just ensure it doesn't crash
        XCTAssertNotNil(color)
    }

    func testColorHexInitWithoutHash() {
        let color = Color(hex: "00FF00")
        XCTAssertNotNil(color)
    }

    func testColorHexInitEightDigit() {
        let color = Color(hex: "#80FF0000")
        XCTAssertNotNil(color)
    }

    func testColorHexInitInvalidLength() {
        let color = Color(hex: "FFF")
        // Should default to black
        XCTAssertNotNil(color)
    }
}
