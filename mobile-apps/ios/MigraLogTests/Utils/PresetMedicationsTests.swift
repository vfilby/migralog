import XCTest
@testable import MigraLog

final class PresetMedicationsTests: XCTestCase {

    // MARK: - All Presets

    func testAllPresetsNotEmpty() {
        XCTAssertFalse(PresetMedications.all.isEmpty)
    }

    func testAllPresetsHaveNames() {
        for preset in PresetMedications.all {
            XCTAssertFalse(preset.name.isEmpty, "Preset medication should have a name")
        }
    }

    func testAllPresetsHavePositiveDosage() {
        for preset in PresetMedications.all {
            XCTAssertGreaterThan(preset.dosageAmount, 0, "\(preset.name) should have positive dosage")
        }
    }

    func testAllPresetsHaveDosageUnit() {
        for preset in PresetMedications.all {
            XCTAssertFalse(preset.dosageUnit.isEmpty, "\(preset.name) should have a dosage unit")
        }
    }

    func testAllPresetsHaveUniqueNames() {
        let names = PresetMedications.all.map(\.name)
        let uniqueNames = Set(names)
        XCTAssertEqual(names.count, uniqueNames.count, "All preset names should be unique")
    }

    // MARK: - Specific Medications

    func testContainsIbuprofen() {
        let result = PresetMedications.all.first { $0.name == "Ibuprofen" }
        XCTAssertNotNil(result)
        XCTAssertEqual(result?.type, .rescue)
        XCTAssertEqual(result?.dosageAmount, 400)
        XCTAssertEqual(result?.dosageUnit, "mg")
        XCTAssertEqual(result?.category, .nsaid)
    }

    func testContainsSumatriptan() {
        let result = PresetMedications.all.first { $0.name == "Sumatriptan" }
        XCTAssertNotNil(result)
        XCTAssertEqual(result?.type, .rescue)
        XCTAssertEqual(result?.category, .triptan)
    }

    func testContainsPreventativeMedications() {
        let preventatives = PresetMedications.all.filter { $0.type == .preventative }
        XCTAssertFalse(preventatives.isEmpty)
    }

    func testContainsRescueMedications() {
        let rescue = PresetMedications.all.filter { $0.type == .rescue }
        XCTAssertFalse(rescue.isEmpty)
    }

    // MARK: - Search

    func testSearchEmptyQuery() {
        let results = PresetMedications.search("")
        XCTAssertEqual(results.count, PresetMedications.all.count)
    }

    func testSearchByName() {
        let results = PresetMedications.search("ibuprofen")
        XCTAssertEqual(results.count, 1)
        XCTAssertEqual(results.first?.name, "Ibuprofen")
    }

    func testSearchCaseInsensitive() {
        let results = PresetMedications.search("SUMATRIPTAN")
        XCTAssertEqual(results.count, 1)
    }

    func testSearchPartialMatch() {
        let results = PresetMedications.search("triptan")
        // Should match Sumatriptan, Rizatriptan, Zolmitriptan, Eletriptan
        XCTAssertGreaterThanOrEqual(results.count, 4)
    }

    func testSearchNoMatch() {
        let results = PresetMedications.search("nonexistent_medication_xyz")
        XCTAssertTrue(results.isEmpty)
    }

    // MARK: - Get By Name

    func testGetByNameExists() {
        let result = PresetMedications.getByName("Ibuprofen")
        XCTAssertNotNil(result)
        XCTAssertEqual(result?.name, "Ibuprofen")
    }

    func testGetByNameCaseInsensitive() {
        let result = PresetMedications.getByName("ibuprofen")
        XCTAssertNotNil(result)
    }

    func testGetByNameNotFound() {
        let result = PresetMedications.getByName("NonexistentMed")
        XCTAssertNil(result)
    }

    // MARK: - Category Display Name

    func testCategoryDisplayName() {
        XCTAssertEqual(PresetMedications.categoryDisplayName(.otc), "OTC")
        XCTAssertEqual(PresetMedications.categoryDisplayName(.nsaid), "NSAID")
        XCTAssertEqual(PresetMedications.categoryDisplayName(.triptan), "Triptan")
        XCTAssertEqual(PresetMedications.categoryDisplayName(.cgrp), "CGRP")
        XCTAssertEqual(PresetMedications.categoryDisplayName(.preventive), "Preventive")
        XCTAssertEqual(PresetMedications.categoryDisplayName(.supplement), "Supplement")
        XCTAssertEqual(PresetMedications.categoryDisplayName(.other), "Other")
    }

    // MARK: - Schedule Frequencies

    func testPreventativesHaveFrequency() {
        let preventatives = PresetMedications.all.filter { $0.type == .preventative }
        for med in preventatives {
            XCTAssertNotNil(med.scheduleFrequency, "\(med.name) should have a schedule frequency")
        }
    }

    func testRescueMedsHaveNoFrequency() {
        let rescue = PresetMedications.all.filter { $0.type == .rescue }
        for med in rescue {
            XCTAssertNil(med.scheduleFrequency, "\(med.name) should not have a schedule frequency")
        }
    }

    // MARK: - Categories

    func testAllPresetsHaveCategory() {
        for preset in PresetMedications.all {
            XCTAssertNotNil(preset.category, "\(preset.name) should have a category")
        }
    }
}
