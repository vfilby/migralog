import SwiftUI

struct LogUpdateScreen: View {
    let episodeId: String
    @Bindable var viewModel: EpisodeDetailViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var trackingOptions = TrackingOptionsViewModel()
    @State private var intensity: Double = 5.0
    @State private var selectedLocations: Set<PainLocation> = []
    @State private var initialLocations: Set<PainLocation> = []
    @State private var selectedSymptoms: Set<Symptom> = []
    @State private var initialSymptoms: Set<Symptom> = []
    @State private var noteText: String = ""
    @State private var timestamp = Date()
    @State private var isSaving = false
    @State private var didLoadState = false

    var body: some View {
        Form {
            Section("Pain Intensity") {
                PainIntensitySlider(intensity: $intensity)
            }

            Section("Time") {
                DatePicker(
                    "Time",
                    selection: $timestamp,
                    in: (viewModel.episode?.startDate ?? .distantPast)...Date()
                )
            }

            Section("Pain Locations") {
                PainLocationGrid(selectedLocations: $selectedLocations)
            }

            Section("Additional Symptoms") {
                FlowLayout(spacing: DesignTokens.Spacing.sm) {
                    ForEach(symptomChoices) { symptom in
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
        .task {
            trackingOptions.load()
        }
        .onAppear { prefillFromCurrentState() }
    }

    // Active options plus anything already selected (e.g. a symptom logged
    // earlier from an option that has since been hidden or deleted).
    private var symptomChoices: [Symptom] {
        trackingOptions.activeSymptoms
            + selectedSymptoms
                .filter { !trackingOptions.activeSymptoms.contains($0) }
                .sorted { $0.displayName < $1.displayName }
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
        let updateTimestamp = TimestampHelper.fromDate(timestamp)

        // Add intensity reading
        await viewModel.addIntensityReading(
            intensity: intensity,
            timestamp: updateTimestamp
        )

        // Add symptom logs only for newly added symptoms
        let newSymptoms = selectedSymptoms.subtracting(initialSymptoms)
        for symptom in newSymptoms {
            await viewModel.addSymptomLog(
                symptom: symptom,
                timestamp: updateTimestamp
            )
        }

        // Add pain location log if locations changed
        if selectedLocations != initialLocations {
            await viewModel.addPainLocationLog(
                locations: Array(selectedLocations),
                timestamp: updateTimestamp
            )
        }

        // Add note if present
        if !noteText.isEmpty {
            await viewModel.addEpisodeNote(
                note: noteText,
                timestamp: updateTimestamp
            )
        }

        dismiss()
    }
}
