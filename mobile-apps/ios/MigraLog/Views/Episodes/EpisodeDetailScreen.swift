import SwiftUI

struct EpisodeDetailScreen: View {
    let episodeId: String
    /// Whether this instance should consume Live Activity deep-link actions
    /// (`pendingEpisodeAction`). Only the Episodes-tab instances set this true so
    /// a same-episode detail alive in another tab can't steal the action. See #416.
    var consumesDeepLinks: Bool = false
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel = EpisodeDetailViewModel()
    @State private var showEndTimePicker = false
    @State private var showEditSheet = false
    @State private var showLogUpdate = false
    @State private var showLogMedication = false
    @State private var showEndConfirm = false
    @State private var customEndTime = Date()

    // Timeline editing state
    @State private var editingReading: IntensityReading?
    @State private var editingSymptomLog: SymptomLog?
    @State private var editingPainLocationLog: PainLocationLog?
    @State private var editingNote: EpisodeNote?
    @State private var editingDose: DoseWithMedication?
    @State private var showDeleteConfirmation = false
    @State private var pendingDeleteAction: (() async -> Void)?
    @State private var pendingDeleteLabel: String = ""

    var body: some View {
        Group {
            if let details = viewModel.details {
                // Wide iPad panes show the summary and timeline side by side;
                // narrow widths (iPhone / compact panes) keep the single column.
                AdaptiveDetailLayout {
                    // Episode summary card
                    episodeSummarySection(details.episode)
                } secondary: {
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
                            showEndTimePicker: $showEndTimePicker,
                            editingDose: $editingDose,
                            showEditEpisodeSheet: $showEditSheet
                        )
                    }
                } footer: {
                    // Actions span the full width below the columns
                    VStack(spacing: 12) {
                        if details.episode.isActive {
                            EpisodeActionButtons(
                                episode: details.episode,
                                episodeId: episodeId,
                                viewModel: viewModel,
                                showLogUpdate: $showLogUpdate,
                                showLogMedication: $showLogMedication,
                                customEndTime: $customEndTime,
                                showEndTimePicker: $showEndTimePicker
                            )
                        }

                        // Discard an episode entirely (e.g. started by accident).
                        // Available whether it's still active or already ended.
                        Button {
                            pendingDeleteLabel = "Episode"
                            pendingDeleteAction = {
                                await viewModel.deleteEpisode()
                                // Clearing the selection pops the iPhone detail
                                // (path binding) and empties the iPad detail
                                // column; dismiss() covers plain pushes from
                                // Dashboard / Daily Status.
                                appState.selectedEpisodeId = nil
                                dismiss()
                            }
                            showDeleteConfirmation = true
                        } label: {
                            Label("Delete Episode", systemImage: "trash")
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Color.red.opacity(0.1))
                                .foregroundStyle(.red)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                        .accessibilityIdentifier("delete-episode-button")
                    }
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
        .sheet(isPresented: $showLogMedication, onDismiss: {
            Task { await viewModel.loadEpisode(episodeId) }
        }) {
            NavigationStack {
                LogMedicationScreen()
            }
        }
        .sheet(isPresented: $showEndTimePicker) {
            NavigationStack {
                CustomEndTimeSheet(
                    customEndTime: $customEndTime,
                    minimumDate: viewModel.episode?.startDate,
                    onConfirm: {
                        Task {
                            let timestamp = TimestampHelper.fromDate(customEndTime)
                            if viewModel.episode?.isActive == true {
                                await viewModel.endEpisode(
                                    episodeId,
                                    at: timestamp
                                )
                            } else {
                                await viewModel.editEndTime(timestamp)
                            }
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
        .sheet(item: $editingDose) { doseWithMed in
            NavigationStack {
                EditDoseFromTimelineScreen(
                    dose: doseWithMed.dose,
                    medication: doseWithMed.medication,
                    viewModel: viewModel
                )
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
        .confirmationDialog("End this episode?", isPresented: $showEndConfirm, titleVisibility: .visible) {
            Button("End Episode", role: .destructive) {
                Task { await viewModel.endEpisode(episodeId, at: TimestampHelper.now) }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This marks the episode as ended now.")
        }
        .task(id: episodeId) {
            await viewModel.loadEpisode(episodeId)
            // If a deep link targeted an episode that no longer exists, clear the
            // queued action so it can't linger and fire on an unrelated screen.
            if consumesDeepLinks, viewModel.details == nil {
                appState.pendingEpisodeAction = nil
            }
        }
        // A Live Activity deep link may queue a surface to present. Fire it once the
        // episode is loaded, and again if a new link arrives while we're on screen.
        .onChange(of: viewModel.details?.episode.id) { _, _ in consumePendingAction() }
        .onChange(of: appState.pendingEpisodeAction) { _, _ in consumePendingAction() }
    }

    /// Present the surface a deep link requested, then clear the request so it
    /// doesn't re-fire. Only the Episodes-tab instance acts (`consumesDeepLinks`),
    /// and only when the loaded episode matches this screen.
    private func consumePendingAction() {
        guard consumesDeepLinks,
              let action = appState.pendingEpisodeAction,
              let episode = viewModel.details?.episode,
              episode.id == episodeId else { return }
        appState.pendingEpisodeAction = nil
        switch action {
        case .logMedication:
            showLogMedication = true
        case .logIntensity:
            showLogUpdate = true
        case .endConfirm:
            // Only offer to end an episode that is still active — matches the in-app
            // End buttons, which only render for an active episode.
            if episode.isActive { showEndConfirm = true }
        }
    }

    @ViewBuilder
    private func episodeSummarySection(_ episode: Episode) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
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

                if episode.isInPostdrome {
                    Text("Post-drome")
                        .font(.caption.weight(.bold))
                        .padding(.horizontal, DesignTokens.Spacing.md)
                        .padding(.vertical, 6)
                        .background(Color.indigo.opacity(0.2))
                        .foregroundStyle(.indigo)
                        .clipShape(Capsule())
                } else if episode.isActive {
                    Text("Ongoing")
                        .font(.caption.weight(.bold))
                        .padding(.horizontal, DesignTokens.Spacing.md)
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

            // Beta post-drome tracking: when the attack transitioned into a
            // post-drome phase, show when. Rendered for ended episodes too so
            // the phase remains visible in history.
            if let postdromeStart = episode.postdromeStartDate {
                HStack {
                    Text("Post-drome since")
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text(DateFormatting.displayDateTime(postdromeStart))
                }
                .font(.subheadline)
            }

            // Symptoms
            if !episode.symptoms.isEmpty {
                Divider()
                HStack(alignment: .top) {
                    Text("Symptoms")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Spacer()
                    FlowLayout(spacing: DesignTokens.Spacing.xs) {
                        ForEach(episode.symptoms) { symptom in
                            Text(symptom.displayName)
                                .font(.caption)
                                .padding(.horizontal, DesignTokens.Spacing.sm)
                                .padding(.vertical, DesignTokens.Spacing.xs)
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
                    FlowLayout(spacing: DesignTokens.Spacing.xs) {
                        ForEach(episode.triggers) { trigger in
                            Text(trigger.displayName)
                                .font(.caption)
                                .padding(.horizontal, DesignTokens.Spacing.sm)
                                .padding(.vertical, DesignTokens.Spacing.xs)
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
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.lg))
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
