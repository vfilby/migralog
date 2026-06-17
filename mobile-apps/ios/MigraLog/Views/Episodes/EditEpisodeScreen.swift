import SwiftUI

struct EditEpisodeScreen: View {
    let episode: Episode
    @Bindable var viewModel: EpisodeDetailViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var trackingOptions = TrackingOptionsViewModel()
    @State private var startTime: Date
    @State private var endTime: Date?
    @State private var selectedLocations: Set<PainLocation>
    @State private var selectedSymptoms: Set<Symptom>
    @State private var selectedTriggers: Set<Trigger>
    @State private var notes: String
    @State private var isSaving = false

    init(episode: Episode, viewModel: EpisodeDetailViewModel) {
        self.episode = episode
        self.viewModel = viewModel
        _startTime = State(initialValue: episode.startDate)
        _endTime = State(initialValue: episode.endDate)
        _selectedLocations = State(initialValue: Set(episode.locations))
        _selectedSymptoms = State(initialValue: Set(episode.symptoms))
        _selectedTriggers = State(initialValue: Set(episode.triggers))
        _notes = State(initialValue: episode.notes ?? "")
    }

    var body: some View {
        Form {
            Section("Start Time") {
                DatePicker(
                    "Started",
                    selection: $startTime,
                    in: ...( endTime ?? Date()),
                    displayedComponents: [.date, .hourAndMinute]
                )
            }

            if let endBinding = Binding($endTime) {
                Section("End Time") {
                    DatePicker(
                        "Ended",
                        selection: endBinding,
                        in: startTime...Date(),
                        displayedComponents: [.date, .hourAndMinute]
                    )
                }
            }
            Section("Pain Locations") {
                PainLocationGrid(selectedLocations: $selectedLocations)
            }

            Section("Symptoms") {
                FlowLayout(spacing: DesignTokens.Spacing.sm) {
                    ForEach(symptomChoices) { symptom in
                        Toggle(isOn: Binding(
                            get: { selectedSymptoms.contains(symptom) },
                            set: { if $0 { selectedSymptoms.insert(symptom) } else { selectedSymptoms.remove(symptom) } }
                        )) {
                            Text(symptom.displayName)
                                .font(.caption)
                        }
                        .toggleStyle(.button)
                        .buttonStyle(.bordered)
                    }
                }
            }

            Section("Triggers") {
                FlowLayout(spacing: DesignTokens.Spacing.sm) {
                    ForEach(triggerChoices) { trigger in
                        Toggle(isOn: Binding(
                            get: { selectedTriggers.contains(trigger) },
                            set: { if $0 { selectedTriggers.insert(trigger) } else { selectedTriggers.remove(trigger) } }
                        )) {
                            Text(trigger.displayName)
                                .font(.caption)
                        }
                        .toggleStyle(.button)
                        .buttonStyle(.bordered)
                    }
                }
            }

            Section("Notes") {
                TextEditor(text: $notes)
                    .frame(minHeight: 80)
            }
        }
        .navigationTitle("Edit Episode")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            trackingOptions.load()
        }
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

    // The pick lists offer the active options plus anything this episode already
    // has selected — an option hidden/deleted after logging must stay visible
    // here, or it couldn't be deselected (and would silently disappear).
    private var symptomChoices: [Symptom] {
        trackingOptions.activeSymptoms
            + selectedSymptoms
                .filter { !trackingOptions.activeSymptoms.contains($0) }
                .sorted { $0.displayName < $1.displayName }
    }

    private var triggerChoices: [Trigger] {
        trackingOptions.activeTriggers
            + selectedTriggers
                .filter { !trackingOptions.activeTriggers.contains($0) }
                .sorted { $0.displayName < $1.displayName }
    }

    private func save() async {
        isSaving = true
        defer { isSaving = false }

        // Save start time if changed
        let newStartTime = TimestampHelper.fromDate(startTime)
        if newStartTime != episode.startTime {
            await viewModel.editStartTime(newStartTime)
        }

        // Save end time if changed
        if let newEnd = endTime {
            let newEndTime = TimestampHelper.fromDate(newEnd)
            if newEndTime != episode.endTime {
                await viewModel.editEndTime(newEndTime)
            }
        }

        var updated = viewModel.episode ?? episode
        updated.locations = Array(selectedLocations)
        updated.symptoms = Array(selectedSymptoms)
        updated.triggers = Array(selectedTriggers)
        updated.notes = notes.isEmpty ? nil : notes
        updated.updatedAt = TimestampHelper.now
        await viewModel.updateEpisode(updated)
        dismiss()
    }
}
