import Foundation
import Observation

@Observable
final class MedicationsListViewModel {
    // MARK: - State

    var preventativeMedications: [Medication] = []
    var rescueMedications: [Medication] = []
    var otherMedications: [Medication] = []
    var archivedMedications: [Medication] = []
    var isLoading = false
    var error: String?

    // MARK: - Dependencies

    private let medicationRepository: MedicationRepositoryProtocol

    // MARK: - Init

    init(medicationRepository: MedicationRepositoryProtocol = MedicationRepository(dbManager: DatabaseManager.shared)) {
        self.medicationRepository = medicationRepository
    }

    // MARK: - Computed

    var activeMedicationCount: Int {
        preventativeMedications.count + rescueMedications.count + otherMedications.count
    }

    // MARK: - Actions

    @MainActor
    func loadMedications() async {
        isLoading = true
        error = nil
        do {
            let active = try await medicationRepository.getActiveMedications()
            preventativeMedications = active.filter { $0.type == .preventative }
            rescueMedications = active.filter { $0.type == .rescue }
            otherMedications = active.filter { $0.type == .other }
            isLoading = false
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "MedicationsListViewModel"])
            self.error = error.localizedDescription
            isLoading = false
        }
    }

    @MainActor
    func loadArchivedMedications() async {
        do {
            archivedMedications = try await medicationRepository.getArchivedMedications()
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "MedicationsListViewModel"])
            self.error = error.localizedDescription
        }
    }
}
