import XCTest
@testable import MigraLog

final class MedicationCategoryTests: XCTestCase {
    func test_mohPreset_forNSAID_is15DaysIn30Days() {
        let preset = MedicationCategory.nsaid.mohPreset
        XCTAssertEqual(preset?.maxDays, 15)
        XCTAssertEqual(preset?.windowDays, 30)
    }

    func test_mohPreset_forTriptan_is10DaysIn30Days() {
        let preset = MedicationCategory.triptan.mohPreset
        XCTAssertEqual(preset?.maxDays, 10)
        XCTAssertEqual(preset?.windowDays, 30)
    }

    func test_mohPreset_forOTC_isNil() {
        XCTAssertNil(MedicationCategory.otc.mohPreset)
    }

    func test_mohPreset_forCGRP_isNil() {
        XCTAssertNil(MedicationCategory.cgrp.mohPreset)
    }

    func test_mohPreset_forPreventive_isNil() {
        XCTAssertNil(MedicationCategory.preventive.mohPreset)
    }

    func test_mohPreset_forSupplement_isNil() {
        XCTAssertNil(MedicationCategory.supplement.mohPreset)
    }

    func test_mohPreset_forOther_isNil() {
        XCTAssertNil(MedicationCategory.other.mohPreset)
    }
}
