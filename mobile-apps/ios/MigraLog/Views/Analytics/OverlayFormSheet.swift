import SwiftUI

struct OverlayFormSheet: View {
    @Environment(\.dismiss) private var dismiss
    let existingOverlay: CalendarOverlay?
    let onSave: (CalendarOverlay) -> Void
    let onDelete: ((String) -> Void)?

    @State private var label: String
    @State private var startDate: Date
    @State private var hasEndDate: Bool
    @State private var endDate: Date
    @State private var notes: String
    @State private var excludeFromStats: Bool
    @State private var showDeleteConfirmation = false

    init(overlay: CalendarOverlay? = nil, onSave: @escaping (CalendarOverlay) -> Void, onDelete: ((String) -> Void)? = nil) {
        self.existingOverlay = overlay
        self.onSave = onSave
        self.onDelete = onDelete
        _label = State(initialValue: overlay?.label ?? "")
        _startDate = State(initialValue: overlay.flatMap { TimestampHelper.dateFromString($0.startDate) } ?? Date())
        _hasEndDate = State(initialValue: overlay?.endDate != nil)
        _endDate = State(initialValue: overlay?.endDate.flatMap { TimestampHelper.dateFromString($0) } ?? Date())
        _notes = State(initialValue: overlay?.notes ?? "")
        _excludeFromStats = State(initialValue: overlay?.excludeFromStats ?? true)
    }

    var body: some View {
        Form {
            Section("Label") {
                TextField("e.g. Cold - on medication", text: $label)
            }

            Section("Dates") {
                DatePicker("Start", selection: $startDate, displayedComponents: .date)

                Toggle("Has end date", isOn: $hasEndDate)

                if hasEndDate {
                    DatePicker("End", selection: $endDate, in: startDate..., displayedComponents: .date)
                }
            }

            Section("Notes") {
                TextField("Optional notes", text: $notes, axis: .vertical)
                    .lineLimit(3...6)
            }

            if existingOverlay != nil, let onDelete = onDelete {
                Section {
                    Button(role: .destructive) {
                        showDeleteConfirmation = true
                    } label: {
                        HStack {
                            Spacer()
                            Text("Delete Overlay")
                            Spacer()
                        }
                    }
                }
            }
        }
        .navigationTitle(existingOverlay != nil ? "Edit Overlay" : "Add Overlay")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    save()
                }
                .disabled(label.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .confirmationDialog("Delete this overlay?", isPresented: $showDeleteConfirmation) {
            Button("Delete", role: .destructive) {
                if let id = existingOverlay?.id {
                    onDelete?(id)
                }
                dismiss()
            }
        }
    }

    private func save() {
        let now = TimestampHelper.now
        let overlay = CalendarOverlay(
            id: existingOverlay?.id ?? UUID().uuidString,
            startDate: TimestampHelper.dateString(from: startDate),
            endDate: hasEndDate ? TimestampHelper.dateString(from: endDate) : nil,
            label: label.trimmingCharacters(in: .whitespaces),
            notes: notes.isEmpty ? nil : notes,
            excludeFromStats: excludeFromStats,
            createdAt: existingOverlay?.createdAt ?? now,
            updatedAt: now
        )
        onSave(overlay)
        dismiss()
    }
}
