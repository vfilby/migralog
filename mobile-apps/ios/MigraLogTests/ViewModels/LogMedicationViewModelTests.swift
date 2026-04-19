import XCTest
@testable import MigraLog

@MainActor
final class LogMedicationViewModelTests: XCTestCase {
    private var mockMedRepo: MockMedicationRepository!
    private var mockEpisodeRepo: MockEpisodeRepository!
    private var mockCategoryLimitRepo: MockCategorySafetyRuleRepository!
    private var sut: LogMedicationViewModel!

    override func setUp() {
        super.setUp()
        mockMedRepo = MockMedicationRepository()
        mockEpisodeRepo = MockEpisodeRepository()
        mockCategoryLimitRepo = MockCategorySafetyRuleRepository()
        sut = LogMedicationViewModel(
            medicationRepository: mockMedRepo,
            episodeRepository: mockEpisodeRepo,
            categoryLimitRepository: mockCategoryLimitRepo
        )
    }

    // MARK: - Load Medications

    func testLoadMedications_sortsByType() async {
        let rescue = TestFixtures.makeMedication(id: "r1", name: "Sumatriptan", type: .rescue)
        mockMedRepo.medications = [rescue]

        await sut.loadMedications()

        XCTAssertEqual(sut.medications.count, 1)
        XCTAssertEqual(sut.medications.first?.name, "Sumatriptan")
        XCTAssertEqual(sut.medications.first?.type, .rescue)
        XCTAssertFalse(sut.isLoading)
    }

    func testLoadMedications_rescueSortedByUsageCount() async {
        let medA = TestFixtures.makeMedication(id: "a", name: "Ibuprofen", type: .rescue)
        let medB = TestFixtures.makeMedication(id: "b", name: "Sumatriptan", type: .rescue)
        let medC = TestFixtures.makeMedication(id: "c", name: "Acetaminophen", type: .rescue)
        mockMedRepo.medications = [medA, medB, medC]

        // Give medB the most doses, medC second, medA fewest
        mockMedRepo.doses = [
            TestFixtures.makeDose(medicationId: "b"),
            TestFixtures.makeDose(medicationId: "b"),
            TestFixtures.makeDose(medicationId: "b"),
            TestFixtures.makeDose(medicationId: "c"),
            TestFixtures.makeDose(medicationId: "c"),
            TestFixtures.makeDose(medicationId: "a"),
        ]

        await sut.loadMedications()

        XCTAssertEqual(sut.medications.count, 3)
        XCTAssertEqual(sut.medications[0].id, "b", "Most-used medication should be first")
        XCTAssertEqual(sut.medications[1].id, "c", "Second most-used medication should be second")
        XCTAssertEqual(sut.medications[2].id, "a", "Least-used medication should be last")
    }

    func testLoadMedications_emptyList() async {
        mockMedRepo.medications = []

        await sut.loadMedications()

        XCTAssertTrue(sut.medications.isEmpty)
        XCTAssertFalse(sut.isLoading)
    }

    // MARK: - Quick Log

    func testQuickLog_createsDose() async {
        let med = TestFixtures.makeMedication(id: "m1", name: "Ibuprofen")
        mockMedRepo.medications = [med]

        await sut.quickLog(med)

        XCTAssertTrue(mockMedRepo.createDoseCalled)
        XCTAssertEqual(mockMedRepo.doses.count, 1)
        XCTAssertEqual(mockMedRepo.doses.first?.medicationId, "m1")
        XCTAssertEqual(mockMedRepo.doses.first?.status, .taken)
    }

    func testQuickLog_associatesWithActiveEpisode() async {
        let med = TestFixtures.makeMedication(id: "m1", name: "Ibuprofen")
        let episode = TestFixtures.makeEpisode(
            id: "ep1",
            startTime: TimestampHelper.now - 3600_000
        )
        mockMedRepo.medications = [med]
        mockEpisodeRepo.episodes = [episode]

        await sut.quickLog(med)

        XCTAssertEqual(mockMedRepo.doses.first?.episodeId, "ep1")
    }

    func testQuickLog_noActiveEpisode() async {
        let med = TestFixtures.makeMedication(id: "m1", name: "Ibuprofen")
        // No episodes in the mock
        mockMedRepo.medications = [med]

        await sut.quickLog(med)

        XCTAssertTrue(mockMedRepo.createDoseCalled)
        XCTAssertNil(mockMedRepo.doses.first?.episodeId)
    }

    func testQuickLog_errorLogged() async {
        let med = TestFixtures.makeMedication(id: "m1", name: "Ibuprofen")
        mockMedRepo.errorToThrow = TestError.mockError("createDose failed")

        await sut.quickLog(med)

        // Should not crash — error is caught and logged
        XCTAssertFalse(mockMedRepo.createDoseCalled, "createDose should not succeed when error is injected")
        XCTAssertTrue(mockMedRepo.doses.isEmpty)
    }
}
