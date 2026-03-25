import XCTest
@testable import MigraLog

@MainActor
final class AddMedicationViewModelTests: XCTestCase {
    private var mockRepo: MockMedicationRepository!
    private var sut: AddMedicationViewModel!

    override func setUp() {
        super.setUp()
        mockRepo = MockMedicationRepository()
        sut = AddMedicationViewModel(medicationRepository: mockRepo)
    }

    // MARK: - Initial State

    func testInitialState_defaultValues() {
        XCTAssertEqual(sut.name, "")
        XCTAssertEqual(sut.type, .rescue)
        XCTAssertEqual(sut.dosageAmount, 0)
        XCTAssertEqual(sut.dosageUnit, "mg")
        XCTAssertNil(sut.category)
        XCTAssertNil(sut.scheduleFrequency)
        XCTAssertEqual(sut.notes, "")
        XCTAssertTrue(sut.searchResults.isEmpty)
        XCTAssertFalse(sut.isSaving)
        XCTAssertNil(sut.error)
        XCTAssertFalse(sut.isEditing)
    }

    func testInit_withExistingMedication_populatesFields() {
        let med = TestFixtures.makeMedication(
            id: "med-1",
            name: "Topiramate",
            type: .preventative,
            dosageAmount: 50,
            dosageUnit: "mg",
            category: .preventive,
            scheduleFrequency: .daily
        )

        sut = AddMedicationViewModel(medicationRepository: mockRepo, existingMedication: med)

        XCTAssertEqual(sut.name, "Topiramate")
        XCTAssertEqual(sut.type, .preventative)
        XCTAssertEqual(sut.dosageAmount, 50)
        XCTAssertEqual(sut.dosageUnit, "mg")
        XCTAssertEqual(sut.category, .preventive)
        XCTAssertEqual(sut.scheduleFrequency, .daily)
        XCTAssertTrue(sut.isEditing)
    }

    func testInit_withExistingMedication_nilNotes_setsEmptyString() {
        let med = TestFixtures.makeMedication(id: "med-1", name: "Ibuprofen")
        // TestFixtures.makeMedication sets notes to nil

        sut = AddMedicationViewModel(medicationRepository: mockRepo, existingMedication: med)

        XCTAssertEqual(sut.notes, "")
    }

    // MARK: - Validation

    func testIsValid_emptyName_returnsFalse() {
        sut.name = ""
        sut.dosageAmount = 100
        sut.dosageUnit = "mg"

        XCTAssertFalse(sut.isValid)
    }

    func testIsValid_whitespaceOnlyName_returnsFalse() {
        sut.name = "   "
        sut.dosageAmount = 100
        sut.dosageUnit = "mg"

        XCTAssertFalse(sut.isValid)
    }

    func testIsValid_zeroDosage_returnsFalse() {
        sut.name = "Ibuprofen"
        sut.dosageAmount = 0
        sut.dosageUnit = "mg"

        XCTAssertFalse(sut.isValid)
    }

    func testIsValid_negativeDosage_returnsFalse() {
        sut.name = "Ibuprofen"
        sut.dosageAmount = -10
        sut.dosageUnit = "mg"

        XCTAssertFalse(sut.isValid)
    }

    func testIsValid_emptyDosageUnit_returnsFalse() {
        sut.name = "Ibuprofen"
        sut.dosageAmount = 100
        sut.dosageUnit = ""

        XCTAssertFalse(sut.isValid)
    }

    func testIsValid_allFieldsValid_returnsTrue() {
        sut.name = "Ibuprofen"
        sut.dosageAmount = 400
        sut.dosageUnit = "mg"

        XCTAssertTrue(sut.isValid)
    }

    func testIsValid_nameWithLeadingTrailingSpaces_returnsTrue() {
        sut.name = "  Ibuprofen  "
        sut.dosageAmount = 400
        sut.dosageUnit = "mg"

        XCTAssertTrue(sut.isValid)
    }

    // MARK: - Save (Create)

    func testSaveMedication_validInput_returnsMedication() async {
        sut.name = "Sumatriptan"
        sut.type = .rescue
        sut.dosageAmount = 50
        sut.dosageUnit = "mg"
        sut.category = .triptan

        let result = await sut.saveMedication()

        XCTAssertNotNil(result)
        XCTAssertEqual(result?.name, "Sumatriptan")
        XCTAssertEqual(result?.type, .rescue)
        XCTAssertEqual(result?.dosageAmount, 50)
        XCTAssertEqual(result?.dosageUnit, "mg")
        XCTAssertEqual(result?.category, .triptan)
        XCTAssertTrue(result?.active ?? false)
        XCTAssertTrue(mockRepo.createMedicationCalled)
        XCTAssertFalse(sut.isSaving)
        XCTAssertNil(sut.error)
    }

