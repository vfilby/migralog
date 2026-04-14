import Foundation
import Observation

@Observable
final class AddMedicationViewModel {
    // MARK: - State

    var name: String = ""
    var type: MedicationType = .rescue
    var dosageAmount: Double = 0
    var dosageUnit: String = "mg"
    var category: MedicationCategory?
    var scheduleFrequency: ScheduleFrequency?
    var notes: String = ""
    var minIntervalHours: Double?
    var searchResults: [PresetMedication] = []
    var isSaving = false
    var error: String?

    /// When non-nil, we are editing an existing medication.
    private var editingMedicationId: String?

    // MARK: - Dependencies

    private let medicationRepository: MedicationRepositoryProtocol

    // MARK: - Init

    init(medicationRepository: MedicationRepositoryProtocol = MedicationRepository(dbManager: DatabaseManager.shared), existingMedication: Medication? = nil) {
        self.medicationRepository = medicationRepository
        if let med = existingMedication {
            editingMedicationId = med.id
            name = med.name
            type = med.type
            dosageAmount = med.dosageAmount
            dosageUnit = med.dosageUnit
            category = med.category
            scheduleFrequency = med.scheduleFrequency
            notes = med.notes ?? ""
            minIntervalHours = med.minIntervalHours
        }
    }

    // MARK: - Computed

    var isEditing: Bool { editingMedicationId != nil }

    var isValid: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty && dosageAmount > 0 && !dosageUnit.isEmpty
    }

    // MARK: - Actions

    func searchPresets(_ query: String) {
        searchResults = PresetMedications.search(query)
    }

    func applyPreset(_ preset: PresetMedication) {
        name = preset.name
        type = preset.type
        dosageAmount = preset.dosageAmount
        dosageUnit = preset.dosageUnit
        category = preset.category
        scheduleFrequency = preset.scheduleFrequency
        searchResults = []
    }

    @MainActor
    func saveMedication() async -> Medication? {
        guard isValid else { return nil }
        isSaving = true
        error = nil

        let now = TimestampHelper.now

        if let existingId = editingMedicationId {
            // Update
            var updated = Medication(
                id: existingId,
                name: name.trimmingCharacters(in: .whitespaces),
                type: type,
                dosageAmount: dosageAmount,
                dosageUnit: dosageUnit,
                defaultQuantity: nil,
                scheduleFrequency: scheduleFrequency,
                photoUri: nil,
                active: true,
                notes: notes.isEmpty ? nil : notes,
                category: category,
                minIntervalHours: minIntervalHours,
                createdAt: now, // will be ignored on update
                updatedAt: now
            )
            do {
                try await medicationRepository.updateMedication(updated)
                isSaving = false
                return updated
            } catch {
                ErrorLogger.shared.logError(error, context: ["viewModel": "AddMedicationViewModel"])
                self.error = error.localizedDescription
                isSaving = false
                return nil
            }
        } else {
            // Create
            let medication = Medication(
                id: UUID().uuidString,
                name: name.trimmingCharacters(in: .whitespaces),
                type: type,
                dosageAmount: dosageAmount,
                dosageUnit: dosageUnit,
                defaultQuantity: nil,
                scheduleFrequency: scheduleFrequency,
                photoUri: nil,
                active: true,
                notes: notes.isEmpty ? nil : notes,
                category: category,
                minIntervalHours: minIntervalHours,
                createdAt: now,
                updatedAt: now
            )
            do {
                let saved = try await medicationRepository.createMedication(medication)
                isSaving = false
                return saved
            } catch {
                ErrorLogger.shared.logError(error, context: ["viewModel": "AddMedicationViewModel"])
                self.error = error.localizedDescription
                isSaving = false
                return nil
            }
        }
    }
}
