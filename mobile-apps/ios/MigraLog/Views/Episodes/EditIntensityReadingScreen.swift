import SwiftUI

struct EditIntensityReadingScreen: View {
    let reading: IntensityReading
    @Bindable var viewModel: EpisodeDetailViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var intensity: Double
    @State private var selectedDate: Date
    @State private var isSaving = false

    init(reading: IntensityReading, viewModel: EpisodeDetailViewModel) {
        self.reading = reading
        self.viewModel = viewModel
        _intensity = State(initialValue: reading.intensity)
        _selectedDate = State(initialValue: Date(timeIntervalSince1970: Double(reading.timestamp) / 1000.0))
    }

    var body: some View {
        Form {
            Section("Pain Intensity") {
                PainIntensitySlider(intensity: $intensity)
            }

            Section("Time") {
                DatePicker("Time", selection: $selectedDate)
            }
        }
        .navigationTitle("Edit Reading")
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

        var updated = reading
        updated.intensity = intensity
        updated.timestamp = TimestampHelper.fromDate(selectedDate)
        updated.updatedAt = TimestampHelper.now

        await viewModel.updateReading(updated)
        dismiss()
    }
}
