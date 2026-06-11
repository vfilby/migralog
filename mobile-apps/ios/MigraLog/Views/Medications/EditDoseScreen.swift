import SwiftUI

struct EditDoseScreen: View {
    let dose: MedicationDose
    @Bindable var viewModel: MedicationDetailViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var quantity: String
    @State private var dosageAmount: String
    @State private var dosageUnit: String
    @State private var timestamp: Date
    @State private var effectivenessRating: Double?
    @State private var notes: String
    @State private var showValidationAlert = false
    @State private var validationMessage = ""
    @State private var isSaving = false

    init(dose: MedicationDose, viewModel: MedicationDetailViewModel) {
        self.dose = dose
        self.viewModel = viewModel
        _quantity = State(initialValue: String(dose.quantity))
        let amount = dose.dosageAmount ?? viewModel.medication?.dosageAmount
        _dosageAmount = State(initialValue: amount.map { String($0) } ?? "")
        _dosageUnit = State(initialValue: dose.dosageUnit ?? viewModel.medication?.dosageUnit ?? "")
        _timestamp = State(initialValue: dose.date)
        _effectivenessRating = State(initialValue: dose.effectivenessRating)
        _notes = State(initialValue: dose.notes ?? "")
    }

    var body: some View {
        Form {
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
                DatePicker(
                    "Taken at",
                    selection: $timestamp,
                    in: ...Date(),
                    displayedComponents: [.date, .hourAndMinute]
                )
                .accessibilityIdentifier("dose-time-picker")
            }

            Section("Effectiveness") {
                if let rating = effectivenessRating {
                    VStack {
                        Text(String(format: "%.0f", rating))
                            .font(.title3.weight(.bold))
                        Slider(value: Binding(
                            get: { rating },
                            set: { effectivenessRating = $0 }
                        ), in: 0...10, step: 1)
                    }
                }
                Toggle("Rate effectiveness", isOn: Binding(
                    get: { effectivenessRating != nil },
                    set: { effectivenessRating = $0 ? 5.0 : nil }
                ))
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
        updated.timestamp = TimestampHelper.fromDate(timestamp)
        updated.effectivenessRating = effectivenessRating
        updated.notes = notes.isEmpty ? nil : notes
        updated.updatedAt = TimestampHelper.now

        await viewModel.updateDose(updated)
        dismiss()
    }
}
