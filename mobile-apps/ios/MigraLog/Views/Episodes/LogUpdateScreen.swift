import SwiftUI

struct LogUpdateScreen: View {
    let episodeId: String
    @Bindable var viewModel: EpisodeDetailViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var intensity: Double = 5.0
    @State private var selectedLocations: Set<PainLocation> = []
    @State private var initialLocations: Set<PainLocation> = []
    @State private var selectedSymptoms: Set<Symptom> = []
    @State private var initialSymptoms: Set<Symptom> = []
    @State private var noteText: String = ""
    @State private var isSaving = false
    @State private var didLoadState = false

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
        .onAppear { prefillFromCurrentState() }
    }

    private func prefillFromCurrentState() {
        guard !didLoadState else { return }
        didLoadState = true

        // Pre-fill intensity from latest reading
        if let latestReading = viewModel.intensityReadings.last {
            intensity = latestReading.intensity
        }

        // Pre-fill pain locations from most recent log, or episode's initial locations
        if let latestLocationLog = viewModel.painLocationLogs.last {
            let locations = Set(latestLocationLog.painLocations)
            selectedLocations = locations
            initialLocations = locations
        } else if let episode = viewModel.episode {
            let locations = Set(episode.locations)
            selectedLocations = locations
            initialLocations = locations
        }

        // Pre-fill symptoms from active (unresolved) symptom logs, or episode's initial symptoms
        let activeSymptoms = viewModel.symptomLogs
            .filter { $0.resolutionTime == nil }
            .map { $0.symptom }
        if !activeSymptoms.isEmpty {
            let symptoms = Set(activeSymptoms)
            selectedSymptoms = symptoms
            initialSymptoms = symptoms
        } else if let episode = viewModel.episode {
            let symptoms = Set(episode.symptoms)
            selectedSymptoms = symptoms
            initialSymptoms = symptoms
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

        // Add symptom logs only for newly added symptoms
        let newSymptoms = selectedSymptoms.subtracting(initialSymptoms)
        for symptom in newSymptoms {
            await viewModel.addSymptomLog(
                symptom: symptom,
                timestamp: now
            )
        }

        // Add pain location log if locations changed
        if selectedLocations != initialLocations {
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
