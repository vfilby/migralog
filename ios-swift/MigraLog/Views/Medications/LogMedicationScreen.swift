import SwiftUI

struct LogMedicationScreen: View {
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = MedicationsListViewModel()
    @State private var selectedMedication: Medication?

    var body: some View {
        List {
            ForEach(viewModel.rescueMedications) { med in
                Button {
                    Task {
                        let repo = MedicationRepository(dbManager: DatabaseManager.shared)
                        let now = TimestampHelper.now
                        let dose = MedicationDose(
                            id: UUID().uuidString,
                            medicationId: med.id,
                            timestamp: now,
                            quantity: med.defaultQuantity ?? 1,
                            dosageAmount: med.dosageAmount,
                            dosageUnit: med.dosageUnit,
                            status: .taken,
                            episodeId: nil,
                            effectivenessRating: nil,
                            timeToRelief: nil,
                            sideEffects: [],
                            notes: nil,
                            createdAt: now,
                            updatedAt: now
                        )
                        try? await repo.createDose(dose)
                        dismiss()
                    }
                } label: {
                    VStack(alignment: .leading) {
                        Text(med.name)
                            .font(.headline)
                        Text(MedicationFormatting.formatDosage(amount: med.dosageAmount, unit: med.dosageUnit))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            if viewModel.rescueMedications.isEmpty {
                Text("No rescue medications configured")
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Log Medication")
        .accessibilityIdentifier("log-medication-title")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Close") { dismiss() }
            }
        }
        .task {
            await viewModel.loadMedications()
        }
    }
}
