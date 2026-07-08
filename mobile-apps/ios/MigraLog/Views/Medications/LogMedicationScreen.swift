import SwiftUI

struct LogMedicationScreen: View {
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = LogMedicationViewModel()
    @State private var detailMedication: Medication?
    @State private var showAddMedication = false
    @State private var showOtherMedications = false

    /// Filter to only rescue medications (used from Dashboard).
    /// When false, shows all active medications.
    var rescueOnly: Bool = true

    /// Medications shown prominently as log cards. In rescue-only mode these are
    /// the rescue meds; otherwise it's every active medication.
    private var prominentMedications: [Medication] {
        rescueOnly
            ? viewModel.medications.filter { $0.type == .rescue }
            : viewModel.medications
    }

    /// Non-rescue meds, tucked into a collapsed disclosure below the rescue
    /// cards so they can still be logged from this flow. Empty when not in
    /// rescue-only mode (everything is already shown prominently).
    private var otherMedications: [Medication] {
        rescueOnly ? viewModel.medications.filter { $0.type != .rescue } : []
    }

    var body: some View {
        Group {
            if viewModel.medications.isEmpty {
                emptyState
            } else {
                medicationList
            }
        }
        .navigationTitle("Log Medication")
        .accessibilityIdentifier("log-medication-title")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
        }
        .sheet(isPresented: $showAddMedication, onDismiss: {
            // Reload so a newly added medication appears here, ready to log
            // without leaving the flow.
            Task { await viewModel.loadMedications() }
        }) {
            NavigationStack {
                AddMedicationScreen()
            }
        }
        .sheet(item: $detailMedication) { med in
            NavigationStack {
                LogMedicationDetailSheet(
                    medication: med,
                    lastDose: viewModel.lastDoseByMedication[med.id],
                    categoryStatus: viewModel.categoryUsageStatus(for: med),
                    categoryCooldown: viewModel.categoryCooldowns[med.id]
                ) { dose in
                    Task {
                        try? await MedicationDoseLogger().record(dose)
                        dismiss()
                    }
                }
            }
        }
        .task {
            await viewModel.loadMedications()
        }
    }

    // MARK: - Medication list

    private var medicationList: some View {
        ScrollView {
            LazyVStack(spacing: DesignTokens.Spacing.md) {
                if prominentMedications.isEmpty {
                    // Rescue-only flow where the user has meds, just no rescue
                    // ones — explain the empty top instead of leaving it blank.
                    Text("No rescue medications configured")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.top, DesignTokens.Spacing.sm)
                } else {
                    ForEach(prominentMedications) { med in
                        medicationCard(med)
                    }
                }

                if !otherMedications.isEmpty {
                    DisclosureGroup(isExpanded: $showOtherMedications) {
                        LazyVStack(spacing: DesignTokens.Spacing.md) {
                            ForEach(otherMedications) { med in
                                medicationCard(med)
                            }
                        }
                        .padding(.top, DesignTokens.Spacing.sm)
                    } label: {
                        Text("Other Medications")
                            .font(.headline)
                    }
                    .accessibilityIdentifier("log-medication-other-disclosure")
                }
            }
            .padding()
        }
    }

    private func medicationCard(_ med: Medication) -> some View {
        LogMedicationCard(
            medication: med,
            lastDose: viewModel.lastDoseByMedication[med.id],
            categoryStatus: viewModel.categoryUsageStatus(for: med),
            categoryCooldown: viewModel.categoryCooldowns[med.id],
            onQuickLog: {
                Task {
                    await quickLog(med)
                }
            },
            onDetails: {
                detailMedication = med
            }
        )
    }

    // MARK: - Empty state

    private var emptyState: some View {
        ContentUnavailableView {
            Label(rescueOnly ? "No Rescue Medications" : "No Medications", systemImage: "pills")
        } description: {
            Text(rescueOnly
                ? "Add a rescue medication to log a dose. You can manage all your medications in the Medications tab."
                : "Add a medication to log a dose. You can manage all your medications in the Medications tab.")
        } actions: {
            Button {
                showAddMedication = true
            } label: {
                Text("Add Medication")
                    .fontWeight(.semibold)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .accessibilityIdentifier("log-medication-empty-add")
        }
    }

    private func quickLog(_ med: Medication) async {
        await viewModel.quickLog(med)
        dismiss()
    }
}

// MARK: - Medication Card

struct LogMedicationCard: View {
    let medication: Medication
    var lastDose: MedicationDose? = nil
    var categoryStatus: CategoryUsageStatus = .noLimit
    var categoryCooldown: CategoryCooldown.Status? = nil
    let onQuickLog: () -> Void
    let onDetails: () -> Void
    @Environment(\.horizontalSizeClass) private var sizeClass

    private var cooldownStatus: MedicationCooldown.Status {
        MedicationCooldown.evaluate(medication: medication, lastDose: lastDose)
    }

