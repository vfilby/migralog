import SwiftUI

struct EditDoseFromTimelineScreen: View {
    let dose: MedicationDose
    let medication: Medication
    @Bindable var viewModel: EpisodeDetailViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var quantity: String
    @State private var dosageAmount: String
    @State private var dosageUnit: String
    @State private var selectedDate: Date
    @State private var notes: String
    @State private var showValidationAlert = false
    @State private var validationMessage = ""
    @State private var isSaving = false

    init(dose: MedicationDose, medication: Medication, viewModel: EpisodeDetailViewModel) {
        self.dose = dose
        self.medication = medication
        self.viewModel = viewModel
        _quantity = State(initialValue: String(dose.quantity))
        _dosageAmount = State(initialValue: String(dose.dosageAmount ?? medication.dosageAmount))
        _dosageUnit = State(initialValue: dose.dosageUnit ?? medication.dosageUnit)
        _selectedDate = State(initialValue: Date(timeIntervalSince1970: Double(dose.timestamp) / 1000.0))
        _notes = State(initialValue: dose.notes ?? "")
    }

    var body: some View {
        Form {
            Section("Medication") {
                Text(medication.name)
                    .foregroundStyle(.secondary)
            }

            Section("Amount") {
                TextField("Quantity", text: $quantity)
                    .keyboardType(.decimalPad)
                    .accessibilityIdentifier("dose-amount-input")
            }

            Section {
                TextField("Amount", text: $dosageAmount)
                    .keyboardType(.decimalPad)
                    .accessibilityIdentifier("dose-dosage-amount-input")
                TextField("Unit (mg, ml, tablets...)", text: $dosageUnit)
                    .accessibilityIdentifier("dose-dosage-unit-input")
            } header: {
                Text("Dosage")
            } footer: {
                Text("Strength of a single dose. Edit this if the medication was configured incorrectly when this dose was logged.")
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
        .alert("Invalid Dose", isPresented: $showValidationAlert) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(validationMessage)
        }
    }

    private func save() async {
        guard let qty = Double(quantity), EpisodeValidation.validateDoseQuantity(qty).isValid else {
            validationMessage = "Please enter a valid amount greater than 0."
            showValidationAlert = true
            return
        }
        guard let parsed = DoseDosageInput.parse(amount: dosageAmount, unit: dosageUnit) else {
            validationMessage = "Please enter a dosage amount greater than 0 and a unit."
            showValidationAlert = true
            return
        }

        isSaving = true
        defer { isSaving = false }

        var updated = dose
        updated.quantity = qty
        updated.dosageAmount = parsed.amount
        updated.dosageUnit = parsed.unit
        updated.timestamp = TimestampHelper.fromDate(selectedDate)
        updated.notes = notes.isEmpty ? nil : notes
        await viewModel.updateDose(updated)
        dismiss()
    }
}
