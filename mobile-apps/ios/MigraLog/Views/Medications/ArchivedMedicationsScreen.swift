import SwiftUI

struct ArchivedMedicationsScreen: View {
    @State private var viewModel = MedicationsListViewModel()

    var body: some View {
        Group {
            if viewModel.archivedMedications.isEmpty && !viewModel.isLoading {
                ContentUnavailableView(
                    "No Archived Medications",
                    systemImage: "archivebox",
                    description: Text("Archived medications will appear here.")
                )
            } else {
                List(viewModel.archivedMedications) { med in
                    HStack {
                        VStack(alignment: .leading) {
                            Text(med.name)
                                .font(.headline)
                            Text(MedicationFormatting.formatDosage(amount: med.dosageAmount, unit: med.dosageUnit))
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button("Restore") {
                            Task {
                                let repo = MedicationRepository(dbManager: DatabaseManager.shared)
                                try? await repo.unarchiveMedication(med.id)
                                await viewModel.loadArchivedMedications()
                            }
                        }
                        .buttonStyle(.bordered)
                        .accessibilityIdentifier("restore-medication-\(med.name)")
                    }
                }
            }
        }
        .navigationTitle("Archived Medications")
        .task {
            await viewModel.loadArchivedMedications()
        }
    }
}
