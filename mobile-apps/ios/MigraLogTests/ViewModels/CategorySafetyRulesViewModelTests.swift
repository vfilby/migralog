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
        let vm = CategorySafetyRulesViewModel(repository: repo, medicationRepository: MockMedicationRepository())
        vm.loadRules()
        XCTAssertEqual(vm.rules.count, 2)
    }

    func test_addable_pairs_excludes_already_configured_types() async {
        let repo = StubRepo()
        repo.rules = [
            CategorySafetyRule(id: "1", category: .nsaid, type: .periodLimit,
                               periodHours: 720, maxCount: 15, createdAt: Date())
        ]
        let vm = CategorySafetyRulesViewModel(repository: repo, medicationRepository: MockMedicationRepository())
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
        let vm = CategorySafetyRulesViewModel(repository: repo, medicationRepository: MockMedicationRepository())
        vm.loadRules()

        XCTAssertFalse(vm.addableCategories.contains(.nsaid))
        XCTAssertTrue(vm.addableCategories.contains(.triptan))
    }

    func test_saveRule_persists_and_updates_state() async {
        let repo = StubRepo()
        let vm = CategorySafetyRulesViewModel(repository: repo, medicationRepository: MockMedicationRepository())
        let rule = CategorySafetyRule(id: "x", category: .nsaid, type: .cooldown,
                                      periodHours: 4, maxCount: nil, createdAt: Date())
        vm.saveRule(rule)
        XCTAssertEqual(repo.rules.count, 1)
        XCTAssertTrue(vm.rules.contains(where: { $0.id == "x" }))
    }

    private func makeMedication(
        id: String,
        name: String = "Med",
        type: MedicationType = .rescue,
        category: MedicationCategory? = .cgrp,
        excluded: Bool = false
    ) -> Medication {
        Medication(
            id: id, name: name, type: type, dosageAmount: 10, dosageUnit: "mg",
            defaultQuantity: 1, scheduleFrequency: nil, photoUri: nil, active: true,
            notes: nil, category: category, minIntervalHours: nil,
            excludedFromSafetyWarnings: excluded, createdAt: 1, updatedAt: 1
        )
    }

    func test_loadRules_groups_active_medications_by_category() async {
        let medRepo = MockMedicationRepository()
        medRepo.medications = [
            makeMedication(id: "qulipta", name: "Qulipta", type: .preventative, category: .cgrp),
            makeMedication(id: "ubrelvy", name: "Ubrelvy", category: .cgrp),
            makeMedication(id: "advil", name: "Advil", category: .nsaid),
            makeMedication(id: "uncategorized", name: "Other", category: nil)
        ]
        let vm = CategorySafetyRulesViewModel(repository: StubRepo(), medicationRepository: medRepo)
        vm.loadRules()

        XCTAssertEqual(Set(vm.medicationsByCategory[.cgrp]?.map(\.id) ?? []), Set(["qulipta", "ubrelvy"]))
        XCTAssertEqual(vm.medicationsByCategory[.nsaid]?.map(\.id), ["advil"])
        XCTAssertNil(vm.medicationsByCategory[.other])
    }

    func test_saveRule_applies_exclusion_checklist_to_category_medications() async {
        let medRepo = MockMedicationRepository()
        medRepo.medications = [
            makeMedication(id: "qulipta", name: "Qulipta", type: .preventative, category: .cgrp),
            makeMedication(id: "ubrelvy", name: "Ubrelvy", category: .cgrp),
            makeMedication(id: "advil", name: "Advil", category: .nsaid)
        ]
        let vm = CategorySafetyRulesViewModel(repository: StubRepo(), medicationRepository: medRepo)
        vm.loadRules()

        let rule = CategorySafetyRule(id: "r", category: .cgrp, type: .periodLimit,
                                      periodHours: 720, maxCount: 10, createdAt: Date())
        vm.saveRule(rule, excludedMedicationIds: ["qulipta"])

        XCTAssertEqual(medRepo.medications.first { $0.id == "qulipta" }?.excludedFromSafetyWarnings, true)
        XCTAssertEqual(medRepo.medications.first { $0.id == "ubrelvy" }?.excludedFromSafetyWarnings, false)
        // Other categories are untouched.
        XCTAssertEqual(medRepo.medications.first { $0.id == "advil" }?.excludedFromSafetyWarnings, false)
        // The VM's cache reflects the change so reopening the editor shows it.
        XCTAssertEqual(vm.medicationsByCategory[.cgrp]?.first { $0.id == "qulipta" }?.excludedFromSafetyWarnings, true)
    }

    func test_saveRule_reincludes_previously_excluded_medication() async {
        let medRepo = MockMedicationRepository()
        medRepo.medications = [
            makeMedication(id: "qulipta", name: "Qulipta", type: .preventative, category: .cgrp, excluded: true)
        ]
        let vm = CategorySafetyRulesViewModel(repository: StubRepo(), medicationRepository: medRepo)
        vm.loadRules()

        let rule = CategorySafetyRule(id: "r", category: .cgrp, type: .periodLimit,
                                      periodHours: 720, maxCount: 10, createdAt: Date())
        vm.saveRule(rule, excludedMedicationIds: [])

        XCTAssertEqual(medRepo.medications.first { $0.id == "qulipta" }?.excludedFromSafetyWarnings, false)
    }

    func test_deleteRule_removes_from_state_and_repo() async {
        let repo = StubRepo()
        let rule = CategorySafetyRule(id: "x", category: .nsaid, type: .cooldown,
                                      periodHours: 4, maxCount: nil, createdAt: Date())
        repo.rules = [rule]
        let vm = CategorySafetyRulesViewModel(repository: repo, medicationRepository: MockMedicationRepository())
        vm.loadRules()

        vm.deleteRule(id: "x")

        XCTAssertTrue(repo.rules.isEmpty)
        XCTAssertFalse(vm.rules.contains(where: { $0.id == "x" }))
    }
}
