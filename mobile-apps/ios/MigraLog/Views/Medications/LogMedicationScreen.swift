import SwiftUI

struct LogMedicationScreen: View {
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = LogMedicationViewModel()
    @State private var detailMedication: Medication?

    /// Filter to only rescue medications (used from Dashboard).
    /// When false, shows all active medications.
    var rescueOnly: Bool = true

    var body: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                let allMeds = rescueOnly
                    ? viewModel.medications.filter { $0.type == .rescue }
                    : viewModel.medications
                if allMeds.isEmpty {
                    Text(rescueOnly ? "No rescue medications configured" : "No medications configured")
                        .foregroundStyle(.secondary)
                        .padding(.top, 40)
                } else {
                    ForEach(allMeds) { med in
                        LogMedicationCard(
                            medication: med,
                            lastDose: viewModel.lastDoseByMedication[med.id],
                            categoryStatus: med.category.flatMap { viewModel.categoryUsage[$0] } ?? .noLimit,
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
                }
            }
            .padding()
        }
        .navigationTitle("Log Medication")
        .accessibilityIdentifier("log-medication-title")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
        }
        .sheet(item: $detailMedication) { med in
            NavigationStack {
                LogMedicationDetailSheet(
                    medication: med,
                    lastDose: viewModel.lastDoseByMedication[med.id],
                    categoryStatus: med.category.flatMap { viewModel.categoryUsage[$0] } ?? .noLimit
                ) { dose in
                    Task {
                        let repo = MedicationRepository(dbManager: DatabaseManager.shared)
                        try? await repo.createDose(dose)
                        dismiss()
                    }
                }
            }
        }
        .task {
            await viewModel.loadMedications()
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
    let onQuickLog: () -> Void
    let onDetails: () -> Void
    @Environment(\.horizontalSizeClass) private var sizeClass

    private var cooldownStatus: MedicationCooldown.Status {
        MedicationCooldown.evaluate(medication: medication, lastDose: lastDose)
    }

    var body: some View {
        let status = cooldownStatus
        let catStatus = categoryStatus
        VStack(alignment: .leading, spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(medication.name)
                    .font(.headline)
                Text(MedicationFormatting.formatDosage(amount: medication.dosageAmount, unit: medication.dosageUnit))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            MedicationSafetyBanners(
                cooldown: status,
                categoryStatus: catStatus,
                medicationCategory: medication.category,
                medicationId: medication.id
            )

            HStack(spacing: 8) {
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
                    .padding(.vertical, 12)
                    .background(Color.accentColor)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }

                Button(action: onDetails) {
                    Text("Details")
                        .padding(.horizontal, 20)
                        .padding(.vertical, 12)
                        .background(Color(.systemGray4))
                        .foregroundStyle(.primary)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                }
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Detail Sheet

struct LogMedicationDetailSheet: View {
    let medication: Medication
    var lastDose: MedicationDose? = nil
    var categoryStatus: CategoryUsageStatus = .noLimit
    let onSave: (MedicationDose) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var quantity: Double
    @State private var timestamp = Date()
    @State private var notes: String = ""

    init(
        medication: Medication,
        lastDose: MedicationDose? = nil,
        categoryStatus: CategoryUsageStatus = .noLimit,
        onSave: @escaping (MedicationDose) -> Void
    ) {
        self.medication = medication
        self.lastDose = lastDose
        self.categoryStatus = categoryStatus
        self.onSave = onSave
        self._quantity = State(initialValue: medication.defaultQuantity ?? 1)
    }

    private var cooldownStatus: MedicationCooldown.Status {
        MedicationCooldown.evaluate(medication: medication, lastDose: lastDose)
    }

    var body: some View {
        Form {
            let cooldown = cooldownStatus
            if cooldown.hoursSinceLastDose != nil || categoryStatus.isWarning {
                Section {
                    MedicationSafetyBanners(
                        cooldown: cooldown,
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
