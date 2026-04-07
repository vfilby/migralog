import SwiftUI

struct MedicationsScreen: View {
    @State private var viewModel = MedicationsListViewModel()

    var body: some View {
        List {
            if !viewModel.preventativeMedications.isEmpty {
                Section("Preventative") {
                    ForEach(viewModel.preventativeMedications) { med in
                        NavigationLink {
                            MedicationDetailScreen(medicationId: med.id)
                        } label: {
                            MedicationRowView(medication: med)
                        }
                        .accessibilityIdentifier("medication-card-\(med.name)")
                    }
                }
            }

            if !viewModel.rescueMedications.isEmpty {
                Section("Rescue") {
                    ForEach(viewModel.rescueMedications) { med in
                        NavigationLink {
                            MedicationDetailScreen(medicationId: med.id)
                        } label: {
                            MedicationRowView(medication: med)
                        }
                        .accessibilityIdentifier("medication-card-\(med.name)")
                    }
                }
            }

            if !viewModel.otherMedications.isEmpty {
                Section("Other") {
                    ForEach(viewModel.otherMedications) { med in
                        NavigationLink {
                            MedicationDetailScreen(medicationId: med.id)
                        } label: {
                            MedicationRowView(medication: med)
                        }
                    }
                }
            }

            Section {
                NavigationLink {
                    ArchivedMedicationsScreen()
                } label: {
                    Text("Archived")
                        .foregroundStyle(.secondary)
                }
                .accessibilityIdentifier("archived-medications-link")
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Medications")
        .accessibilityIdentifier("medications-screen")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink {
                    AddMedicationScreen()
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .overlay {
            if viewModel.preventativeMedications.isEmpty &&
                viewModel.rescueMedications.isEmpty &&
                viewModel.otherMedications.isEmpty &&
                !viewModel.isLoading {
                ContentUnavailableView(
                    "No Medications",
                    systemImage: "pills",
                    description: Text("Add your first medication using the + button.")
                )
            }
        }
        .task {
            await viewModel.loadMedications()
        }
        .onAppear {
            Task { await viewModel.loadMedications() }
        }
        .onReceive(NotificationCenter.default.publisher(for: .medicationDataChanged)) { _ in
            Task { await viewModel.loadMedications() }
        }
    }
}

struct MedicationRowView: View {
    let medication: Medication

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(medication.name)
                .font(.headline)
            Text(MedicationFormatting.formatDosage(amount: medication.dosageAmount, unit: medication.dosageUnit))
                .font(.subheadline)
                .foregroundStyle(.secondary)
            HStack(spacing: 6) {
                MedicationTypeBadge(type: medication.type)
                if let category = medication.category {
                    Text(category.displayName)
                        .font(.caption2.weight(.semibold))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .foregroundStyle(.secondary)
                        .background(Color(.systemGray5))
                        .clipShape(Capsule())
                }
            }
        }
        .padding(.vertical, 2)
    }
}

/// Colored badge for medication type (Preventative/Rescue/Other)
struct MedicationTypeBadge: View {
    let type: MedicationType

    var body: some View {
        let badgeColor = MedicationTypeColors.color(for: type)
        Text(MedicationTypeColors.label(for: type))
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .foregroundStyle(badgeColor)
            .background(badgeColor.opacity(0.2))
            .clipShape(Capsule())
    }
}
