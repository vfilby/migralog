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
            let results = try await medicationRepository.getActiveMedicationsWithUsageCounts()

            let active = results.map(\.medication)
            preventativeMedications = active.filter { $0.type == .preventative }
            otherMedications = active.filter { $0.type == .other }

            // Sort rescue medications by usage count (most used first),
            // with alphabetical name as tiebreaker
            let rescueWithCounts = results.filter { $0.medication.type == .rescue }
            rescueMedications = rescueWithCounts.sorted { a, b in
                if a.usageCount != b.usageCount {
                    return a.usageCount > b.usageCount
                }
                return a.medication.name.localizedCompare(b.medication.name) == .orderedAscending
            }.map(\.medication)

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
