import Foundation
import Observation

@Observable
final class EpisodesListViewModel {
    // MARK: - State

    var episodes: [Episode] = []
    var readingsMap: [String: [IntensityReading]] = [:]
    var isLoading = false
    var error: String?

    // MARK: - Dependencies

    private let episodeRepository: EpisodeRepositoryProtocol
    private let liveActivityManager: LiveActivityManaging

    // MARK: - Init

    init(
        episodeRepository: EpisodeRepositoryProtocol = EpisodeRepository(dbManager: DatabaseManager.shared),
        liveActivityManager: LiveActivityManaging = LiveActivityManager.shared
    ) {
        self.episodeRepository = episodeRepository
        self.liveActivityManager = liveActivityManager
    }

    // MARK: - Actions

    @MainActor
    func loadEpisodes() async {
        isLoading = true
        error = nil
        do {
            let allEpisodes = try await episodeRepository.getAllEpisodes()
            episodes = allEpisodes.sorted { $0.startTime > $1.startTime }

            let episodeIds = episodes.map(\.id)
            if !episodeIds.isEmpty {
                readingsMap = try await episodeRepository.getIntensityReadings(episodeIds: episodeIds)
            } else {
                readingsMap = [:]
            }
            isLoading = false
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "EpisodesListViewModel"])
            self.error = error.localizedDescription
            isLoading = false
        }
    }

    @MainActor
    func deleteEpisode(_ id: String) async {
        do {
            try await episodeRepository.deleteEpisode(id)
            episodes.removeAll { $0.id == id }
            readingsMap.removeValue(forKey: id)
            // Drop any Live Activity for the now-deleted episode.
            liveActivityManager.dismiss(episodeId: id)
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "EpisodesListViewModel"])
            self.error = error.localizedDescription
        }
    }
}
