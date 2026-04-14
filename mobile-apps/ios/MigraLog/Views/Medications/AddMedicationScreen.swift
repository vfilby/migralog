import SwiftUI

struct AddMedicationScreen: View {
    @Environment(\.dismiss) private var dismiss
    @State private var name: String = ""
    @State private var type: MedicationType = .rescue
    @State private var dosageAmount: String = ""
    @State private var dosageUnit: String = "mg"
    @State private var category: MedicationCategory?
    @State private var scheduleFrequency: ScheduleFrequency?
    @State private var defaultQuantity: String = "1"
    @State private var notes: String = ""
    @State private var searchResults: [PresetMedication] = []
    @State private var showAutocomplete = false
    @State private var isSaving = false
    @State private var reminderTime = AddMedicationScreen.defaultMorningTime()
    @State private var reminderEnabled = true
    @State private var minIntervalHoursText: String = ""

    var body: some View {
        Form {
            Section("Medication Name") {
                TextField("Name", text: $name)
                    .onChange(of: name) { _, newValue in
                        if newValue.count > 100 {
                            name = String(newValue.prefix(100))
                            return
                        }
                        searchResults = PresetMedications.search(newValue)
                        showAutocomplete = !searchResults.isEmpty && !newValue.isEmpty
                    }

                if name.count == 100 {
                    Text("Maximum 100 characters reached")
                        .font(.caption)
                        .foregroundStyle(.orange)
                }

                if showAutocomplete {
                    ForEach(searchResults.prefix(5)) { preset in
                        Button {
                            applyPreset(preset)
                        } label: {
                            VStack(alignment: .leading) {
                                Text(preset.name)
                                    .font(.subheadline)
                                Text("\(MedicationFormatting.formatDosage(amount: preset.dosageAmount, unit: preset.dosageUnit)) · \(preset.type.displayName)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }

            Section("Type") {
                Picker("Type", selection: $type) {
                    ForEach(MedicationType.allCases) { t in
                        Text(t.displayName).tag(t)
                    }
                }
                .pickerStyle(.segmented)
            }

            Section("Dosage") {
                TextField("Amount", text: $dosageAmount)
                    .keyboardType(.decimalPad)
                TextField("Unit (mg, ml, tablets...)", text: $dosageUnit)
            }

            Section {
                TextField("Number of doses", text: $defaultQuantity)
                    .keyboardType(.decimalPad)
            } header: {
                Text("Default Quantity")
            } footer: {
                Text("Number of doses typically taken at once. For example, if you take 3 tablets of 200mg Advil, enter 3.")
            }

            Section("Category") {
                Picker("Category", selection: $category) {
                    Text("None").tag(MedicationCategory?.none)
                    ForEach(MedicationCategory.allCases) { cat in
                        Text(cat.displayName).tag(Optional(cat))
                    }
                }
            }

            if type == .preventative {
                Section("Schedule") {
                    Picker("Frequency", selection: $scheduleFrequency) {
                        Text("None").tag(ScheduleFrequency?.none)
                        ForEach(ScheduleFrequency.allCases) { freq in
                            Text(freq.displayName).tag(Optional(freq))
                        }
                    }
                }
            }

            if type == .preventative && scheduleFrequency != nil {
                Section("Reminder") {
                    DatePicker(
                        "Reminder Time",
                        selection: $reminderTime,
                        displayedComponents: .hourAndMinute
                    )
                    .accessibilityIdentifier("add-med-reminder-time")

                    Toggle("Enable Reminder", isOn: $reminderEnabled)
                        .accessibilityIdentifier("add-med-reminder-toggle")
                }
            }

            Section {
                TextField("Hours (e.g. 24)", text: $minIntervalHoursText)
                    .keyboardType(.decimalPad)
                    .accessibilityIdentifier("add-med-min-interval-hours")
            } header: {
                Text("Minimum Time Between Doses")
            } footer: {
                Text("Leave blank if there's no minimum interval")
            }

            Section("Notes") {
                TextEditor(text: $notes)
                    .frame(minHeight: 60)
            }
        }
        .navigationTitle("Add Medication")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    Task { await save() }
                }
                .disabled(name.isEmpty || dosageAmount.isEmpty || dosageUnit.isEmpty || isSaving)
            }
        }
    }

    private func applyPreset(_ preset: PresetMedication) {
        name = preset.name
        type = preset.type
        dosageAmount = String(Int(preset.dosageAmount))
        dosageUnit = preset.dosageUnit
        category = preset.category
        scheduleFrequency = preset.scheduleFrequency
        showAutocomplete = false
    }

    private static func defaultMorningTime() -> Date {
        var components = DateComponents()
        components.hour = 8
        components.minute = 0
        return Calendar.current.date(from: components) ?? Date()
    }

    private func save() async {
        guard let amount = Double(dosageAmount), amount > 0 else { return }
        isSaving = true
        defer { isSaving = false }

        let now = TimestampHelper.now
        let medication = Medication(
            id: UUID().uuidString,
            name: name,
            type: type,
            dosageAmount: amount,
            dosageUnit: dosageUnit,
            defaultQuantity: Double(defaultQuantity).flatMap { $0 > 0 ? $0 : nil },
            scheduleFrequency: scheduleFrequency,
            photoUri: nil,
            active: true,
            notes: notes.isEmpty ? nil : notes,
            category: category,
            minIntervalHours: Double(minIntervalHoursText).flatMap { $0 > 0 ? $0 : nil },
            createdAt: now,
            updatedAt: now
        )

        do {
            let repo = MedicationRepository(dbManager: DatabaseManager.shared)
            try await repo.createMedication(medication)

            // Create initial schedule for preventative meds with a frequency set
            if type == .preventative && scheduleFrequency != nil {
                let schedule = MedicationSchedule(
                    id: UUID().uuidString,
                    medicationId: medication.id,
                    time: timeToString(reminderTime),
                    timezone: TimeZone.current.identifier,
                    dosage: amount,
                    enabled: true,
                    notificationId: nil,
                    reminderEnabled: reminderEnabled
                )
                _ = try repo.createSchedule(schedule)
            }

            dismiss()
        } catch {
            AppLogger.shared.error("Failed to save medication", error: error)
        }
    }
}
