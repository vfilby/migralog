import Foundation
import Observation

/// View model backing the Medication Safety Limits screen. Holds a map of
/// configured MOH-risk limits keyed by medication category.
@Observable
@MainActor
final class CategoryLimitsViewModel {
    /// Currently configured limits keyed by category. Categories without a
    /// configured limit are absent from the map.
    var limits: [MedicationCategory: CategoryUsageLimit] = [:]
    var error: String?

    private let repository: CategoryUsageLimitRepositoryProtocol

    /// Categories not yet configured — used to populate the Add Limit picker.
    /// Preserves `MedicationCategory.allCases` order.
    var availableCategoriesForAdd: [MedicationCategory] {
        MedicationCategory.allCases.filter { limits[$0] == nil }
    }

    /// Whether the toolbar "+" should be enabled.
    var canAddMoreLimits: Bool {
        !availableCategoriesForAdd.isEmpty
    }

    init(
        repository: CategoryUsageLimitRepositoryProtocol = CategoryUsageLimitRepository(dbManager: DatabaseManager.shared)
    ) {
        self.repository = repository
    }

    func loadLimits() {
        do {
            let all = try repository.getAllLimits()
            var map: [MedicationCategory: CategoryUsageLimit] = [:]
            for limit in all {
                map[limit.category] = limit
            }
            limits = map
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "CategoryLimitsViewModel", "action": "loadLimits"])
            self.error = error.localizedDescription
        }
    }

    func saveLimit(_ limit: CategoryUsageLimit) {
        do {
            try repository.setLimit(limit)
            limits[limit.category] = limit
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "CategoryLimitsViewModel", "action": "saveLimit"])
            self.error = error.localizedDescription
        }
    }

    func clearLimit(_ category: MedicationCategory) {
        do {
            try repository.clearLimit(for: category)
            limits.removeValue(forKey: category)
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "CategoryLimitsViewModel", "action": "clearLimit"])
            self.error = error.localizedDescription
        }
    }
}
