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

    // MARK: - Settings management

    func testAllTasks_listsEveryTaskRegardlessOfState() {
        medRepo.medications = [TestFixtures.makeMedication(id: "r", type: .rescue)]
        let sut = makeSUT()
        sut.refresh()
        sut.dismiss(.addPreventative)
        // Settings shows the full catalog even when done/dismissed.
        XCTAssertEqual(sut.allTasks, [.addRescue, .addPreventative])
    }

    func testDismissableTasks_excludesCompletedAndDismissed() {
        medRepo.medications = [TestFixtures.makeMedication(id: "r", type: .rescue)]
        let sut = makeSUT()
        sut.refresh()
        // addRescue is completed; only addPreventative is dismissable.
        XCTAssertTrue(sut.hasDismissableTasks)
        XCTAssertEqual(sut.dismissableTasks, [.addPreventative])

        sut.dismiss(.addPreventative)
        XCTAssertFalse(sut.hasDismissableTasks)
        XCTAssertTrue(sut.dismissableTasks.isEmpty)
    }

    func testDismissAll_dismissesIncompleteTasksAndPersists() {
        let sut = makeSUT()
        sut.refresh()
        sut.dismissAll()
        XCTAssertTrue(sut.isDismissed(.addRescue))
        XCTAssertTrue(sut.isDismissed(.addPreventative))
        XCTAssertFalse(sut.shouldShow)

        let reloaded = makeSUT()
        reloaded.refresh()
        XCTAssertTrue(reloaded.isDismissed(.addRescue))
        XCTAssertTrue(reloaded.isDismissed(.addPreventative))
    }

    func testDismissAll_leavesCompletedTasksUntouched() {
        medRepo.medications = [TestFixtures.makeMedication(id: "r", type: .rescue)]
        let sut = makeSUT()
        sut.refresh()
        sut.dismissAll()
        // Completed tasks are never "dismissed" — they're just done.
        XCTAssertFalse(sut.isDismissed(.addRescue))
        XCTAssertTrue(sut.isDismissed(.addPreventative))
    }

    func testRestore_bringsBackADismissedTask() {
        let sut = makeSUT()
        sut.refresh()
        sut.dismiss(.addRescue)
        XCTAssertTrue(sut.hasDismissedTasks)

        sut.restore(.addRescue)
        XCTAssertFalse(sut.isDismissed(.addRescue))
        XCTAssertTrue(sut.visibleTasks.contains(.addRescue))

        let reloaded = makeSUT()
        reloaded.refresh()
        XCTAssertFalse(reloaded.isDismissed(.addRescue))
    }

    func testRestoreAll_clearsEveryDismissal() {
        let sut = makeSUT()
        sut.refresh()
        sut.dismissAll()
        XCTAssertTrue(sut.hasDismissedTasks)

        sut.restoreAll()
        XCTAssertFalse(sut.hasDismissedTasks)
        XCTAssertEqual(sut.visibleTasks, [.addRescue, .addPreventative])
    }
}
