import SwiftUI

struct NewEpisodeScreen: View {
    @Environment(\.dismiss) private var dismiss
    @State private var selectedLocations: Set<PainLocation> = []
    @State private var selectedQualities: Set<PainQuality> = []
    @State private var selectedSymptoms: Set<Symptom> = []
    @State private var selectedTriggers: Set<Trigger> = []
    @State private var notes: String = ""
    @State private var initialIntensity: Double = 5.0
    @State private var isSaving = false

    var body: some View {
        Form {
            Section("Initial Intensity") {
                VStack {
                    HStack {
                        Text(String(format: "%.0f", initialIntensity))
                            .font(.title2.weight(.bold))
                            .foregroundStyle(PainScale.color(for: initialIntensity))
                        Text(PainScale.label(for: initialIntensity))
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    Slider(value: $initialIntensity, in: 0...10, step: 1)
                        .tint(PainScale.color(for: initialIntensity))
                }
            }

            Section("Pain Locations") {
                PainLocationGrid(selectedLocations: $selectedLocations)
            }

            Section("Pain Qualities") {
                FlowLayout(spacing: 8) {
                    ForEach(PainQuality.allCases) { quality in
                        Toggle(isOn: Binding(
                            get: { selectedQualities.contains(quality) },
                            set: { if $0 { selectedQualities.insert(quality) } else { selectedQualities.remove(quality) } }
                        )) {
                            Text(quality.displayName)
                                .font(.caption)
                        }
                        .toggleStyle(.button)
                        .buttonStyle(.bordered)
                    }
                }
            }

            Section("Symptoms") {
                FlowLayout(spacing: 8) {
                    ForEach(Symptom.allCases) { symptom in
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
                FlowLayout(spacing: 8) {
                    ForEach(Trigger.allCases) { trigger in
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
                    .frame(minHeight: 60)
            }
        }
        .navigationTitle("New Episode")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
                    .accessibilityLabel("Cancel")
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    Task { await saveEpisode() }
                }
                .disabled(isSaving)
                .accessibilityIdentifier("save-episode-button")
                .accessibilityLabel("Save")
            }
        }
    }

    private func saveEpisode() async {
        isSaving = true
        defer { isSaving = false }

        let now = TimestampHelper.now
        let episode = Episode(
            id: UUID().uuidString,
            startTime: now,
            endTime: nil,
            locations: Array(selectedLocations),
            qualities: Array(selectedQualities),
            symptoms: Array(selectedSymptoms),
            triggers: Array(selectedTriggers),
            notes: notes.isEmpty ? nil : notes,
            latitude: nil,
            longitude: nil,
            locationAccuracy: nil,
            locationTimestamp: nil,
            createdAt: now,
            updatedAt: now
        )

        do {
            let repo = EpisodeRepository(dbManager: DatabaseManager.shared)
            try await repo.createEpisode(episode)

            // Create initial intensity reading
            let reading = IntensityReading(
                id: UUID().uuidString,
                episodeId: episode.id,
                timestamp: now,
                intensity: initialIntensity,
                createdAt: now,
                updatedAt: now
            )
            try await repo.createIntensityReading(reading)

            // Cancel today's daily check-in — starting an episode makes it a red day
            let todayStr = DateFormatting.dateString(from: Date())
            let checkinService = DailyCheckinNotificationService(
                notificationService: NotificationService.shared,
                scheduledNotificationRepo: ScheduledNotificationRepository(dbManager: DatabaseManager.shared),
                episodeRepo: repo,
                dailyStatusRepo: DailyStatusRepository(dbManager: DatabaseManager.shared)
            )
            await checkinService.cancelForDate(todayStr)

            dismiss()
        } catch {
            AppLogger.shared.error("Failed to save episode", error: error)
        }
    }
}
