import SwiftUI

/// Add or edit a free-standing diary note (beta diary notes feature,
/// FeatureFlags.diaryNotes). Writes directly via DiaryEntryRepository and posts
/// `.diaryDataChanged` on completion; hosts reload their day/month data on
/// sheet dismiss.
struct DiaryEntryEditorScreen: View {
    /// Existing entry to edit; nil to create a new one.
    let entry: DiaryEntry?
    @Environment(\.dismiss) private var dismiss

    @State private var noteText: String
    @State private var selectedDate: Date
    @State private var isSaving = false

    init(entry: DiaryEntry? = nil, initialDate: Date = Date()) {
        self.entry = entry
        _noteText = State(initialValue: entry?.note ?? "")
        _selectedDate = State(initialValue: entry?.date ?? initialDate)
    }

    var body: some View {
        Form {
            Section("Note") {
                TextEditor(text: $noteText)
                    .frame(minHeight: 100)
                    .accessibilityIdentifier("diary-note-text-input")
            }

            Section("Time") {
                DatePicker("Time", selection: $selectedDate)
                    .accessibilityIdentifier("diary-note-time-picker")
            }

            if entry != nil {
                Section {
                    Button("Delete Note", role: .destructive) {
                        Task { await deleteEntry() }
                    }
                    .frame(maxWidth: .infinity)
                    .accessibilityIdentifier("delete-diary-note-button")
                }
            }
        }
        .navigationTitle(entry == nil ? "Add Note" : "Edit Note")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
                    .accessibilityIdentifier("cancel-diary-note-button")
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    Task { await save() }
                }
                .disabled(noteText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSaving)
                .accessibilityIdentifier("save-diary-note-button")
            }
        }
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }

        let now = TimestampHelper.now
        let repo = DiaryEntryRepository(dbManager: DatabaseManager.shared)
        do {
            if var updated = entry {
                updated.note = noteText
                updated.timestamp = TimestampHelper.fromDate(selectedDate)
                updated.updatedAt = now
                try repo.updateEntry(updated)
            } else {
                try repo.createEntry(DiaryEntry(
                    id: UUID().uuidString,
                    timestamp: TimestampHelper.fromDate(selectedDate),
                    note: noteText,
                    createdAt: now,
                    updatedAt: now
                ))
            }
            NotificationCenter.default.post(name: .diaryDataChanged, object: nil)
            dismiss()
        } catch {
            AppLogger.shared.error("Failed to save diary entry", error: error)
        }
    }

    private func deleteEntry() async {
        guard let entry else { return }
        do {
            try DiaryEntryRepository(dbManager: DatabaseManager.shared).deleteEntry(entry.id)
            NotificationCenter.default.post(name: .diaryDataChanged, object: nil)
            dismiss()
        } catch {
            AppLogger.shared.error("Failed to delete diary entry", error: error)
        }
    }
}