    func testSaveMedication_trimsWhitespaceFromName() async {
        sut.name = "  Naproxen  "
        sut.dosageAmount = 500
        sut.dosageUnit = "mg"

        let result = await sut.saveMedication()

        XCTAssertEqual(result?.name, "Naproxen")
    }

    func testSaveMedication_emptyNotes_setsNil() async {
        sut.name = "Ibuprofen"
        sut.dosageAmount = 400
        sut.dosageUnit = "mg"
        sut.notes = ""

        let result = await sut.saveMedication()

        XCTAssertNil(result?.notes)
    }

    func testSaveMedication_withNotes_preservesNotes() async {
        sut.name = "Ibuprofen"
        sut.dosageAmount = 400
        sut.dosageUnit = "mg"
        sut.notes = "Take with food"

        let result = await sut.saveMedication()

        XCTAssertEqual(result?.notes, "Take with food")
    }

    func testSaveMedication_invalidForm_returnsNil() async {
        sut.name = ""
        sut.dosageAmount = 0

        let result = await sut.saveMedication()

        XCTAssertNil(result)
        XCTAssertFalse(mockRepo.createMedicationCalled)
    }

    func testSaveMedication_dbError_setsError() async {
        sut.name = "Ibuprofen"
        sut.dosageAmount = 400
        sut.dosageUnit = "mg"
        mockRepo.errorToThrow = TestError.mockError("Database write failed")

        let result = await sut.saveMedication()

        XCTAssertNil(result)
        XCTAssertNotNil(sut.error)
        XCTAssertEqual(sut.error, "Database write failed")
        XCTAssertFalse(sut.isSaving)
    }

    func testSaveMedication_withScheduleFrequency_setsFrequency() async {
        sut.name = "Topiramate"
        sut.type = .preventative
        sut.dosageAmount = 50
        sut.dosageUnit = "mg"
        sut.scheduleFrequency = .daily

        let result = await sut.saveMedication()

        XCTAssertEqual(result?.scheduleFrequency, .daily)
    }

    // MARK: - Save (Update / Edit)

    func testSaveMedication_editing_updatesExisting() async {
        let existing = TestFixtures.makeMedication(id: "med-1", name: "Ibuprofen")
        sut = AddMedicationViewModel(medicationRepository: mockRepo, existingMedication: existing)
        sut.name = "Ibuprofen Updated"
        sut.dosageAmount = 600

        let result = await sut.saveMedication()

        XCTAssertNotNil(result)
        XCTAssertEqual(result?.id, "med-1")
        XCTAssertEqual(result?.name, "Ibuprofen Updated")
        XCTAssertEqual(result?.dosageAmount, 600)
        XCTAssertFalse(mockRepo.createMedicationCalled)
        XCTAssertFalse(sut.isSaving)
    }

    func testSaveMedication_editing_dbError_setsError() async {
        let existing = TestFixtures.makeMedication(id: "med-1", name: "Ibuprofen")
        sut = AddMedicationViewModel(medicationRepository: mockRepo, existingMedication: existing)
        sut.name = "Updated"
        sut.dosageAmount = 600
        mockRepo.errorToThrow = TestError.mockError("Update failed")

        let result = await sut.saveMedication()

        XCTAssertNil(result)
        XCTAssertNotNil(sut.error)
        XCTAssertEqual(sut.error, "Update failed")
        XCTAssertFalse(sut.isSaving)
    }

    // MARK: - Medication Type Selection

    func testMedicationType_defaultIsRescue() {
        XCTAssertEqual(sut.type, .rescue)
    }

    func testMedicationType_canSetToPreventative() {
        sut.type = .preventative
        XCTAssertEqual(sut.type, .preventative)
    }

    func testMedicationType_canSetToOther() {
        sut.type = .other
        XCTAssertEqual(sut.type, .other)
    }

    // MARK: - Schedule Frequency

    func testScheduleFrequency_defaultIsNil() {
        XCTAssertNil(sut.scheduleFrequency)
    }

    func testScheduleFrequency_canSetDaily() {
        sut.scheduleFrequency = .daily
        XCTAssertEqual(sut.scheduleFrequency, .daily)
    }

    func testScheduleFrequency_canSetMonthly() {
        sut.scheduleFrequency = .monthly
        XCTAssertEqual(sut.scheduleFrequency, .monthly)
    }

