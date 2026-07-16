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
    /// Active medications grouped by category, backing the rule editor's
    /// per-category inclusion checklist.
    var medicationsByCategory: [MedicationCategory: [Medication]] = [:]
    var error: String?

    private let repository: CategorySafetyRuleRepositoryProtocol
    private let medicationRepository: MedicationRepositoryProtocol

    init(
        repository: CategorySafetyRuleRepositoryProtocol = CategorySafetyRuleRepository(dbManager: DatabaseManager.shared),
        medicationRepository: MedicationRepositoryProtocol = MedicationRepository(dbManager: DatabaseManager.shared)
    ) {
        self.repository = repository
        self.medicationRepository = medicationRepository
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
            var grouped: [MedicationCategory: [Medication]] = [:]
            for medication in try medicationRepository.getActiveMedications() {
                guard let category = medication.category else { continue }
                grouped[category, default: []].append(medication)
            }
            medicationsByCategory = grouped
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "CategorySafetyRulesViewModel", "action": "loadRules"])
            self.error = error.localizedDescription
        }
    }

    /// Persists the rule plus the category's medication exclusion checklist.
    /// `excludedMedicationIds` is the complete set of excluded medications for
    /// the rule's category; any medication whose flag differs is updated (which
    /// bumps `updated_at`, so the change syncs).
    func saveRule(_ rule: CategorySafetyRule, excludedMedicationIds: Set<String> = []) {
        do {
            try repository.upsert(rule)
            rules.removeAll { $0.category == rule.category && $0.type == rule.type }
            rules.append(rule)
            rules = sorted(rules)
            try applyExclusions(excludedMedicationIds, for: rule.category)
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "CategorySafetyRulesViewModel", "action": "saveRule"])
            self.error = error.localizedDescription
        }
    }

    private func applyExclusions(_ excludedIds: Set<String>, for category: MedicationCategory) throws {
        guard let medications = medicationsByCategory[category] else { return }
        var changedAny = false
        var updatedList = medications
        for (index, medication) in medications.enumerated() {
            let shouldExclude = excludedIds.contains(medication.id)
            guard medication.excludedFromSafetyWarnings != shouldExclude else { continue }
            var updated = medication
            updated.excludedFromSafetyWarnings = shouldExclude
            updatedList[index] = try medicationRepository.updateMedication(updated)
            changedAny = true
        }
        if changedAny {
            medicationsByCategory[category] = updatedList
            // Dashboard / Log Medication recompute their category warnings on this.
            NotificationCenter.default.post(name: .medicationDataChanged, object: nil)
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
