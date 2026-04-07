import SwiftUI

struct EditEpisodeNoteScreen: View {
    let note: EpisodeNote
    @Bindable var viewModel: EpisodeDetailViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var noteText: String
    @State private var selectedDate: Date
    @State private var isSaving = false

    init(note: EpisodeNote, viewModel: EpisodeDetailViewModel) {
        self.note = note
        self.viewModel = viewModel
        _noteText = State(initialValue: note.note)
        _selectedDate = State(initialValue: Date(timeIntervalSince1970: Double(note.timestamp) / 1000.0))
    }

    var body: some View {
        Form {
            Section("Note") {
                TextEditor(text: $noteText)
                    .frame(minHeight: 100)
                    .accessibilityIdentifier("note-text-input")
            }

            Section("Time") {
                DatePicker("Time", selection: $selectedDate)
                    .accessibilityIdentifier("note-time-picker")
            }
        }
        .navigationTitle("Edit Note")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    Task { await save() }
                }
                .disabled(noteText.isEmpty || isSaving)
            }
        }
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }

        var updated = note
        updated.note = noteText
        updated.timestamp = TimestampHelper.fromDate(selectedDate)
        await viewModel.updateNote(updated)
        dismiss()
    }
}
