import Foundation
import Observation

@Observable
final class LogMedicationViewModel {
    var medications: [Medication] = []
    var isLoading = false

    private let medicationRepository: MedicationRepositoryProtocol
    private let episodeRepository: EpisodeRepositoryProtocol

    init(
        medicationRepository: MedicationRepositoryProtocol = MedicationRepository(dbManager: DatabaseManager.shared),
        episodeRepository: EpisodeRepositoryProtocol = EpisodeRepository(dbManager: DatabaseManager.shared)
    ) {
        self.medicationRepository = medicationRepository
        self.episodeRepository = episodeRepository
    }

    @MainActor
    func loadMedications() async {
        isLoading = true
        do {
            let results = try await medicationRepository.getActiveMedicationsWithUsageCounts()
            medications = results.sorted { $0.usageCount > $1.usageCount }.map(\.medication)
            isLoading = false
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "LogMedicationViewModel"])
            isLoading = false
        }
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
        } catch {
            ErrorLogger.shared.logError(error, context: ["action": "quickLog", "medication": medication.name])
        }
    }
}
