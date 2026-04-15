import Foundation
import Observation

@Observable
final class LogMedicationViewModel {
    var medications: [Medication] = []
    /// Most recent taken dose per medication id. Used for cooldown warnings.
    var lastDoseByMedication: [String: MedicationDose] = [:]
    /// Per-category MOH risk status for categories that have a configured limit.
    var categoryUsage: [MedicationCategory: CategoryUsageStatus] = [:]
    var isLoading = false

    private let medicationRepository: MedicationRepositoryProtocol
    private let episodeRepository: EpisodeRepositoryProtocol
    private let categoryLimitRepository: CategoryUsageLimitRepositoryProtocol

    init(
        medicationRepository: MedicationRepositoryProtocol = MedicationRepository(dbManager: DatabaseManager.shared),
        episodeRepository: EpisodeRepositoryProtocol = EpisodeRepository(dbManager: DatabaseManager.shared),
        categoryLimitRepository: CategoryUsageLimitRepositoryProtocol = CategoryUsageLimitRepository(dbManager: DatabaseManager.shared)
    ) {
        self.medicationRepository = medicationRepository
        self.episodeRepository = episodeRepository
        self.categoryLimitRepository = categoryLimitRepository
    }

    @MainActor
    func loadMedications() async {
        isLoading = true
        do {
            let results = try await medicationRepository.getActiveMedicationsWithUsageCounts()
            medications = results.sorted { $0.usageCount > $1.usageCount }.map(\.medication)
            var lastDoses: [String: MedicationDose] = [:]
            for med in medications {
                if let last = try? medicationRepository.getLastDose(medicationId: med.id) {
                    lastDoses[med.id] = last
                }
            }
            lastDoseByMedication = lastDoses
            let categories = Set(medications.compactMap { $0.category })
            categoryUsage = computeCategoryUsage(for: categories, now: Date())
            isLoading = false
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "LogMedicationViewModel"])
            isLoading = false
        }
    }

    /// Computes the `CategoryUsageStatus` map for the given categories.
    private func computeCategoryUsage(
        for categories: Set<MedicationCategory>,
        now: Date
    ) -> [MedicationCategory: CategoryUsageStatus] {
        var result: [MedicationCategory: CategoryUsageStatus] = [:]
        for category in categories {
            guard let configured = (try? categoryLimitRepository.getLimit(for: category)) ?? nil else {
                continue
            }
            let daysUsed = (try? categoryLimitRepository.countUsageDays(
                category: category,
                windowDays: configured.windowDays,
                now: now
            )) ?? 0
            result[category] = CategoryUsageStatus.evaluate(daysUsed: daysUsed, limit: configured)
        }
        return result
    }

    @MainActor
    func quickLog(_ medication: Medication) async {
        let now = TimestampHelper.now
        let activeEpisode = try? episodeRepository.getEpisodeByTimestamp(now)
        let dose = MedicationDose(
            id: UUID().uuidString,
            medicationId: medication.id,
            timestamp: now,
            quantity: medication.defaultQuantity ?? 1,
            dosageAmount: medication.dosageAmount,
            dosageUnit: medication.dosageUnit,
            status: .taken,
            episodeId: activeEpisode?.id,
            effectivenessRating: nil,
            timeToRelief: nil,
            sideEffects: [],
            notes: nil,
            createdAt: now,
            updatedAt: now
        )
        do {
            try await medicationRepository.createDose(dose)
            // Refresh category usage so warnings update immediately.
            let categories = Set(medications.compactMap { $0.category })
            categoryUsage = computeCategoryUsage(for: categories, now: Date())
        } catch {
            ErrorLogger.shared.logError(error, context: ["action": "quickLog", "medication": medication.name])
        }
    }
}
