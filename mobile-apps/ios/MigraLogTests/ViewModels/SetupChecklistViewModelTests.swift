import XCTest
@testable import MigraLog

@MainActor
final class SetupChecklistViewModelTests: XCTestCase {
    private var medRepo: MockMedicationRepository!
    private var defaults: UserDefaults!
    private var suiteName: String!

    override func setUp() {
        super.setUp()
        medRepo = MockMedicationRepository()
        suiteName = "setup-tests-\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suiteName)
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suiteName)
        super.tearDown()
    }

    private func makeSUT() -> SetupChecklistViewModel {
        SetupChecklistViewModel(medicationRepository: medRepo, defaults: defaults)
    }

    func testFreshUser_showsBothTasks() {
        let sut = makeSUT()
        sut.refresh()
        XCTAssertTrue(sut.shouldShow)
        XCTAssertEqual(sut.visibleTasks, [.addRescue, .addPreventative])
    }

    func testRescueAdded_completesAndDropsThatTask() {
        medRepo.medications = [TestFixtures.makeMedication(id: "r", type: .rescue)]
        let sut = makeSUT()
        sut.refresh()
        XCTAssertTrue(sut.isCompleted(.addRescue))
        XCTAssertEqual(sut.visibleTasks, [.addPreventative])
    }

    func testBothMedsAdded_hidesCard() {
        medRepo.medications = [
            TestFixtures.makeMedication(id: "r", type: .rescue),
            TestFixtures.makeMedication(id: "p", type: .preventative, category: nil)
        ]
        let sut = makeSUT()
        sut.refresh()
        XCTAssertFalse(sut.shouldShow)
        XCTAssertTrue(sut.visibleTasks.isEmpty)
    }

    func testDismissTask_dropsItAndPersists() {
        let sut = makeSUT()
        sut.refresh()
        sut.dismiss(.addPreventative)
        XCTAssertEqual(sut.visibleTasks, [.addRescue])

        // Persists across instances.
        let reloaded = makeSUT()
        reloaded.refresh()
        XCTAssertTrue(reloaded.isDismissed(.addPreventative))
        XCTAssertEqual(reloaded.visibleTasks, [.addRescue])
    }

    func testDismissingAllTasks_hidesCard() {
        let sut = makeSUT()
        sut.refresh()
        sut.dismiss(.addRescue)
        sut.dismiss(.addPreventative)
        XCTAssertFalse(sut.shouldShow)
    }
}
