import SwiftUI

struct EpisodesScreen: View {
    @State private var viewModel = EpisodesListViewModel()

    var body: some View {
        Group {
            if viewModel.episodes.isEmpty && !viewModel.isLoading {
                ContentUnavailableView(
                    "No Episodes",
                    systemImage: "bolt.heart",
                    description: Text("Start tracking your first migraine episode from the Dashboard.")
                )
            } else {
                List(viewModel.episodes) { episode in
                    NavigationLink {
                        EpisodeDetailScreen(episodeId: episode.id)
                    } label: {
                        EpisodeCardView(episode: episode, readings: viewModel.readingsMap[episode.id] ?? [])
                    }
                    .accessibilityIdentifier("episode-card-\(viewModel.episodes.firstIndex(where: { $0.id == episode.id }) ?? 0)")
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Episodes")
        .accessibilityIdentifier("episodes-screen")
        .task {
            await viewModel.loadEpisodes()
        }
    }
}

struct EpisodeCardView: View {
    let episode: Episode
    let readings: [IntensityReading]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(DateFormatting.relativeDate(episode.startDate))
                    .font(.headline)
                Spacer()
                if episode.isActive {
                    Text("Ongoing")
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.red.opacity(0.2))
                        .foregroundStyle(.red)
                        .clipShape(Capsule())
                }
            }

            if !readings.isEmpty {
                IntensitySparklineView(
                    readings: readings,
                    episodeStartTime: episode.startTime,
                    episodeEndTime: episode.endTime
                )
                    .frame(height: 30)
            }

            HStack {
                Text(DateFormatting.displayTime(episode.startDate))
                    .font(.caption)
                    .foregroundStyle(.secondary)

                if let endDate = episode.endDate {
                    Text("— \(DateFormatting.displayTime(endDate))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                if let duration = episode.durationMillis {
                    Text(DateFormatting.formatDuration(milliseconds: duration))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 4)
    }
}
