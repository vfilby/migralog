import SwiftUI

struct LogUpdateScreen: View {
    let episodeId: String
    @Bindable var viewModel: EpisodeDetailViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var intensity: Double = 5.0
    @State private var selectedLocations: Set<PainLocation> = []
    @State private var selectedSymptoms: Set<Symptom> = []
    @State private var noteText: String = ""
    @State private var isSaving = false

    var body: some View {
        Form {
            Section("Pain Intensity") {
                PainIntensitySlider(intensity: $intensity)
            }

            Section("Pain Locations") {
                PainLocationGrid(selectedLocations: $selectedLocations)
            }

            Section("Additional Symptoms") {
                FlowLayout(spacing: 8) {
                    ForEach(Symptom.allCases) { symptom in
                        SelectableChip(
                            title: symptom.displayName,
                            isSelected: selectedSymptoms.contains(symptom)
                        ) {
                            if selectedSymptoms.contains(symptom) {
                                selectedSymptoms.remove(symptom)
                            } else {
                                selectedSymptoms.insert(symptom)
                            }
                        }
                    }
                }
            }

            Section("Note") {
                TextEditor(text: $noteText)
                    .frame(minHeight: 60)
            }
        }
        .navigationTitle("Log Update")
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
        let now = TimestampHelper.now

        // Add intensity reading
        await viewModel.addIntensityReading(
            intensity: intensity,
            timestamp: now
        )

        // Add symptom logs
        for symptom in selectedSymptoms {
            await viewModel.addSymptomLog(
                symptom: symptom,
                timestamp: now
            )
        }

        // Add pain location log
        if !selectedLocations.isEmpty {
            await viewModel.addPainLocationLog(
                locations: Array(selectedLocations),
                timestamp: now
            )
        }

        // Add note if present
        if !noteText.isEmpty {
            await viewModel.addEpisodeNote(
                note: noteText,
                timestamp: now
            )
        }

        dismiss()
    }
}
