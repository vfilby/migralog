import SwiftUI

struct EditMedicationScreen: View {
    let medication: Medication
    @Bindable var viewModel: MedicationDetailViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var name: String
    @State private var dosageAmount: String
    @State private var dosageUnit: String
    @State private var notes: String
    @State private var category: MedicationCategory?
    @State private var isSaving = false

    init(medication: Medication, viewModel: MedicationDetailViewModel) {
        self.medication = medication
        self.viewModel = viewModel
        _name = State(initialValue: medication.name)
        _dosageAmount = State(initialValue: String(medication.dosageAmount))
        _dosageUnit = State(initialValue: medication.dosageUnit)
        _notes = State(initialValue: medication.notes ?? "")
        _category = State(initialValue: medication.category)
    }

    var body: some View {
        Form {
            Section("Name") {
                TextField("Name", text: $name)
            }
            Section("Dosage") {
                TextField("Amount", text: $dosageAmount)
                    .keyboardType(.decimalPad)
                TextField("Unit", text: $dosageUnit)
            }
            Section("Category") {
                Picker("Category", selection: $category) {
                    Text("None").tag(MedicationCategory?.none)
                    ForEach(MedicationCategory.allCases) { cat in
                        Text(cat.displayName).tag(Optional(cat))
                    }
                }
            }
            Section("Notes") {
                TextEditor(text: $notes)
                    .frame(minHeight: 60)
            }
        }
        .navigationTitle("Edit Medication")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    Task { await save() }
                }
                .disabled(name.isEmpty || dosageAmount.isEmpty || isSaving)
            }
        }
    }

    private func save() async {
        guard let amount = Double(dosageAmount), amount > 0 else { return }
        isSaving = true
        defer { isSaving = false }

        var updated = medication
        updated.name = name
        updated.dosageAmount = amount
        updated.dosageUnit = dosageUnit
        updated.notes = notes.isEmpty ? nil : notes
        updated.category = category
        updated.updatedAt = TimestampHelper.now

        await viewModel.updateMedication(updated)
        dismiss()
    }
}
