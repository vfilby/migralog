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
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(viewModel.episodes) { episode in
                            NavigationLink {
                                EpisodeDetailScreen(episodeId: episode.id)
                            } label: {
                                EpisodeCardView(episode: episode, readings: viewModel.readingsMap[episode.id] ?? [])
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("episode-card-\(viewModel.episodes.firstIndex(where: { $0.id == episode.id }) ?? 0)")
                        }
                    }
                    .padding()
                }
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
        HStack(alignment: .center, spacing: 12) {
            // Left side: text info
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(DateFormatting.relativeDate(episode.startDate))
                        .font(.headline)
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

                if episode.latitude != nil {
                    // Location was recorded (reverse geocoding TBD)
                    Label("Location recorded", systemImage: "location.fill")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
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
                }

                if let duration = episode.durationMillis {
                    Text(DateFormatting.formatDuration(milliseconds: duration))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                } else {
                    Text(DateFormatting.formatDuration(from: episode.startTime, to: nil))
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }

            Spacer(minLength: 8)

            // Right side: sparkline (fixed width)
            if !readings.isEmpty {
                IntensitySparklineView(
                    readings: readings,
                    episodeStart: episode.startTime,
                    episodeEnd: episode.endTime
                )
                .frame(width: 160, height: 50)
                .clipShape(RoundedRectangle(cornerRadius: 4))
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - iPad Content Column

/// Episodes list adapted for the iPad content column.
/// Uses selection binding instead of NavigationLink destination push.
struct EpisodesListColumn: View {
    @Binding var selectedEpisodeId: String?
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
                List(viewModel.episodes, selection: $selectedEpisodeId) { episode in
                    EpisodeCardView(
                        episode: episode,
                        readings: viewModel.readingsMap[episode.id] ?? []
                    )
                    .tag(episode.id)
                    .listRowInsets(EdgeInsets(top: 4, leading: 8, bottom: 4, trailing: 8))
                }
                .listStyle(.plain)
            }
        }
        .navigationTitle("Episodes")
        .task {
            await viewModel.loadEpisodes()
        }
    }
}
