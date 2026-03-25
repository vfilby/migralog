import SwiftUI

// MARK: - Add Schedule Sheet

struct AddScheduleSheet: View {
    let medicationId: String
    let defaultDosage: Double
    let viewModel: MedicationDetailViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var selectedTime = defaultMorningTime()
    @State private var reminderEnabled = true
    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Reminder Time") {
                    DatePicker(
                        "Time",
                        selection: $selectedTime,
                        displayedComponents: .hourAndMinute
                    )
                    .datePickerStyle(.wheel)
                    .accessibilityIdentifier("schedule-time-picker")
                }

                Section {
                    Toggle("Enable Reminder", isOn: $reminderEnabled)
                        .accessibilityIdentifier("schedule-reminder-toggle")
                }
            }
            .navigationTitle("Add Reminder")
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
                    .accessibilityIdentifier("save-schedule-button")
                }
            }
        }
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }

        let timeString = timeToString(selectedTime)
        await viewModel.addSchedule(
            time: timeString,
            dosage: defaultDosage,
            reminderEnabled: reminderEnabled
        )
        dismiss()
    }

    private static func defaultMorningTime() -> Date {
        var components = DateComponents()
        components.hour = 8
        components.minute = 0
        return Calendar.current.date(from: components) ?? Date()
    }
}

// MARK: - Edit Schedule Sheet

struct EditScheduleSheet: View {
    let schedule: MedicationSchedule
    let viewModel: MedicationDetailViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var selectedTime: Date
    @State private var reminderEnabled: Bool
    @State private var isSaving = false
    @State private var showDeleteConfirm = false

    init(schedule: MedicationSchedule, viewModel: MedicationDetailViewModel) {
        self.schedule = schedule
        self.viewModel = viewModel
        _selectedTime = State(initialValue: Self.timeFromString(schedule.time))
        _reminderEnabled = State(initialValue: schedule.reminderEnabled)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Reminder Time") {
                    DatePicker(
                        "Time",
                        selection: $selectedTime,
                        displayedComponents: .hourAndMinute
                    )
                    .datePickerStyle(.wheel)
                    .accessibilityIdentifier("schedule-time-picker")
                }

                Section {
                    Toggle("Enable Reminder", isOn: $reminderEnabled)
                        .accessibilityIdentifier("schedule-reminder-toggle")
                }

                Section {
                    Button(role: .destructive) {
                        showDeleteConfirm = true
                    } label: {
                        HStack {
                            Spacer()
                            Text("Delete Reminder")
                            Spacer()
                        }
                    }
                    .accessibilityIdentifier("delete-schedule-button")
                }
            }
            .navigationTitle("Edit Reminder")
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
                    .accessibilityIdentifier("save-schedule-button")
                }
            }
            .alert("Delete Reminder", isPresented: $showDeleteConfirm) {
                Button("Delete", role: .destructive) {
                    Task {
                        await viewModel.deleteSchedule(schedule.id)
                        dismiss()
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Are you sure you want to delete this reminder?")
            }
        }
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }

        let timeString = timeToString(selectedTime)
        var updated = schedule
        updated.time = timeString
        updated.timezone = TimeZone.current.identifier
        updated.reminderEnabled = reminderEnabled
        await viewModel.updateSchedule(updated)
        dismiss()
    }

    private static func timeFromString(_ timeString: String) -> Date {
        let parts = timeString.split(separator: ":")
        guard parts.count == 2,
              let hour = Int(parts[0]),
              let minute = Int(parts[1]) else {
            return Date()
        }
        var components = DateComponents()
        components.hour = hour
        components.minute = minute
        return Calendar.current.date(from: components) ?? Date()
    }
}

// MARK: - Shared Helpers

/// Convert a Date (time-only) to "HH:mm" string format.
func timeToString(_ date: Date) -> String {
    let components = Calendar.current.dateComponents([.hour, .minute], from: date)
    return String(format: "%02d:%02d", components.hour ?? 0, components.minute ?? 0)
}
