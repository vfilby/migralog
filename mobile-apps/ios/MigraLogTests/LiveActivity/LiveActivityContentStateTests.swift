import XCTest
@testable import MigraLog

/// Tests the pure content-state assembly that backs the episode Live Activity,
/// focusing on the "Show Medication Names" privacy rule (#416 Phase 5).
final class LiveActivityContentStateTests: XCTestCase {
    private let takenAt = Date(timeIntervalSince1970: 1_000)

    func testShowsMedicationNameWhenEnabled() {
        let state = LiveActivityManager.makeContentState(
            intensity: 7,
            rescue: (name: "Sumatriptan", takenAt: takenAt),
            showMedicationNames: true,
            endedAt: nil
        )
        XCTAssertEqual(state.lastRescueMedName, "Sumatriptan")
        XCTAssertEqual(state.lastRescueMedAt, takenAt)
        XCTAssertEqual(state.currentIntensity, 7)
        XCTAssertFalse(state.isEnded)
    }

    func testHidesMedicationNameWhenDisabled() {
        let state = LiveActivityManager.makeContentState(
            intensity: nil,
            rescue: (name: "Sumatriptan", takenAt: takenAt),
            showMedicationNames: false,
            endedAt: nil
        )
        XCTAssertEqual(state.lastRescueMedName, LiveActivityManager.genericRescueName)
        XCTAssertNotEqual(state.lastRescueMedName, "Sumatriptan")
        // Timing is still surfaced even when the name is hidden.
        XCTAssertEqual(state.lastRescueMedAt, takenAt)
    }

    func testNoRescueDoseYieldsNilNameRegardlessOfPrivacy() {
        for show in [true, false] {
            let state = LiveActivityManager.makeContentState(
                intensity: 5,
                rescue: nil,
                showMedicationNames: show,
                endedAt: nil
            )
            XCTAssertNil(state.lastRescueMedName)
            XCTAssertNil(state.lastRescueMedAt)
            XCTAssertEqual(state.currentIntensity, 5)
        }
    }

    func testEndedAtPassedThrough() {
        let endedAt = Date(timeIntervalSince1970: 5_000)
        let state = LiveActivityManager.makeContentState(
            intensity: nil,
            rescue: nil,
            showMedicationNames: true,
            endedAt: endedAt
        )
        XCTAssertEqual(state.endedAt, endedAt)
        XCTAssertTrue(state.isEnded)
    }
}
