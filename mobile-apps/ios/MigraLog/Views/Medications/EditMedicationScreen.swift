import SwiftUI

struct EditMedicationScreen: View {
    let medication: Medication
    @Bindable var viewModel: MedicationDetailViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var name: String
    @State private var dosageAmount: String
    @State private var dosageUnit: String
    @State private var defaultQuantity: String
    @State private var notes: String
    @State private var category: MedicationCategory?
    @State private var minIntervalHoursText: String
    @State private var isSaving = false

    init(medication: Medication, viewModel: MedicationDetailViewModel) {
        self.medication = medication
        self.viewModel = viewModel
        _name = State(initialValue: medication.name)
        _dosageAmount = State(initialValue: String(medication.dosageAmount))
        _dosageUnit = State(initialValue: medication.dosageUnit)
        _defaultQuantity = State(initialValue: medication.defaultQuantity.map {
            $0.truncatingRemainder(dividingBy: 1) == 0 ? String(Int($0)) : String($0)
        } ?? "1")
        _notes = State(initialValue: medication.notes ?? "")
        _category = State(initialValue: medication.category)
        _minIntervalHoursText = State(initialValue: medication.minIntervalHours.map {
            $0.truncatingRemainder(dividingBy: 1) == 0 ? String(Int($0)) : String($0)
        } ?? "")
    }

    var body: some View {
        Form {
            Section("Name") {
                TextField("Name", text: $name)
                    .onChange(of: name) { _, newValue in
                        if newValue.count > 100 {
                            name = String(newValue.prefix(100))
                        }
                    }

                if name.count == 100 {
                    Text("Maximum 100 characters reached")
                        .font(.caption)
                        .foregroundStyle(.orange)
                }
            }
            Section("Dosage") {
                TextField("Amount", text: $dosageAmount)
                    .keyboardType(.decimalPad)
                TextField("Unit", text: $dosageUnit)
            }
            Section {
                TextField("Number of doses", text: $defaultQuantity)
                    .keyboardType(.decimalPad)
            } header: {
                Text("Default Quantity")
            } footer: {
                Text("Number of doses typically taken at once. For example, if you take 3 tablets of 200mg Advil, enter 3.")
            }
            Section("Category") {
                Picker("Category", selection: $category) {
                    Text("None").tag(MedicationCategory?.none)
                    ForEach(MedicationCategory.allCases) { cat in
                        Text(cat.displayName).tag(Optional(cat))
                    }
                }
            }
            Section {
                TextField("Hours (e.g. 24)", text: $minIntervalHoursText)
                    .keyboardType(.decimalPad)
                    .accessibilityIdentifier("edit-med-min-interval-hours")
            } header: {
                Text("Minimum Time Between Doses")
            } footer: {
                Text("Leave blank if there's no minimum interval")
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
        updated.defaultQuantity = Double(defaultQuantity).flatMap { $0 > 0 ? $0 : nil }
        updated.notes = notes.isEmpty ? nil : notes
        updated.category = category
        updated.minIntervalHours = Double(minIntervalHoursText).flatMap { $0 > 0 ? $0 : nil }
        updated.updatedAt = TimestampHelper.now

        await viewModel.updateMedication(updated)
        dismiss()
    }
}
