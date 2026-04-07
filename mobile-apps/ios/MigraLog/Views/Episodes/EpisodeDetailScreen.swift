import SwiftUI

struct EpisodeDetailScreen: View {
    let episodeId: String
    @State private var viewModel = EpisodeDetailViewModel()
    @State private var showEndTimePicker = false
    @State private var showEditSheet = false
    @State private var showLogUpdate = false
    @State private var customEndTime = Date()

    // Timeline editing state
    @State private var editingReading: IntensityReading?
    @State private var editingSymptomLog: SymptomLog?
    @State private var editingPainLocationLog: PainLocationLog?
    @State private var editingNote: EpisodeNote?
    @State private var showDeleteConfirmation = false
    @State private var pendingDeleteAction: (() async -> Void)?
    @State private var pendingDeleteLabel: String = ""

    var body: some View {
        Group {
            if let details = viewModel.details {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        // Episode summary card
                        episodeSummarySection(details.episode)

                        // Timeline
                        if !details.intensityReadings.isEmpty || !details.symptomLogs.isEmpty || !details.painLocationLogs.isEmpty || !details.episodeNotes.isEmpty || !viewModel.episodeDoses.isEmpty {
                            TimelineView(
                                details: details,
                                viewModel: viewModel,
                                editingReading: $editingReading,
                                editingSymptomLog: $editingSymptomLog,
                                editingPainLocationLog: $editingPainLocationLog,
                                editingNote: $editingNote,
                                showDeleteConfirmation: $showDeleteConfirmation,
                                pendingDeleteAction: $pendingDeleteAction,
                                pendingDeleteLabel: $pendingDeleteLabel,
                                customEndTime: $customEndTime,
                                showEndTimePicker: $showEndTimePicker
                            )
                        }

                        // Actions
                        if details.episode.isActive {
                            EpisodeActionButtons(
                                episode: details.episode,
                                episodeId: episodeId,
                                viewModel: viewModel,
                                showLogUpdate: $showLogUpdate,
                                customEndTime: $customEndTime,
                                showEndTimePicker: $showEndTimePicker
                            )
                        }
                    }
                    .padding()
                }
                .accessibilityIdentifier("episode-detail-scroll")
            } else if viewModel.isLoading {
                ProgressView()
            } else {
                ContentUnavailableView("Episode Not Found", systemImage: "exclamationmark.triangle")
            }
        }
        .navigationTitle("Episode Details")
        .toolbar {
            if viewModel.details?.episode.isActive == true || viewModel.details != nil {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Edit") {
                        showEditSheet = true
                    }
                    .accessibilityIdentifier("edit-episode-button")
                }
            }
        }
        .sheet(isPresented: $showEditSheet) {
            if let details = viewModel.details {
                NavigationStack {
                    EditEpisodeScreen(episode: details.episode, viewModel: viewModel)
                }
            }
        }
        .sheet(isPresented: $showLogUpdate) {
            if let details = viewModel.details {
                NavigationStack {
                    LogUpdateScreen(episodeId: details.episode.id, viewModel: viewModel)
                }
            }
        }
        .sheet(isPresented: $showEndTimePicker) {
            NavigationStack {
                CustomEndTimeSheet(
                    customEndTime: $customEndTime,
                    onConfirm: {
                        Task {
                            await viewModel.endEpisode(
                                episodeId,
                                at: TimestampHelper.fromDate(customEndTime)
                            )
                        }
                        showEndTimePicker = false
                    },
                    onCancel: { showEndTimePicker = false }
                )
            }
        }
        .sheet(item: $editingReading) { reading in
            NavigationStack {
                EditIntensityReadingScreen(reading: reading, viewModel: viewModel)
            }
        }
        .sheet(item: $editingSymptomLog) { log in
            NavigationStack {
                EditSymptomLogScreen(log: log, viewModel: viewModel)
            }
        }
        .sheet(item: $editingPainLocationLog) { log in
            NavigationStack {
                EditPainLocationLogScreen(log: log, viewModel: viewModel)
            }
        }
        .sheet(item: $editingNote) { note in
            NavigationStack {
                EditEpisodeNoteScreen(note: note, viewModel: viewModel)
            }
        }
        .alert("Delete \(pendingDeleteLabel)?", isPresented: $showDeleteConfirmation) {
            Button("Delete", role: .destructive) {
                if let action = pendingDeleteAction {
                    Task { await action() }
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This cannot be undone.")
        }
        .task {
            await viewModel.loadEpisode(episodeId)
        }
    }

    @ViewBuilder
    private func episodeSummarySection(_ episode: Episode) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            // Dates row
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Started")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(DateFormatting.displayDateTime(episode.startDate))
                        .font(.subheadline)
                }

                Spacer()

                if episode.isActive {
                    Text("Ongoing")
                        .font(.caption.weight(.bold))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color.red.opacity(0.2))
                        .foregroundStyle(.red)
                        .clipShape(Capsule())
                } else if let endDate = episode.endDate {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("Ended")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(DateFormatting.displayDateTime(endDate))
                            .font(.subheadline)
                    }
                }
            }

            Divider()

            // Duration
            HStack {
                Text("Duration")
                    .foregroundStyle(.secondary)
                Spacer()
                if let duration = episode.durationMillis {
                    Text(DateFormatting.formatDuration(milliseconds: duration))
                } else {
                    Text(DateFormatting.formatDuration(from: episode.startTime, to: nil))
                }
            }
            .font(.subheadline)

            // Symptoms
            if !episode.symptoms.isEmpty {
                Divider()
                HStack(alignment: .top) {
                    Text("Symptoms")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Spacer()
                    FlowLayout(spacing: 4) {
                        ForEach(episode.symptoms) { symptom in
                            Text(symptom.displayName)
                                .font(.caption)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color.purple.opacity(0.1))
                                .clipShape(Capsule())
                        }
                    }
                }
            }

            // Triggers
            if !episode.triggers.isEmpty {
                Divider()
                HStack(alignment: .top) {
                    Text("Triggers")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Spacer()
                    FlowLayout(spacing: 4) {
                        ForEach(episode.triggers) { trigger in
                            Text(trigger.displayName)
                                .font(.caption)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color.orange.opacity(0.1))
                                .clipShape(Capsule())
                        }
                    }
                }
            }

            // Notes
            if let notes = episode.notes, !notes.isEmpty {
                Divider()
                VStack(alignment: .leading, spacing: 2) {
                    Text("Notes")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Text(notes)
                        .font(.subheadline)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Flow Layout

struct FlowLayout: Layout {
    var spacing: CGFloat = 4

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = layout(proposal: proposal, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = layout(proposal: proposal, subviews: subviews)
        for (index, position) in result.positions.enumerated() {
            subviews[index].place(at: CGPoint(x: bounds.minX + position.x, y: bounds.minY + position.y), proposal: .unspecified)
        }
    }

    private func layout(proposal: ProposedViewSize, subviews: Subviews) -> (size: CGSize, positions: [CGPoint]) {
        let maxWidth = proposal.width ?? .infinity
        var positions: [CGPoint] = []
        var currentX: CGFloat = 0
        var currentY: CGFloat = 0
        var lineHeight: CGFloat = 0
        var maxX: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if currentX + size.width > maxWidth && currentX > 0 {
                currentX = 0
                currentY += lineHeight + spacing
                lineHeight = 0
            }
            positions.append(CGPoint(x: currentX, y: currentY))
            lineHeight = max(lineHeight, size.height)
            currentX += size.width + spacing
            maxX = max(maxX, currentX)
        }

        return (CGSize(width: maxX, height: currentY + lineHeight), positions)
    }
}
