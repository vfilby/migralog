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
    }

    func testLabelForMild() {
        XCTAssertEqual(PainScale.label(for: 1.5), "Mild")
        XCTAssertEqual(PainScale.label(for: 2.0), "Mild")
        XCTAssertEqual(PainScale.label(for: 3.0), "Mild")
    }

    func testLabelForUncomfortable() {
        XCTAssertEqual(PainScale.label(for: 4.0), "Uncomfortable")
    }

    func testLabelForModerate() {
        XCTAssertEqual(PainScale.label(for: 5.0), "Moderate")
    }

    func testLabelForDistressing() {
        XCTAssertEqual(PainScale.label(for: 6.0), "Distressing")
    }

    func testLabelForSevere() {
        XCTAssertEqual(PainScale.label(for: 7.0), "Severe")
    }

    func testLabelForIntense() {
        XCTAssertEqual(PainScale.label(for: 8.0), "Intense")
    }

    func testLabelForExcruciating() {
        XCTAssertEqual(PainScale.label(for: 9.0), "Excruciating")
    }

    func testLabelForDebilitating() {
        XCTAssertEqual(PainScale.label(for: 10.0), "Debilitating")
    }

    func testLabelForNegative() {
        // Clamped to 0
        XCTAssertEqual(PainScale.label(for: -1.0), "No Pain")
    }

    func testLabelForAboveTen() {
        // Clamped to 10
        XCTAssertEqual(PainScale.label(for: 11.0), "Debilitating")
    }

    // MARK: - Color Tests

    func testColorReturnsValueForEachRange() {
        // Verify each level returns a color without crashing
        for i in 0...10 {
            let _ = PainScale.color(for: Double(i))
        }
    }

    func testColorForOutOfRange() {
        // Negative clamps to 0 (green), above 10 clamps to 10 (purple)
        let negColor = PainScale.color(for: -1.0)
        let overColor = PainScale.color(for: 11.0)
        XCTAssertEqual(negColor, PainScale.color(for: 0))
        XCTAssertEqual(overColor, PainScale.color(for: 10))
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
