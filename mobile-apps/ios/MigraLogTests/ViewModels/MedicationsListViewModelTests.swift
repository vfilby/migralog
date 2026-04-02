import XCTest
@testable import MigraLog

@MainActor
final class MedicationsListViewModelTests: XCTestCase {
    private var mockMedRepo: MockMedicationRepository!
    private var sut: MedicationsListViewModel!

    override func setUp() {
        super.setUp()
        mockMedRepo = MockMedicationRepository()
        sut = MedicationsListViewModel(medicationRepository: mockMedRepo)
    }

    // MARK: - Load Medications

    func testLoadMedications_success_categorizesByType() async {
        let preventative = TestFixtures.makeMedication(id: "m-1", name: "Topiramate", type: .preventative)
        let rescue = TestFixtures.makeMedication(id: "m-2", name: "Sumatriptan", type: .rescue)
        let other = TestFixtures.makeMedication(id: "m-3", name: "Vitamin B2", type: .other)
        mockMedRepo.medications = [preventative, rescue, other]

        await sut.loadMedications()

        XCTAssertEqual(sut.preventativeMedications.count, 1)
        XCTAssertEqual(sut.preventativeMedications[0].name, "Topiramate")
        XCTAssertEqual(sut.rescueMedications.count, 1)
        XCTAssertEqual(sut.rescueMedications[0].name, "Sumatriptan")
        XCTAssertEqual(sut.otherMedications.count, 1)
        XCTAssertEqual(sut.otherMedications[0].name, "Vitamin B2")
        XCTAssertFalse(sut.isLoading)
        XCTAssertNil(sut.error)
    }

    func testLoadMedications_empty_setsEmptyArrays() async {
        await sut.loadMedications()

        XCTAssertTrue(sut.preventativeMedications.isEmpty)
        XCTAssertTrue(sut.rescueMedications.isEmpty)
        XCTAssertTrue(sut.otherMedications.isEmpty)
        XCTAssertFalse(sut.isLoading)
        XCTAssertNil(sut.error)
    }

    func testLoadMedications_error_setsErrorString() async {
        mockMedRepo.errorToThrow = TestError.mockError("Connection lost")

        await sut.loadMedications()

        XCTAssertNotNil(sut.error)
        XCTAssertEqual(sut.error, "Connection lost")
        XCTAssertFalse(sut.isLoading)
    }

    func testLoadMedications_onlyActive_excludesArchived() async {
        let active = TestFixtures.makeMedication(id: "m-1", name: "Ibuprofen", active: true)
        let archived = TestFixtures.makeMedication(id: "m-2", name: "OldMed", active: false)
        mockMedRepo.medications = [active, archived]

        await sut.loadMedications()

        // getActiveMedications filters by active == true
        XCTAssertEqual(sut.rescueMedications.count, 1)
        XCTAssertEqual(sut.rescueMedications[0].name, "Ibuprofen")
    }

    func testLoadMedications_clearsErrorOnRetry() async {
        mockMedRepo.errorToThrow = TestError.mockError("First failure")
        await sut.loadMedications()
        XCTAssertNotNil(sut.error)

        mockMedRepo.errorToThrow = nil
        mockMedRepo.medications = [TestFixtures.makeMedication(id: "m-1")]
        await sut.loadMedications()

        XCTAssertNil(sut.error)
        XCTAssertEqual(sut.rescueMedications.count, 1)
    }

    func testLoadMedications_multipleOfSameType() async {
        let r1 = TestFixtures.makeMedication(id: "m-1", name: "Sumatriptan", type: .rescue)
        let r2 = TestFixtures.makeMedication(id: "m-2", name: "Rizatriptan", type: .rescue)
        let r3 = TestFixtures.makeMedication(id: "m-3", name: "Ibuprofen", type: .rescue)
        mockMedRepo.medications = [r1, r2, r3]

        await sut.loadMedications()

        XCTAssertEqual(sut.rescueMedications.count, 3)
        XCTAssertTrue(sut.preventativeMedications.isEmpty)
        XCTAssertTrue(sut.otherMedications.isEmpty)
    }

    // MARK: - Load Archived Medications

    func testLoadArchivedMedications_success() async {
        let archived = TestFixtures.makeMedication(id: "m-1", name: "OldMed", active: false)
        mockMedRepo.medications = [archived]

        await sut.loadArchivedMedications()

        XCTAssertEqual(sut.archivedMedications.count, 1)
        XCTAssertEqual(sut.archivedMedications[0].name, "OldMed")
    }

    func testLoadArchivedMedications_empty() async {
        await sut.loadArchivedMedications()

        XCTAssertTrue(sut.archivedMedications.isEmpty)
    }

    func testLoadArchivedMedications_error_setsError() async {
        mockMedRepo.errorToThrow = TestError.mockError("Archive fetch failed")

        await sut.loadArchivedMedications()

        XCTAssertNotNil(sut.error)
        XCTAssertEqual(sut.error, "Archive fetch failed")
    }

    func testLoadArchivedMedications_doesNotAffectActiveCategories() async {
        let active = TestFixtures.makeMedication(id: "m-1", name: "ActiveMed", type: .preventative, active: true)
        let archived = TestFixtures.makeMedication(id: "m-2", name: "OldMed", active: false)
        mockMedRepo.medications = [active, archived]

        await sut.loadMedications()
        await sut.loadArchivedMedications()

        XCTAssertEqual(sut.preventativeMedications.count, 1)
        XCTAssertEqual(sut.archivedMedications.count, 1)
    }

    // MARK: - Computed Properties

    func testActiveMedicationCount_sumsAllCategories() async {
        let p1 = TestFixtures.makeMedication(id: "m-1", type: .preventative)
        let r1 = TestFixtures.makeMedication(id: "m-2", type: .rescue)
        let r2 = TestFixtures.makeMedication(id: "m-3", type: .rescue)
        let o1 = TestFixtures.makeMedication(id: "m-4", type: .other)
        mockMedRepo.medications = [p1, r1, r2, o1]

        await sut.loadMedications()

        XCTAssertEqual(sut.activeMedicationCount, 4)
    }

    func testActiveMedicationCount_zero_whenEmpty() {
        XCTAssertEqual(sut.activeMedicationCount, 0)
    }

    func testActiveMedicationCount_excludesArchived() async {
        let active = TestFixtures.makeMedication(id: "m-1", type: .rescue, active: true)
        let archived = TestFixtures.makeMedication(id: "m-2", type: .rescue, active: false)
        mockMedRepo.medications = [active, archived]

        await sut.loadMedications()
        await sut.loadArchivedMedications()

        // activeMedicationCount should only count active categories
        XCTAssertEqual(sut.activeMedicationCount, 1)
    }

    // MARK: - State Transitions

    func testLoadMedications_replacesPreviousData() async {
        let med1 = TestFixtures.makeMedication(id: "m-1", name: "First", type: .rescue)
        mockMedRepo.medications = [med1]
        await sut.loadMedications()
        XCTAssertEqual(sut.rescueMedications.count, 1)

        // Load again with different data
        let med2 = TestFixtures.makeMedication(id: "m-2", name: "Second", type: .preventative)
        mockMedRepo.medications = [med2]
        await sut.loadMedications()

        XCTAssertTrue(sut.rescueMedications.isEmpty)
        XCTAssertEqual(sut.preventativeMedications.count, 1)
        XCTAssertEqual(sut.preventativeMedications[0].name, "Second")
    }
}