    var body: some View {
        let status = cooldownStatus
        let catStatus = categoryStatus
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            VStack(alignment: .leading, spacing: 2) {
                Text(medication.name)
                    .font(.headline)
                Text(MedicationFormatting.formatDosage(amount: medication.dosageAmount, unit: medication.dosageUnit))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            MedicationSafetyBanners(
                cooldown: status,
                categoryCooldown: categoryCooldown,
                categoryStatus: catStatus,
                medicationCategory: medication.category,
                medicationId: medication.id
            )

            HStack(spacing: DesignTokens.Spacing.sm) {
                Button(action: onQuickLog) {
                    HStack(spacing: 6) {
                        if status.isOnCooldown {
                            Image(systemName: "clock.fill")
                                .foregroundStyle(.orange)
                                .accessibilityIdentifier("cooldown-icon-\(medication.id)")
                        }
                        if catStatus.isWarning {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundStyle(catStatus.isStrong ? Color.red : Color.orange)
                                .accessibilityIdentifier("category-icon-\(medication.id)")
                        }
                        Text("Log \(MedicationFormatting.formatDose(quantity: medication.defaultQuantity ?? 1, amount: medication.dosageAmount, unit: medication.dosageUnit))")
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, DesignTokens.Spacing.md)
                    .background(Color.accentColor)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }

                Button(action: onDetails) {
                    Text("Details")
                        .padding(.horizontal, 20)
                        .padding(.vertical, DesignTokens.Spacing.md)
                        .background(Color(.systemGray4))
                        .foregroundStyle(.primary)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                }
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.lg))
    }
}

// MARK: - Detail Sheet

struct LogMedicationDetailSheet: View {
    let medication: Medication
    var lastDose: MedicationDose? = nil
    var categoryStatus: CategoryUsageStatus = .noLimit
    var categoryCooldown: CategoryCooldown.Status? = nil
    let onSave: (MedicationDose) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var quantity: Double
    @State private var timestamp = Date()
    @State private var notes: String = ""

    init(
        medication: Medication,
        lastDose: MedicationDose? = nil,
        categoryStatus: CategoryUsageStatus = .noLimit,
        categoryCooldown: CategoryCooldown.Status? = nil,
        onSave: @escaping (MedicationDose) -> Void
    ) {
        self.medication = medication
        self.lastDose = lastDose
        self.categoryStatus = categoryStatus
        self.categoryCooldown = categoryCooldown
        self.onSave = onSave
        self._quantity = State(initialValue: medication.defaultQuantity ?? 1)
    }

    private var cooldownStatus: MedicationCooldown.Status {
        MedicationCooldown.evaluate(medication: medication, lastDose: lastDose)
    }

    var body: some View {
        Form {
            let cooldown = cooldownStatus
            let hasCategoryCooldownInfo = categoryCooldown?.hoursSinceLastDose != nil
            if cooldown.hoursSinceLastDose != nil || categoryStatus.isWarning || hasCategoryCooldownInfo {
                Section {
                    MedicationSafetyBanners(
                        cooldown: cooldown,
                        categoryCooldown: categoryCooldown,
                        categoryStatus: categoryStatus,
                        medicationCategory: medication.category,
                        medicationId: medication.id
                    )
                }
            }

            Section("Medication") {
                LabeledContent("Name", value: medication.name)
                LabeledContent("Dosage", value: MedicationFormatting.formatDosage(amount: medication.dosageAmount, unit: medication.dosageUnit))
            }

            Section("Dose") {
                Stepper("Quantity: \(Int(quantity))", value: $quantity, in: 1...10, step: 1)
                DatePicker("Time", selection: $timestamp)
            }

            Section("Notes") {
                TextField("Optional notes", text: $notes, axis: .vertical)
                    .lineLimit(3...6)
            }
        }
        .navigationTitle("Log \(medication.name)")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    let now = TimestampHelper.now
                    let doseTimestamp = TimestampHelper.fromDate(timestamp)
                    let episodeRepo = EpisodeRepository(dbManager: DatabaseManager.shared)
                    let activeEpisode = try? episodeRepo.getEpisodeByTimestamp(doseTimestamp)
                    let dose = MedicationDose(
                        id: UUID().uuidString,
                        medicationId: medication.id,
                        timestamp: doseTimestamp,
                        quantity: quantity,
                        dosageAmount: medication.dosageAmount,
                        dosageUnit: medication.dosageUnit,
                        status: .taken,
                        episodeId: activeEpisode?.id,
                        effectivenessRating: nil,
                        timeToRelief: nil,
                        sideEffects: [],
                        notes: notes.isEmpty ? nil : notes,
                        createdAt: now,
                        updatedAt: now
                    )
                    onSave(dose)
                    dismiss()
                }
            }
        }
    }
}
