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
                    LazyVStack(spacing: DesignTokens.Spacing.md) {
                        ForEach(viewModel.episodes) { episode in
                            // Value-based link so taps drive the same path binding
                            // (selectedEpisodeId) that deep links use — one nav system.
                            NavigationLink(value: episode.id) {
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
        HStack(alignment: .center, spacing: DesignTokens.Spacing.md) {
            // Left side: text info
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                HStack {
                    Text(DateFormatting.relativeDate(episode.startDate))
                        .font(.headline)
                    if episode.isActive {
                        Text("Ongoing")
                            .font(.caption)
                            .padding(.horizontal, DesignTokens.Spacing.sm)
                            .padding(.vertical, DesignTokens.Spacing.xs)
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
                    episodeEnd: episode.endTime,
                    postdromeStart: episode.postdromeStartTime
                )
                .frame(width: 160, height: 50)
                .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.sm))
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.lg))
    }
}

// MARK: - iPad Content Column

/// Plain list row for Episodes iPad list column.
/// No card background — relies on List's native selection highlight for visual feedback.
struct EpisodeListRowView: View {
    let episode: Episode
    let readings: [IntensityReading]

    var body: some View {
        HStack(alignment: .center, spacing: DesignTokens.Spacing.md) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                HStack {
                    Text(DateFormatting.relativeDate(episode.startDate))
                        .font(.headline)
                    if episode.isActive {
                        // Tint over an opaque base so the pill keeps its
                        // color identity on the selection highlight.
                        Text("Ongoing")
                            .font(.caption)
                            .padding(.horizontal, DesignTokens.Spacing.sm)
                            .padding(.vertical, DesignTokens.Spacing.xs)
                            .background(Color.red.opacity(0.2))
                            .background(Color(.systemBackground))
                            .foregroundStyle(.red)
                            .clipShape(Capsule())
                    }
                }

                if episode.latitude != nil {
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

            if !readings.isEmpty {
                IntensitySparklineView(
                    readings: readings,
                    episodeStart: episode.startTime,
                    episodeEnd: episode.endTime,
                    postdromeStart: episode.postdromeStartTime
                )
                .frame(width: 140, height: 44)
                .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.sm))
            }
        }
        .padding(.vertical, DesignTokens.Spacing.xs)
    }
}

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
                    EpisodeListRowView(
                        episode: episode,
                        readings: viewModel.readingsMap[episode.id] ?? []
                    )
                    .tag(episode.id)
                }
                .listStyle(.insetGrouped)
            }
        }
        .navigationTitle("Episodes")
        .task {
            await viewModel.loadEpisodes()
        }
    }
}
