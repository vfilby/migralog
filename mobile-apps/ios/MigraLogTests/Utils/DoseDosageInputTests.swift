import XCTest
@testable import MigraLog

final class DoseDosageInputTests: XCTestCase {
    func testValidAmountAndUnit() {
        let parsed = DoseDosageInput.parse(amount: "50", unit: "mg")
        XCTAssertEqual(parsed?.amount, 50.0)
        XCTAssertEqual(parsed?.unit, "mg")
    }

    func testDecimalAmount() {
        let parsed = DoseDosageInput.parse(amount: "2.5", unit: "ml")
        XCTAssertEqual(parsed?.amount, 2.5)
        XCTAssertEqual(parsed?.unit, "ml")
    }

    func testTrimsWhitespace() {
        let parsed = DoseDosageInput.parse(amount: " 50 ", unit: " mg ")
        XCTAssertEqual(parsed?.amount, 50.0)
        XCTAssertEqual(parsed?.unit, "mg")
    }

    func testBothEmptyIsValidAndClears() {
        let parsed = DoseDosageInput.parse(amount: "", unit: "")
        XCTAssertNotNil(parsed)
        XCTAssertNil(parsed?.amount)
        XCTAssertNil(parsed?.unit)
    }

    func testAmountWithoutUnitIsInvalid() {
        XCTAssertNil(DoseDosageInput.parse(amount: "50", unit: ""))
    }

    func testUnitWithoutAmountIsInvalid() {
        XCTAssertNil(DoseDosageInput.parse(amount: "", unit: "mg"))
    }

    func testNonNumericAmountIsInvalid() {
        XCTAssertNil(DoseDosageInput.parse(amount: "abc", unit: "mg"))
    }

    func testZeroAmountIsInvalid() {
        XCTAssertNil(DoseDosageInput.parse(amount: "0", unit: "mg"))
    }

    func testNegativeAmountIsInvalid() {
        XCTAssertNil(DoseDosageInput.parse(amount: "-5", unit: "mg"))
    }
}
