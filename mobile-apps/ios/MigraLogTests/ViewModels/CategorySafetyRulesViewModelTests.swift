import XCTest
@testable import MigraLog

@MainActor
final class CategorySafetyRulesViewModelTests: XCTestCase {
    private final class StubRepo: CategorySafetyRuleRepositoryProtocol, @unchecked Sendable {
        var rules: [CategorySafetyRule] = []

        func getAllRules() throws -> [CategorySafetyRule] { rules }
        func getRules(for category: MedicationCategory) throws -> [CategorySafetyRule] {
            rules.filter { $0.category == category }
        }
        func getRule(category: MedicationCategory, type: CategorySafetyRuleType) throws -> CategorySafetyRule? {
            rules.first { $0.category == category && $0.type == type }
        }
        func upsert(_ rule: CategorySafetyRule) throws {
            rules.removeAll { $0.category == rule.category && $0.type == rule.type }
            rules.append(rule)
        }
        func delete(id: String) throws {
            rules.removeAll { $0.id == id }
        }
        func countUsageDays(category: MedicationCategory, windowDays: Int, now: Date) throws -> Int { 0 }
    }

    func test_loadRules_populates_from_repository() async {
        let repo = StubRepo()
        repo.rules = [
            CategorySafetyRule(id: "1", category: .nsaid, type: .periodLimit,
                               periodHours: 720, maxCount: 15, createdAt: Date()),
            CategorySafetyRule(id: "2", category: .triptan, type: .cooldown,
                               periodHours: 2, maxCount: nil, createdAt: Date())
        ]
        let vm = CategorySafetyRulesViewModel(repository: repo)
        vm.loadRules()
        XCTAssertEqual(vm.rules.count, 2)
    }

    func test_addable_pairs_excludes_already_configured_types() async {
        let repo = StubRepo()
        repo.rules = [
            CategorySafetyRule(id: "1", category: .nsaid, type: .periodLimit,
                               periodHours: 720, maxCount: 15, createdAt: Date())
        ]
        let vm = CategorySafetyRulesViewModel(repository: repo)
        vm.loadRules()

        let nsaidTypes = vm.addableTypes(for: .nsaid)
        XCTAssertEqual(nsaidTypes, [.cooldown])

        let triptanTypes = vm.addableTypes(for: .triptan)
        XCTAssertEqual(Set(triptanTypes), Set([.cooldown, .periodLimit]))
    }

    func test_addableCategories_excludes_fully_configured_categories() async {
        let repo = StubRepo()
        repo.rules = [
            CategorySafetyRule(id: "1", category: .nsaid, type: .periodLimit,
                               periodHours: 720, maxCount: 15, createdAt: Date()),
            CategorySafetyRule(id: "2", category: .nsaid, type: .cooldown,
                               periodHours: 4, maxCount: nil, createdAt: Date())
        ]
        let vm = CategorySafetyRulesViewModel(repository: repo)
        vm.loadRules()

        XCTAssertFalse(vm.addableCategories.contains(.nsaid))
        XCTAssertTrue(vm.addableCategories.contains(.triptan))
    }

    func test_saveRule_persists_and_updates_state() async {
        let repo = StubRepo()
        let vm = CategorySafetyRulesViewModel(repository: repo)
        let rule = CategorySafetyRule(id: "x", category: .nsaid, type: .cooldown,
                                      periodHours: 4, maxCount: nil, createdAt: Date())
        vm.saveRule(rule)
        XCTAssertEqual(repo.rules.count, 1)
        XCTAssertTrue(vm.rules.contains(where: { $0.id == "x" }))
    }

    func test_deleteRule_removes_from_state_and_repo() async {
        let repo = StubRepo()
        let rule = CategorySafetyRule(id: "x", category: .nsaid, type: .cooldown,
                                      periodHours: 4, maxCount: nil, createdAt: Date())
        repo.rules = [rule]
        let vm = CategorySafetyRulesViewModel(repository: repo)
        vm.loadRules()

        vm.deleteRule(id: "x")

        XCTAssertTrue(repo.rules.isEmpty)
        XCTAssertFalse(vm.rules.contains(where: { $0.id == "x" }))
    }
}
