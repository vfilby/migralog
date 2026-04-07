import SwiftUI

struct EditPainLocationLogScreen: View {
    let log: PainLocationLog
    @Bindable var viewModel: EpisodeDetailViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var selectedLocations: Set<PainLocation>
    @State private var selectedDate: Date
    @State private var isSaving = false

    init(log: PainLocationLog, viewModel: EpisodeDetailViewModel) {
        self.log = log
        self.viewModel = viewModel
        _selectedLocations = State(initialValue: Set(log.painLocations))
        _selectedDate = State(initialValue: Date(timeIntervalSince1970: Double(log.timestamp) / 1000.0))
    }

    var body: some View {
        Form {
            Section("Pain Locations") {
                PainLocationGrid(selectedLocations: $selectedLocations)
            }

            Section("Time") {
                DatePicker("Time", selection: $selectedDate)
            }
        }
        .navigationTitle("Edit Pain Location")
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
            }
        }
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }

        var updated = log
        updated.painLocations = Array(selectedLocations)
        updated.timestamp = TimestampHelper.fromDate(selectedDate)
        updated.updatedAt = TimestampHelper.now

        await viewModel.updatePainLocationLog(updated)
        dismiss()
    }
}
