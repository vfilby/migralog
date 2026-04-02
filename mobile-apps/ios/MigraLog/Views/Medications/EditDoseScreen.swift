import SwiftUI

struct EditDoseScreen: View {
    let dose: MedicationDose
    @Bindable var viewModel: MedicationDetailViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var quantity: String
    @State private var effectivenessRating: Double?
    @State private var notes: String
    @State private var showValidationAlert = false
    @State private var isSaving = false

    init(dose: MedicationDose, viewModel: MedicationDetailViewModel) {
        self.dose = dose
        self.viewModel = viewModel
        _quantity = State(initialValue: String(dose.quantity))
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
        .alert("Invalid Amount", isPresented: $showValidationAlert) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Please enter a valid amount greater than 0.")
        }
    }

    private func save() async {
        guard let qty = Double(quantity) else {
            showValidationAlert = true
            return
        }
        let validation = EpisodeValidation.validateDoseQuantity(qty)
        guard validation.isValid else {
            showValidationAlert = true
            return
        }

        isSaving = true
        defer { isSaving = false }

        var updated = dose
        updated.quantity = qty
        updated.effectivenessRating = effectivenessRating
        updated.notes = notes.isEmpty ? nil : notes
        updated.updatedAt = TimestampHelper.now

        await viewModel.updateDose(updated)
        dismiss()
    }
}
