import SwiftUI

struct EditDoseFromTimelineScreen: View {
    let dose: MedicationDose
    let medicationName: String
    @Bindable var viewModel: EpisodeDetailViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var selectedDate: Date
    @State private var notes: String
    @State private var isSaving = false

    init(dose: MedicationDose, medicationName: String, viewModel: EpisodeDetailViewModel) {
        self.dose = dose
        self.medicationName = medicationName
        self.viewModel = viewModel
        _selectedDate = State(initialValue: Date(timeIntervalSince1970: Double(dose.timestamp) / 1000.0))
        _notes = State(initialValue: dose.notes ?? "")
    }

    var body: some View {
        Form {
            Section("Medication") {
                Text(medicationName)
                    .foregroundStyle(.secondary)
            }

            Section("Time") {
                DatePicker("When", selection: $selectedDate)
            }

            Section("Notes") {
                TextEditor(text: $notes)
                    .frame(minHeight: 60)
            }
        }
        .navigationTitle("Edit Dose")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    Task { await save() }
                }
                .disabled(isSaving)
            }
        }
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }

        var updated = dose
        updated.timestamp = TimestampHelper.fromDate(selectedDate)
        updated.notes = notes.isEmpty ? nil : notes
        await viewModel.updateDose(updated)
        dismiss()
    }
}
