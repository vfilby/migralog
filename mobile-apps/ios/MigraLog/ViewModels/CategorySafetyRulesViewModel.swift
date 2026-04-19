import Foundation
import Observation

/// View model backing the Medication Safety Limits screen. Holds the full list
/// of configured category safety rules (cooldowns and period-limits). Each rule
/// is a separate list row; a category can have at most one rule of each type.
@Observable
@MainActor
final class CategorySafetyRulesViewModel {
    /// All configured rules, sorted by `(category, type)` to match the list UI.
    var rules: [CategorySafetyRule] = []
    var error: String?

    private let repository: CategorySafetyRuleRepositoryProtocol

    init(
        repository: CategorySafetyRuleRepositoryProtocol = CategorySafetyRuleRepository(dbManager: DatabaseManager.shared)
    ) {
        self.repository = repository
    }

    /// Categories with at least one rule type still unconfigured.
    var addableCategories: [MedicationCategory] {
        MedicationCategory.allCases.filter { !addableTypes(for: $0).isEmpty }
    }

    /// Rule types still addable for a given category (sorted deterministically).
    func addableTypes(for category: MedicationCategory) -> [CategorySafetyRuleType] {
        let existing = Set(rules.filter { $0.category == category }.map(\.type))
        return CategorySafetyRuleType.allCases.filter { !existing.contains($0) }
    }

    /// Whether the toolbar "+" should be enabled.
    var canAddMoreRules: Bool { !addableCategories.isEmpty }

    func loadRules() {
        do {
            let all = try repository.getAllRules()
            rules = sorted(all)
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "CategorySafetyRulesViewModel", "action": "loadRules"])
            self.error = error.localizedDescription
        }
    }

    func saveRule(_ rule: CategorySafetyRule) {
        do {
            try repository.upsert(rule)
            rules.removeAll { $0.category == rule.category && $0.type == rule.type }
            rules.append(rule)
            rules = sorted(rules)
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "CategorySafetyRulesViewModel", "action": "saveRule"])
            self.error = error.localizedDescription
        }
    }

    func deleteRule(id: String) {
        do {
            try repository.delete(id: id)
            rules.removeAll { $0.id == id }
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "CategorySafetyRulesViewModel", "action": "deleteRule"])
            self.error = error.localizedDescription
        }
    }

    // MARK: - Sorting

    private func sorted(_ input: [CategorySafetyRule]) -> [CategorySafetyRule] {
        input.sorted { (a, b) in
            if a.category.rawValue != b.category.rawValue {
                let order = MedicationCategory.allCases
                let ai = order.firstIndex(of: a.category) ?? Int.max
                let bi = order.firstIndex(of: b.category) ?? Int.max
                return ai < bi
            }
            return a.type == .periodLimit && b.type == .cooldown
        }
    }
}
