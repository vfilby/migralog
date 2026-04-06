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
            otherMedications = active.filter { $0.type == .other }

            // Sort rescue medications by usage count (most used first),
            // with alphabetical name as tiebreaker
            let rescue = active.filter { $0.type == .rescue }
            let usageCounts = try medicationRepository.getMedicationUsageCounts(
                start: 0,
                end: Int64.max
            )
            rescueMedications = rescue.sorted { a, b in
                let usageA = usageCounts[a.id] ?? 0
                let usageB = usageCounts[b.id] ?? 0
                if usageA != usageB {
                    return usageA > usageB
                }
                return a.name.localizedCompare(b.name) == .orderedAscending
            }

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