    func testScheduleFrequency_canSetQuarterly() {
        sut.scheduleFrequency = .quarterly
        XCTAssertEqual(sut.scheduleFrequency, .quarterly)
    }

    // MARK: - Preset Search

    func testSearchPresets_emptyQuery_returnsAll() {
        sut.searchPresets("")

        XCTAssertEqual(sut.searchResults.count, PresetMedications.all.count)
    }

    func testSearchPresets_matchingQuery_filtersResults() {
        sut.searchPresets("Suma")

        XCTAssertEqual(sut.searchResults.count, 1)
        XCTAssertEqual(sut.searchResults.first?.name, "Sumatriptan")
    }

    func testSearchPresets_noMatch_returnsEmpty() {
        sut.searchPresets("zzzznonexistent")

        XCTAssertTrue(sut.searchResults.isEmpty)
    }

    func testSearchPresets_caseInsensitive() {
        sut.searchPresets("ibuprofen")

        XCTAssertEqual(sut.searchResults.count, 1)
        XCTAssertEqual(sut.searchResults.first?.name, "Ibuprofen")
    }

    // MARK: - Apply Preset

    func testApplyPreset_populatesAllFields() {
        let preset = PresetMedication(
            name: "Sumatriptan",
            type: .rescue,
            dosageAmount: 50,
            dosageUnit: "mg",
            category: .triptan,
            scheduleFrequency: nil
        )

        sut.applyPreset(preset)

        XCTAssertEqual(sut.name, "Sumatriptan")
        XCTAssertEqual(sut.type, .rescue)
        XCTAssertEqual(sut.dosageAmount, 50)
        XCTAssertEqual(sut.dosageUnit, "mg")
        XCTAssertEqual(sut.category, .triptan)
        XCTAssertNil(sut.scheduleFrequency)
    }

    func testApplyPreset_preventativeWithSchedule() {
        let preset = PresetMedication(
            name: "Topiramate",
            type: .preventative,
            dosageAmount: 50,
            dosageUnit: "mg",
            category: .preventive,
            scheduleFrequency: .daily
        )

        sut.applyPreset(preset)

        XCTAssertEqual(sut.type, .preventative)
        XCTAssertEqual(sut.scheduleFrequency, .daily)
    }

    func testApplyPreset_clearsSearchResults() {
        sut.searchPresets("Suma")
        XCTAssertFalse(sut.searchResults.isEmpty)

        let preset = sut.searchResults.first!
        sut.applyPreset(preset)

        XCTAssertTrue(sut.searchResults.isEmpty)
    }

    // MARK: - Error State Management

    func testError_clearedOnNextSave() async {
        sut.name = "Ibuprofen"
        sut.dosageAmount = 400
        sut.dosageUnit = "mg"

        // First save fails
        mockRepo.errorToThrow = TestError.mockError("Fail")
        _ = await sut.saveMedication()
        XCTAssertNotNil(sut.error)

        // Second save succeeds
        mockRepo.errorToThrow = nil
        let result = await sut.saveMedication()
        XCTAssertNotNil(result)
        XCTAssertNil(sut.error)
    }

    func testSaveMedication_setsIsSavingDuringSave() async {
        sut.name = "Ibuprofen"
        sut.dosageAmount = 400
        sut.dosageUnit = "mg"

        // After save completes, isSaving should be false
        _ = await sut.saveMedication()
        XCTAssertFalse(sut.isSaving)
    }

    func testSaveMedication_errorPath_resetsIsSaving() async {
        sut.name = "Ibuprofen"
        sut.dosageAmount = 400
        sut.dosageUnit = "mg"
        mockRepo.errorToThrow = TestError.mockError("Fail")

        _ = await sut.saveMedication()
        XCTAssertFalse(sut.isSaving)
    }

    // MARK: - Full Flow: Preset to Save

    func testFullFlow_searchApplyAndSave() async {
        sut.searchPresets("Aimovig")
        XCTAssertEqual(sut.searchResults.count, 1)

        let preset = sut.searchResults.first!
        sut.applyPreset(preset)

        XCTAssertEqual(sut.name, "Aimovig (erenumab)")
        XCTAssertEqual(sut.type, .preventative)
        XCTAssertEqual(sut.scheduleFrequency, .monthly)
        XCTAssertTrue(sut.isValid)

        let result = await sut.saveMedication()

        XCTAssertNotNil(result)
        XCTAssertEqual(result?.name, "Aimovig (erenumab)")
        XCTAssertEqual(result?.category, .cgrp)
        XCTAssertTrue(mockRepo.createMedicationCalled)
    }
}
