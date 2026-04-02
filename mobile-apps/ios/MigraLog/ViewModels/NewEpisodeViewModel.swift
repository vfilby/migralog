import Foundation
import Observation

@Observable
final class NewEpisodeViewModel {
    // MARK: - State

    var selectedLocations: Set<PainLocation> = []
    var selectedQualities: Set<PainQuality> = []
    var selectedSymptoms: Set<Symptom> = []
    var selectedTriggers: Set<Trigger> = []
    var notes: String = ""
    var initialIntensity: Double = 5.0
    var isSaving = false
    var error: String?

    // MARK: - Dependencies

    private let episodeRepository: EpisodeRepositoryProtocol

    // MARK: - Init

    init(episodeRepository: EpisodeRepositoryProtocol = EpisodeRepository(dbManager: DatabaseManager.shared)) {
        self.episodeRepository = episodeRepository
    }

    // MARK: - Computed

    var isValid: Bool {
        // An episode needs at least a non-zero intensity
        initialIntensity > 0
    }

    // MARK: - Actions

    @MainActor
    func saveEpisode() async -> Episode? {
        guard isValid else { return nil }
        isSaving = true
        error = nil

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
            let saved = try await episodeRepository.createEpisode(episode)

            // Create the initial intensity reading
            let reading = IntensityReading(
                id: UUID().uuidString,
                episodeId: saved.id,
                timestamp: now,
                intensity: initialIntensity,
                createdAt: now,
                updatedAt: now
            )
            _ = try await episodeRepository.createIntensityReading(reading)

            isSaving = false
            return saved
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "NewEpisodeViewModel"])
            self.error = error.localizedDescription
            isSaving = false
            return nil
        }
    }

    func reset() {
        selectedLocations = []
        selectedQualities = []
        selectedSymptoms = []
        selectedTriggers = []
        notes = ""
        initialIntensity = 5.0
        error = nil
    }
}
