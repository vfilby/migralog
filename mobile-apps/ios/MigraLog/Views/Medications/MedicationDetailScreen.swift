import SwiftUI

struct MedicationDetailScreen: View {
    let medicationId: String
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = MedicationDetailViewModel()
    @State private var showEditSheet = false
    @State private var showArchiveConfirm = false
    @State private var showDeleteDoseConfirm: MedicationDose? = nil
    @State private var showEditDose: MedicationDose? = nil
    @State private var shouldDismissAfterArchive = false
    @State private var showAddSchedule = false
    @State private var showEditSchedule: MedicationSchedule? = nil
    @State private var showLogDoseDetails = false
    @Environment(\.horizontalSizeClass) private var sizeClass

    private func cooldownStatus(_ medication: Medication) -> MedicationCooldown.Status {
        let lastTakenDose = viewModel.recentDoses.first(where: { $0.status == .taken })
        return MedicationCooldown.evaluate(medication: medication, lastDose: lastTakenDose)
    }

    var body: some View {
        Group {
            if let medication = viewModel.medication {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        // Medication info
                        medicationInfoSection(medication)

                        // Schedules
                        schedulesSection(medication)

                        // Cooldown warning banner (iPad / regular size class)
                        let status = cooldownStatus(medication)
                        if sizeClass == .regular, status.isOnCooldown, let summary = MedicationCooldown.summary(status) {
                            Label(summary, systemImage: "exclamationmark.triangle.fill")
                                .font(.subheadline.weight(.medium))
                                .foregroundStyle(.orange)
                                .padding()
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color.orange.opacity(0.1))
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                                .accessibilityIdentifier("cooldown-banner")
                        }

                        // Log dose button — opens details sheet pre-filled to now
                        Button {
                            showLogDoseDetails = true
                        } label: {
                            HStack {
                                if status.isOnCooldown {
                                    Image(systemName: "exclamationmark.triangle.fill")
                                        .foregroundStyle(.orange)
                                        .accessibilityIdentifier("cooldown-icon")
                                }
                                Label("Log Dose", systemImage: "plus.circle.fill")
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.accentColor)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                        .accessibilityIdentifier("log-dose-button")

                        // Notification Overrides section
                        notificationOverridesSection()

                        // Recent Activity
                        recentActivitySection()

                        // Archive button
                        Button {
                            showArchiveConfirm = true
                        } label: {
                            Text(medication.active ? "Archive Medication" : "Unarchive Medication")
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Color.orange.opacity(0.1))
                                .foregroundStyle(.orange)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                        .accessibilityIdentifier("archive-medication-button")
                    }
                    .padding()
                }
            } else if viewModel.isLoading {
                ProgressView()
            } else {
                ContentUnavailableView("Medication Not Found", systemImage: "exclamationmark.triangle")
            }
        }
        .navigationTitle(viewModel.medication?.name ?? "Medication")
        .toolbar {
            if viewModel.medication != nil {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Edit") { showEditSheet = true }
                }
            }
        }
        .sheet(isPresented: $showEditSheet) {
            if let medication = viewModel.medication {
                NavigationStack {
                    EditMedicationScreen(medication: medication, viewModel: viewModel)
                }
            }
        }
        .sheet(item: $showEditDose) { dose in
            NavigationStack {
                EditDoseScreen(dose: dose, viewModel: viewModel)
            }
        }
        .sheet(isPresented: $showAddSchedule) {
            if let medication = viewModel.medication {
                AddScheduleSheet(
                    medicationId: medication.id,
                    defaultDosage: medication.dosageAmount,
                    viewModel: viewModel
                )
            }
        }
        .sheet(item: $showEditSchedule) { schedule in
            EditScheduleSheet(schedule: schedule, viewModel: viewModel)
        }
        .sheet(isPresented: $showLogDoseDetails) {
            if let medication = viewModel.medication {
                LogDoseDetailsSheet(medication: medication, viewModel: viewModel)
            }
        }
        .alert("Archive Medication", isPresented: $showArchiveConfirm) {
            Button("Archive", role: .destructive) {
                Task {
                    if viewModel.medication?.active == true {
                        await viewModel.archiveMedication()
                        shouldDismissAfterArchive = true
                        // Post after dismiss starts so parent can refresh
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                            NotificationCenter.default.post(name: .medicationDataChanged, object: nil)
                        }
                    } else {
                        await viewModel.unarchiveMedication()
                        NotificationCenter.default.post(name: .medicationDataChanged, object: nil)
                    }
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Are you sure you want to archive this medication?")
        }
        .onChange(of: shouldDismissAfterArchive) { _, shouldDismiss in
            if shouldDismiss {
                dismiss()
            }
        }
        .alert("Delete Dose", isPresented: .init(
            get: { showDeleteDoseConfirm != nil },
            set: { if !$0 { showDeleteDoseConfirm = nil } }
        )) {
            Button("Delete", role: .destructive) {
                if let dose = showDeleteDoseConfirm {
                    Task { await viewModel.deleteDose(dose.id) }
                }
                showDeleteDoseConfirm = nil
            }
            Button("Cancel", role: .cancel) { showDeleteDoseConfirm = nil }
        }
        .task {
            await viewModel.loadMedication(medicationId)
        }
    }

    @ViewBuilder
    private func medicationInfoSection(_ medication: Medication) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            LabeledContent("Type") { Text(medication.type.displayName) }
            LabeledContent("Dosage") {
                Text(MedicationFormatting.formatDosage(amount: medication.dosageAmount, unit: medication.dosageUnit))
            }
            if let category = medication.category {
                LabeledContent("Category") { Text(category.displayName) }
            }
            if let freq = medication.scheduleFrequency {
                LabeledContent("Schedule") { Text(freq.displayName) }
            }
            if let notes = medication.notes, !notes.isEmpty {
                LabeledContent("Notes") { Text(notes) }
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder
    private func schedulesSection(_ medication: Medication) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Reminders")
                    .font(.headline)
                Spacer()
                Button {
                    showAddSchedule = true
                } label: {
                    Label("Add Reminder", systemImage: "plus.circle")
                        .font(.subheadline)
                }
                .accessibilityIdentifier("add-schedule-button")
            }

            if viewModel.schedules.isEmpty {
                Text("No reminders set")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(viewModel.schedules) { schedule in
                    HStack {
                        Text(DateFormatting.displayTime(from: schedule.time))

                        Spacer()

                        Button {
                            Task {
                                var toggled = schedule
                                toggled.reminderEnabled.toggle()
                                await viewModel.updateSchedule(toggled)
                            }
                        } label: {
                            if schedule.reminderEnabled {
                                Image(systemName: "bell.fill")
                                    .foregroundStyle(.blue)
                            } else {
                                Image(systemName: "bell.slash")
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("toggle-reminder-\(schedule.id)")
                    }
                    .contentShape(Rectangle())
                    .onTapGesture {
                        showEditSchedule = schedule
                    }
                    .contextMenu {
                        Button {
                            showEditSchedule = schedule
                        } label: {
                            Label("Edit", systemImage: "pencil")
                        }
                        Button(role: .destructive) {
                            Task { await viewModel.deleteSchedule(schedule.id) }
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                    .accessibilityIdentifier("schedule-row-\(schedule.id)")
                }
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder
    private func notificationOverridesSection() -> some View {
        DisclosureGroup("Notification Overrides") {
            Text("Per-medication notification settings will be shown here.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder
    private func doseRow(_ dose: MedicationDose) -> some View {
        HStack {
            DoseRowView(dose: dose, medication: viewModel.medication)
            Spacer(minLength: 8)
            Menu {
                Button {
                    showEditDose = dose
                } label: {
                    Label("Edit", systemImage: "pencil")
                }
                Button(role: .destructive) {
                    showDeleteDoseConfirm = dose
                } label: {
                    Label("Delete", systemImage: "trash")
                }
            } label: {
                Image(systemName: "ellipsis.circle")
                    .foregroundStyle(.secondary)
                    .padding(.leading, 4)
            }
            .accessibilityIdentifier("dose-menu-\(dose.id)")
        }
        .contextMenu {
            Button {
                showEditDose = dose
            } label: {
                Label("Edit", systemImage: "pencil")
            }
            Button(role: .destructive) {
                showDeleteDoseConfirm = dose
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }

    @ViewBuilder
    private func recentActivitySection() -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Recent Activity")
                .font(.headline)

            if viewModel.recentDoses.isEmpty {
                Text("No doses logged in the last 30 days")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(viewModel.recentDoses) { dose in
                    doseRow(dose)
                }
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

struct DoseRowView: View {
    let dose: MedicationDose
    let medication: Medication?

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(DateFormatting.relativeDate(dose.date))
                    .font(.subheadline)
                if let med = medication {
                    Text(MedicationFormatting.formatDose(quantity: dose.quantity, amount: dose.dosageAmount ?? med.dosageAmount, unit: dose.dosageUnit ?? med.dosageUnit))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            Spacer()
            if dose.status == .taken {
                Label("Taken at \(DateFormatting.displayTime(dose.date))", systemImage: "checkmark.circle.fill")
                    .font(.caption)
                    .foregroundStyle(.green)
            } else {
                Label("Skipped", systemImage: "xmark.circle.fill")
                    .font(.caption)
                    .foregroundStyle(.red)
            }
        }
        .padding(.vertical, 4)
    }
}
