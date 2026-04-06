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
            Section("Initial Pain Intensity") {
                PainIntensitySlider(intensity: $initialIntensity)
            }

            Section("Pain Locations") {
                PainLocationGrid(selectedLocations: $selectedLocations)
            }

            Section("Pain Qualities") {
                FlowLayout(spacing: 8) {
                    ForEach(PainQuality.allCases) { quality in
                        SelectableChip(
                            title: quality.displayName,
                            isSelected: selectedQualities.contains(quality)
                        ) {
                            if selectedQualities.contains(quality) {
                                selectedQualities.remove(quality)
                            } else {
                                selectedQualities.insert(quality)
                            }
                        }
                    }
                }
            }

            Section("Symptoms") {
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

            Section("Possible Triggers") {
                FlowLayout(spacing: 8) {
                    ForEach(Trigger.allCases) { trigger in
                        SelectableChip(
                            title: trigger.displayName,
                            isSelected: selectedTriggers.contains(trigger)
                        ) {
                            if selectedTriggers.contains(trigger) {
                                selectedTriggers.remove(trigger)
                            } else {
                                selectedTriggers.insert(trigger)
                            }
                        }
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
