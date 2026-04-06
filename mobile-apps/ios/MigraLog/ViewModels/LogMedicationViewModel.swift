import Foundation
import Observation

@Observable
final class LogMedicationViewModel {
    var medications: [Medication] = []
    var isLoading = false

    private let medicationRepository: MedicationRepositoryProtocol

    init(medicationRepository: MedicationRepositoryProtocol = MedicationRepository(dbManager: DatabaseManager.shared)) {
        self.medicationRepository = medicationRepository
    }

    @MainActor
    func loadMedications() async {
        isLoading = true
        do {
            let active = try await medicationRepository.getActiveMedications()
            let counts = try medicationRepository.getMedicationUsageCounts(start: 0, end: Int64.max)
            medications = active.sorted { a, b in
                (counts[a.id] ?? 0) > (counts[b.id] ?? 0)
            }
            isLoading = false
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "LogMedicationViewModel"])
            isLoading = false
        }
    }
}
