import SwiftUI

/// Sheet for logging a medication dose with explicit amount, time, and notes.
/// Presented from MedicationDetailScreen's "Log with Details…" action for cases
/// where the user needs to backdate a dose or adjust the amount.
struct LogDoseDetailsSheet: View {
    let medication: Medication
    @Bindable var viewModel: MedicationDetailViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var quantity: String
    @State private var timestamp: Date = Date()
    @State private var notes: String = ""
    @State private var showValidationAlert = false
    @State private var isSaving = false

    init(medication: Medication, viewModel: MedicationDetailViewModel) {
        self.medication = medication
        self.viewModel = viewModel
        _quantity = State(initialValue: String(medication.defaultQuantity ?? 1.0))
    }

    var body: some View {
        NavigationStack {
            Form {
                let cooldown = viewModel.cooldownStatus
                let category = viewModel.categoryStatus
                if shouldShowSafetySection(cooldown: cooldown, category: category) {
                    Section {
                        MedicationSafetyBanners(
                            cooldown: cooldown,
                            categoryStatus: category,
                            medicationCategory: medication.category,
                            medicationId: medication.id
                        )
                    }
                }

                Section("Amount") {
                    HStack {
                        TextField("Quantity", text: $quantity)
                            .keyboardType(.decimalPad)
                            .accessibilityIdentifier("log-dose-amount-input")
                        Text("×")
                            .foregroundStyle(.secondary)
                        Text(MedicationFormatting.formatDosage(amount: medication.dosageAmount, unit: medication.dosageUnit))
                            .foregroundStyle(.secondary)
                    }
                }

                Section("Time") {
                    DatePicker(
                        "Taken at",
                        selection: $timestamp,
                        in: ...Date(),
                        displayedComponents: [.date, .hourAndMinute]
                    )
                    .accessibilityIdentifier("log-dose-time-picker")
                }

                Section("Notes") {
                    TextEditor(text: $notes)
                        .frame(minHeight: 60)
                        .accessibilityIdentifier("log-dose-notes-input")
                }
            }
            .navigationTitle("Log Dose")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Log") {
                        Task { await save() }
                    }
                    .disabled(isSaving)
                    .accessibilityIdentifier("log-dose-save-button")
                }
            }
            .alert("Invalid Amount", isPresented: $showValidationAlert) {
                Button("OK", role: .cancel) {}
            } message: {
                Text("Please enter a valid amount greater than 0.")
            }
        }
    }

    private func shouldShowSafetySection(
        cooldown: MedicationCooldown.Status,
        category: CategoryUsageStatus
    ) -> Bool {
        cooldown.hoursSinceLastDose != nil || category.isWarning
    }

    private func save() async {
        guard let qty = Double(quantity), qty > 0 else {
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

        await viewModel.logDose(
            quantity: qty,
            at: timestamp,
            notes: notes.isEmpty ? nil : notes
        )
        dismiss()
    }
}
