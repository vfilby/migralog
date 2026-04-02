import XCTest
@testable import MigraLog

@MainActor
final class DailyCheckinSettingsViewModelTests: XCTestCase {
    private var defaults: UserDefaults!
    private var sut: DailyCheckinSettingsViewModel!

    private let suiteName = "DailyCheckinSettingsViewModelTests"

    override func setUp() {
        super.setUp()
        defaults = UserDefaults(suiteName: suiteName)!
        defaults.removePersistentDomain(forName: suiteName)
        sut = DailyCheckinSettingsViewModel(defaults: defaults)
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suiteName)
        defaults = nil
        sut = nil
        super.tearDown()
    }

    // MARK: - Default Values

    func testDefaultValues() {
        XCTAssertTrue(sut.enabled)
        XCTAssertEqual(sut.checkInTime, "09:00")
        XCTAssertFalse(sut.timeSensitive)
        XCTAssertNil(sut.error)
    }

    // MARK: - loadSettings

    func testLoadSettings_readsFromDefaults() {
        defaults.set(false, forKey: "daily_checkin_enabled")
        defaults.set("21:30", forKey: "daily_checkin_time")
        defaults.set(true, forKey: "daily_checkin_time_sensitive")

        sut.loadSettings()

        XCTAssertFalse(sut.enabled)
        XCTAssertEqual(sut.checkInTime, "21:30")
        XCTAssertTrue(sut.timeSensitive)
    }

    func testLoadSettings_defaults_whenEmpty() {
        sut.loadSettings()

        XCTAssertTrue(sut.enabled)
        XCTAssertEqual(sut.checkInTime, "09:00")
        XCTAssertFalse(sut.timeSensitive)
    }

    // MARK: - updateSettings

    func testUpdateSettings_enabledOnly() {
        sut.updateSettings(enabled: false)

        XCTAssertFalse(sut.enabled)
        XCTAssertEqual(defaults.object(forKey: "daily_checkin_enabled") as? Bool, false)
        // Other values unchanged
        XCTAssertEqual(sut.checkInTime, "09:00")
        XCTAssertFalse(sut.timeSensitive)
    }

    func testUpdateSettings_checkInTimeOnly() {
        sut.updateSettings(checkInTime: "20:00")

        XCTAssertEqual(sut.checkInTime, "20:00")
        XCTAssertEqual(defaults.string(forKey: "daily_checkin_time"), "20:00")
    }

    func testUpdateSettings_timeSensitiveOnly() {
        sut.updateSettings(timeSensitive: true)

        XCTAssertTrue(sut.timeSensitive)
        XCTAssertEqual(defaults.bool(forKey: "daily_checkin_time_sensitive"), true)
    }

    func testUpdateSettings_multipleValues() {
        sut.updateSettings(enabled: false, checkInTime: "22:00", timeSensitive: true)

        XCTAssertFalse(sut.enabled)
        XCTAssertEqual(sut.checkInTime, "22:00")
        XCTAssertTrue(sut.timeSensitive)
    }

    func testUpdateSettings_nilValues_noChange() {
        sut.updateSettings(enabled: false, checkInTime: "18:00", timeSensitive: true)

        sut.updateSettings()

        XCTAssertFalse(sut.enabled)
        XCTAssertEqual(sut.checkInTime, "18:00")
        XCTAssertTrue(sut.timeSensitive)
    }

    // MARK: - Persistence round-trip

    func testUpdateAndLoad_roundTrip() {
        sut.updateSettings(enabled: false, checkInTime: "07:30", timeSensitive: true)

        let vm2 = DailyCheckinSettingsViewModel(defaults: defaults)
        vm2.loadSettings()

        XCTAssertFalse(vm2.enabled)
        XCTAssertEqual(vm2.checkInTime, "07:30")
        XCTAssertTrue(vm2.timeSensitive)
    }

    func testLoadSettings_overwritesInMemoryValues() {
        sut.enabled = false
        sut.checkInTime = "23:59"
        sut.timeSensitive = true

        // Defaults have different values
        defaults.set(true, forKey: "daily_checkin_enabled")
        defaults.set("06:00", forKey: "daily_checkin_time")
        defaults.set(false, forKey: "daily_checkin_time_sensitive")

        sut.loadSettings()

        XCTAssertTrue(sut.enabled)
        XCTAssertEqual(sut.checkInTime, "06:00")
        XCTAssertFalse(sut.timeSensitive)
    }
}
