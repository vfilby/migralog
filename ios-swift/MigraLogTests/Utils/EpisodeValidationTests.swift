import XCTest
@testable import MigraLog

final class EpisodeValidationTests: XCTestCase {

    // MARK: - End Time Validation

    func testValidEndTimeAfterStartTime() {
        let result = EpisodeValidation.validateEndTime(startTime: 1000, endTime: 2000)
        XCTAssertTrue(result.isValid)
        XCTAssertNil(result.error)
    }

    func testNilEndTimeIsValid() {
        let result = EpisodeValidation.validateEndTime(startTime: 1000, endTime: nil)
        XCTAssertTrue(result.isValid)
        XCTAssertNil(result.error)
    }

    func testEndTimeBeforeStartTimeIsInvalid() {
        let result = EpisodeValidation.validateEndTime(startTime: 2000, endTime: 1000)
        XCTAssertFalse(result.isValid)
        XCTAssertNotNil(result.error)
        XCTAssertEqual(result.error, "End time must be after start time")
    }

    func testEndTimeEqualToStartTimeIsInvalid() {
        let result = EpisodeValidation.validateEndTime(startTime: 1000, endTime: 1000)
        XCTAssertFalse(result.isValid)
        XCTAssertNotNil(result.error)
    }

    // MARK: - Intensity Validation

    func testValidIntensityZero() {
        let result = EpisodeValidation.validateIntensity(0)
        XCTAssertTrue(result.isValid)
        XCTAssertNil(result.error)
    }

    func testValidIntensityTen() {
        let result = EpisodeValidation.validateIntensity(10)
        XCTAssertTrue(result.isValid)
        XCTAssertNil(result.error)
    }

    func testValidIntensityMidRange() {
        let result = EpisodeValidation.validateIntensity(5.5)
        XCTAssertTrue(result.isValid)
    }

    func testNegativeIntensityIsInvalid() {
        let result = EpisodeValidation.validateIntensity(-1)
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.error, "Intensity must be between 0 and 10")
    }

    func testIntensityAboveTenIsInvalid() {
        let result = EpisodeValidation.validateIntensity(10.1)
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.error, "Intensity must be between 0 and 10")
    }

    // MARK: - Dose Quantity Validation

    func testValidDoseQuantity() {
        let result = EpisodeValidation.validateDoseQuantity(1.0)
        XCTAssertTrue(result.isValid)
        XCTAssertNil(result.error)
    }

    func testValidDoseQuantityFractional() {
        let result = EpisodeValidation.validateDoseQuantity(0.5)
        XCTAssertTrue(result.isValid)
    }

    func testZeroDoseQuantityIsInvalid() {
        let result = EpisodeValidation.validateDoseQuantity(0)
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.error, "Invalid Amount")
    }

    func testNegativeDoseQuantityIsInvalid() {
        let result = EpisodeValidation.validateDoseQuantity(-1)
        XCTAssertFalse(result.isValid)
        XCTAssertEqual(result.error, "Invalid Amount")
    }

    // MARK: - ValidationResult

    func testValidationResultProperties() {
        let valid = EpisodeValidation.ValidationResult(isValid: true, error: nil)
        XCTAssertTrue(valid.isValid)
        XCTAssertNil(valid.error)

        let invalid = EpisodeValidation.ValidationResult(isValid: false, error: "Bad input")
        XCTAssertFalse(invalid.isValid)
        XCTAssertEqual(invalid.error, "Bad input")
    }
}
