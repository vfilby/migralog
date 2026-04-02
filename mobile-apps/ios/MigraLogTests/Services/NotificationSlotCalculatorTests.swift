import XCTest
@testable import MigraLog

final class NotificationSlotCalculatorTests: XCTestCase {

    // MARK: - calculateNotificationDays

    func testCalculateNotificationDays_zeroSlotsPerDay_returnsZero() {
        let result = NotificationSlotCalculator.calculateNotificationDays(slotsPerDay: 0)
        XCTAssertEqual(result, 0)
    }

    func testCalculateNotificationDays_oneSlotPerDay_returnsClamped14() {
        // 48 / 1 = 48, clamped to max 14
        let result = NotificationSlotCalculator.calculateNotificationDays(slotsPerDay: 1)
        XCTAssertEqual(result, 14)
    }

    func testCalculateNotificationDays_twoSlotsPerDay_returnsClamped14() {
        // 48 / 2 = 24, clamped to max 14
        let result = NotificationSlotCalculator.calculateNotificationDays(slotsPerDay: 2)
        XCTAssertEqual(result, 14)
    }

    func testCalculateNotificationDays_fourSlotsPerDay_returns12() {
        // 48 / 4 = 12
        let result = NotificationSlotCalculator.calculateNotificationDays(slotsPerDay: 4)
        XCTAssertEqual(result, 12)
    }

    func testCalculateNotificationDays_tenSlotsPerDay_returns4() {
        // 48 / 10 = 4 (integer division)
        let result = NotificationSlotCalculator.calculateNotificationDays(slotsPerDay: 10)
        XCTAssertEqual(result, 4)
    }

    func testCalculateNotificationDays_sixteenSlotsPerDay_returns3() {
        // 48 / 16 = 3
        let result = NotificationSlotCalculator.calculateNotificationDays(slotsPerDay: 16)
        XCTAssertEqual(result, 3)
    }

    func testCalculateNotificationDays_fortyEightSlotsPerDay_returnsClampedMinimum3() {
        // 48 / 48 = 1, clamped to min 3
        let result = NotificationSlotCalculator.calculateNotificationDays(slotsPerDay: 48)
        XCTAssertEqual(result, 3)
    }

    func testCalculateNotificationDays_hundredSlotsPerDay_returnsClampedMinimum3() {
        // 48 / 100 = 0, clamped to min 3
        let result = NotificationSlotCalculator.calculateNotificationDays(slotsPerDay: 100)
        XCTAssertEqual(result, 3)
    }

    // MARK: - slotsNeededPerDay

    func testSlotsNeededPerDay_noSchedules_returnsZero() {
        let result = NotificationSlotCalculator.slotsNeededPerDay(scheduleCount: 0, followUpCount: 0)
        XCTAssertEqual(result, 0)
    }

    func testSlotsNeededPerDay_twoSchedulesNoFollowUp_returnsTwo() {
        let result = NotificationSlotCalculator.slotsNeededPerDay(scheduleCount: 2, followUpCount: 0)
        XCTAssertEqual(result, 2)
    }

    func testSlotsNeededPerDay_twoSchedulesBothFollowUp_returnsFour() {
        let result = NotificationSlotCalculator.slotsNeededPerDay(scheduleCount: 2, followUpCount: 2)
        XCTAssertEqual(result, 4)
    }

    func testSlotsNeededPerDay_threeSchedulesOneFollowUp_returnsFour() {
        let result = NotificationSlotCalculator.slotsNeededPerDay(scheduleCount: 3, followUpCount: 1)
        XCTAssertEqual(result, 4)
    }

    // MARK: - Constants

    func testAvailableSlots_equals48() {
        XCTAssertEqual(NotificationSlotCalculator.availableSlots, 48)
    }

    func testReservedSlots_equals16() {
        XCTAssertEqual(NotificationSlotCalculator.reservedSlots, 16)
    }

    func testIosNotificationLimit_equals64() {
        XCTAssertEqual(NotificationSlotCalculator.iosNotificationLimit, 64)
    }
}
