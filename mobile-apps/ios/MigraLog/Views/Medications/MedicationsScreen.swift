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
        // `.onAppear` covers both the initial appearance and every return to the
        // Medications tab, so we deliberately avoid a redundant `.task` reload here:
        // overlapping `loadMedications()` calls keep the list re-rendering and delay
        // the view reaching an idle state (which UI tests wait on before interacting).
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
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
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
                        .padding(.vertical, DesignTokens.Spacing.xs)
                        .foregroundStyle(.secondary)
                        .background(Color(.systemGray5))
                        .clipShape(Capsule())
                }
            }
        }
        .padding(.vertical, 2)
    }
}

/// Plain list row for Medications iPad list column.
/// Avoids `.secondary` foreground styles that fade on List selection highlight.
/// Chips use explicit colors and opaque backgrounds so they look the same on
/// the accent-colored selection highlight as on a normal row.
struct MedicationListRowView: View {
    let medication: Medication

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            Text(medication.name)
                .font(.headline)
                .foregroundStyle(.primary)
            Text(MedicationFormatting.formatDosage(amount: medication.dosageAmount, unit: medication.dosageUnit))
                .font(.subheadline)
                .foregroundStyle(.primary)
            HStack(spacing: 6) {
                MedicationTypeBadge(type: medication.type)
                if let category = medication.category {
                    Text(category.displayName)
                        .font(.caption2.weight(.semibold))
                        .padding(.horizontal, 10)
                        .padding(.vertical, DesignTokens.Spacing.xs)
                        .foregroundStyle(Color(.secondaryLabel))
                        .background(Color(.systemGray5))
                        .background(Color(.systemBackground))
                        .clipShape(Capsule())
                }
            }
        }
        .padding(.vertical, 2)
    }
}

/// Medications list adapted for the iPad content column.
/// Uses selection binding instead of NavigationLink destination push.
struct MedicationsListColumn: View {
    @Binding var selectedMedicationId: String?
    @State private var viewModel = MedicationsListViewModel()

    var body: some View {
        List(selection: $selectedMedicationId) {
            if !viewModel.preventativeMedications.isEmpty {
                Section("Preventative") {
                    ForEach(viewModel.preventativeMedications) { med in
                        MedicationListRowView(medication: med)
                            .tag(med.id)
                    }
                }
            }

            if !viewModel.rescueMedications.isEmpty {
                Section("Rescue") {
                    ForEach(viewModel.rescueMedications) { med in
                        MedicationListRowView(medication: med)
                            .tag(med.id)
                    }
                }
            }

            if !viewModel.otherMedications.isEmpty {
                Section("Other") {
                    ForEach(viewModel.otherMedications) { med in
                        MedicationListRowView(medication: med)
                            .tag(med.id)
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
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Medications")
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
        .onReceive(NotificationCenter.default.publisher(for: .medicationDataChanged)) { _ in
            Task { await viewModel.loadMedications() }
        }
    }
}

/// Colored badge for medication type (Preventative/Rescue/Other).
/// The tint layers over an opaque base so the badge keeps its color
/// identity on a List selection's accent-colored highlight.
struct MedicationTypeBadge: View {
    let type: MedicationType

    var body: some View {
        let badgeColor = MedicationTypeColors.color(for: type)
        Text(MedicationTypeColors.label(for: type))
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, DesignTokens.Spacing.xs)
            .foregroundStyle(badgeColor)
            .background(badgeColor.opacity(0.2))
            .background(Color(.systemBackground))
            .clipShape(Capsule())
    }
}
