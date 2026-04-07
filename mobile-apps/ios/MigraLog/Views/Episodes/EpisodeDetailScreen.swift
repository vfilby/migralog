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
                            timelineSection(details)
                        }

                        // Actions
                        if details.episode.isActive {
                            actionButtons(details.episode)
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

    @ViewBuilder
    private func timelineSection(_ details: EpisodeWithDetails) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Timeline")
                .font(.headline)

            // Sparkline
            if !details.intensityReadings.isEmpty {
                IntensitySparklineView(
                    readings: details.intensityReadings,
                    episodeStart: details.episode.startTime,
                    episodeEnd: details.episode.endTime
                )
                .frame(height: 80)
                .clipShape(RoundedRectangle(cornerRadius: 4))
                .padding(.bottom, 4)
            }

            // Merge all events into a chronological timeline
            let events = buildTimelineEvents(from: details)

            ForEach(Array(events.enumerated()), id: \.element.id) { index, event in
                let isLast = index == events.count - 1
                let isEpisodeEnd = event.kind.isEpisodeEnded
                let showLineBelow = !isLast && !isEpisodeEnd

                VStack(spacing: 0) {
                    // Top row: time, dot, title — all vertically centered
                    HStack(spacing: 0) {
                        Text(DateFormatting.displayTime(event.date))
                            .font(.subheadline.monospacedDigit())
                            .foregroundStyle(.secondary)
                            .frame(width: 75, alignment: .trailing)

                        timelineDot(for: event)
                            .frame(width: 32)

                        timelineTitle(for: event)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    // Detail content + line below dot
                    HStack(alignment: .top, spacing: 0) {
                        // Spacer for time column
                        Color.clear
                            .frame(width: 75)

                        // Vertical line below the dot
                        Rectangle()
                            .fill(showLineBelow ? Color.secondary.opacity(0.2) : .clear)
                            .frame(width: 1)
                            .frame(maxHeight: .infinity)
                            .frame(width: 32)

                        // Detail content (bar, chips, subtitle, etc.)
                        timelineDetail(for: event)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(.vertical, 6)
                .contextMenu { timelineContextMenu(for: event) }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func buildTimelineEvents(from details: EpisodeWithDetails) -> [TimelineEvent] {
        var events: [TimelineEvent] = []

        for reading in details.intensityReadings {
            events.append(TimelineEvent(
                id: "intensity-\(reading.id)",
                timestamp: reading.timestamp,
                kind: .intensity(reading)
            ))
        }

        for log in details.symptomLogs {
            events.append(TimelineEvent(
                id: "symptom-onset-\(log.id)",
                timestamp: log.onsetTime,
                kind: .symptomOnset(log)
            ))
            if let resolution = log.resolutionTime {
                events.append(TimelineEvent(
                    id: "symptom-resolved-\(log.id)",
                    timestamp: resolution,
                    kind: .symptomResolved(log)
                ))
            }
        }

        // Initial pain locations from the episode itself
        let initialLocations = details.episode.locations
        var previousLocations: Set<PainLocation> = Set(initialLocations)
        if !initialLocations.isEmpty {
            let initialDelta = PainLocationDelta(
                added: [], removed: [], unchanged: initialLocations, isInitial: true
            )
            // Use a synthetic PainLocationLog for the initial entry
            let initialLog = PainLocationLog(
                id: "initial-pain-locations",
                episodeId: details.episode.id,
                timestamp: details.episode.startTime,
                painLocations: initialLocations,
                createdAt: details.episode.createdAt,
                updatedAt: details.episode.updatedAt
            )
            events.append(TimelineEvent(
                id: "pain-location-initial",
                timestamp: details.episode.startTime,
                kind: .painLocation(initialLog, initialDelta)
            ))
        }

        // Subsequent pain location logs — always computed as changes
        let sortedPainLogs = details.painLocationLogs.sorted { $0.timestamp < $1.timestamp }
        for log in sortedPainLogs {
            let currentSet = Set(log.painLocations)
            let added = log.painLocations.filter { !previousLocations.contains($0) }
            let removed = Array(previousLocations.subtracting(currentSet))
            let unchanged = log.painLocations.filter { previousLocations.contains($0) }
            let delta = PainLocationDelta(added: added, removed: removed, unchanged: unchanged, isInitial: false)
            previousLocations = currentSet
            events.append(TimelineEvent(
                id: "pain-location-\(log.id)",
                timestamp: log.timestamp,
                kind: .painLocation(log, delta)
            ))
        }

        for note in details.episodeNotes {
            events.append(TimelineEvent(
                id: "note-\(note.id)",
                timestamp: note.timestamp,
                kind: .note(note)
            ))
        }

        // Medication doses during the episode (exclude preventative — only rescue/other)
        for doseWithMed in viewModel.episodeDoses where doseWithMed.medication.type != .preventative {
            events.append(TimelineEvent(
                id: "medication-\(doseWithMed.dose.id)",
                timestamp: doseWithMed.dose.timestamp,
                kind: .medication(doseWithMed)
            ))
        }

        // Episode ended event
        if let endTime = details.episode.endTime {
            events.append(TimelineEvent(
                id: "episode-ended",
                timestamp: endTime,
                kind: .episodeEnded
            ))
        }

        events.sort { $0.timestamp < $1.timestamp }
        return events
    }

    @ViewBuilder
    private func timelineDot(for event: TimelineEvent) -> some View {
        let color: Color = switch event.kind {
        case .intensity(let reading): PainScale.color(for: reading.intensity)
        case .symptomOnset, .symptomResolved: .purple
        case .painLocation(_, _): .secondary
        case .note: .secondary
        case .medication: .secondary
        case .episodeEnded: .secondary
        }
        Circle()
            .fill(color)
            .frame(width: 12, height: 12)
    }

    /// First line of the timeline event — displayed inline with the dot and timestamp.
    /// Always bold and primary color for consistency.
    @ViewBuilder
    private func timelineTitle(for event: TimelineEvent) -> some View {
        let title: String = switch event.kind {
        case .intensity: "Intensity Update"
        case .symptomOnset(let log): "\(log.symptom.displayName) — onset"
        case .symptomResolved(let log): "\(log.symptom.displayName) — resolved"
        case .painLocation(_, let delta): delta.isInitial ? "Initial Pain Locations" : "Pain Location Changes"
        case .note: "Note"
        case .medication(let d): d.dose.status == .taken ? "Medication Taken" : "Medication Skipped"
        case .episodeEnded: "Episode Ended"
        }
        Text(title)
            .font(.subheadline.weight(.medium))
    }

    /// Detail content below the title line
    @ViewBuilder
    private func timelineDetail(for event: TimelineEvent) -> some View {
        switch event.kind {
        case .intensity(let reading):
            let intensityColor = PainScale.color(for: reading.intensity)
            VStack(alignment: .leading, spacing: 4) {
                // Intensity bar
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Color(.systemGray4))
                            .frame(height: 22)
                        Capsule()
                            .fill(intensityColor)
                            .frame(width: max(22, geo.size.width * CGFloat(reading.intensity / 10.0)), height: 22)
                    }
                }
                .frame(height: 22)

                Text("\(Int(reading.intensity)) - \(PainScale.label(for: reading.intensity))")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(intensityColor)
            }
            .padding(.top, 4)

        case .symptomOnset, .symptomResolved:
            EmptyView()

        case .painLocation(_, let delta):
            FlowLayout(spacing: 6) {
                // Added locations — light bg, green text, green border
                ForEach(delta.added) { location in
                    Text("+ \(location.displayName)")
                        .font(.caption.weight(.medium))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .foregroundStyle(Color(hex: "#2E7D32"))
                        .background(Color(hex: "#E8F5E9"))
                        .clipShape(Capsule())
                        .overlay(Capsule().stroke(Color(hex: "#66BB6A"), lineWidth: 1))
                }
                // Removed locations — light bg, red text
                ForEach(delta.removed) { location in
                    Text("− \(location.displayName)")
                        .font(.caption.weight(.medium))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .foregroundStyle(Color(hex: "#C62828"))
                        .background(Color(hex: "#FFEBEE"))
                        .clipShape(Capsule())
                        .overlay(Capsule().stroke(Color(hex: "#FFCDD2"), lineWidth: 1))
                }
                // Unchanged locations (neutral gray)
                ForEach(delta.unchanged) { location in
                    Text(location.displayName)
                        .font(.caption)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Color(.systemGray5))
                        .clipShape(Capsule())
                }
            }
            .padding(.top, 4)

        case .note(let note):
            Text(note.note)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(3)
                .padding(.top, 2)

        case .medication(let doseWithMed):
            Text("\(doseWithMed.medication.name) • \(MedicationFormatting.formatDose(quantity: doseWithMed.dose.quantity, amount: doseWithMed.dose.dosageAmount ?? doseWithMed.medication.dosageAmount, unit: doseWithMed.dose.dosageUnit ?? doseWithMed.medication.dosageUnit))")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .padding(.top, 2)

        case .episodeEnded:
            EmptyView()
        }
    }

    // MARK: - Context Menus

    @ViewBuilder
    private func timelineContextMenu(for event: TimelineEvent) -> some View {
        switch event.kind {
        case .intensity(let reading):
            Button { editingReading = reading } label: {
                Label("Edit Intensity", systemImage: "pencil")
            }
            Button(role: .destructive) {
                pendingDeleteLabel = "intensity reading"
                pendingDeleteAction = { await viewModel.deleteReading(reading.id) }
                showDeleteConfirmation = true
            } label: {
                Label("Delete", systemImage: "trash")
            }

        case .symptomOnset(let log), .symptomResolved(let log):
            Button { editingSymptomLog = log } label: {
                Label("Edit Symptom", systemImage: "pencil")
            }
            Button(role: .destructive) {
                pendingDeleteLabel = "symptom log"
                pendingDeleteAction = { await viewModel.deleteSymptomLog(log.id) }
                showDeleteConfirmation = true
            } label: {
                Label("Delete", systemImage: "trash")
            }

        case .painLocation(let log, let delta):
            if !delta.isInitial {
                Button { editingPainLocationLog = log } label: {
                    Label("Edit Pain Locations", systemImage: "pencil")
                }
                Button(role: .destructive) {
                    pendingDeleteLabel = "pain location log"
                    pendingDeleteAction = { await viewModel.deletePainLocationLog(log.id) }
                    showDeleteConfirmation = true
                } label: {
                    Label("Delete", systemImage: "trash")
                }
            }

        case .note(let note):
            Button { editingNote = note } label: {
                Label("Edit Note", systemImage: "pencil")
            }
            Button(role: .destructive) {
                pendingDeleteLabel = "note"
                pendingDeleteAction = { await viewModel.deleteNote(note.id) }
                showDeleteConfirmation = true
            } label: {
                Label("Delete", systemImage: "trash")
            }

        case .medication:
            // Dose editing handled via medication detail screen
            EmptyView()

        case .episodeEnded:
            Button {
                if let endTime = viewModel.episode?.endTime {
                    customEndTime = Date(timeIntervalSince1970: Double(endTime) / 1000.0)
                }
                showEndTimePicker = true
            } label: {
                Label("Edit End Time", systemImage: "clock")
            }
            Button {
                Task { await viewModel.reopenEpisode() }
            } label: {
                Label("Reopen Episode", systemImage: "arrow.uturn.backward")
            }
        }
    }

    @ViewBuilder
    private func actionButtons(_ episode: Episode) -> some View {
        VStack(spacing: 8) {
            Button {
                showLogUpdate = true
            } label: {
                Label("Log Update", systemImage: "plus.circle")
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.blue.opacity(0.1))
                    .foregroundStyle(.blue)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .accessibilityIdentifier("log-update-button")

            HStack(spacing: 8) {
                Button {
                    Task {
                        await viewModel.endEpisode(episodeId, at: TimestampHelper.now)
                    }
                } label: {
                    Text("End Now")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.red.opacity(0.1))
                        .foregroundStyle(.red)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .accessibilityIdentifier("end-now-button")

                Button {
                    customEndTime = Date()
                    showEndTimePicker = true
                } label: {
                    Text("End...")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.orange.opacity(0.1))
                        .foregroundStyle(.orange)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .accessibilityIdentifier("end-custom-button")
            }
        }
    }
}

// MARK: - Timeline Event

struct TimelineEvent: Identifiable {
    let id: String
    let timestamp: Int64
    let kind: Kind

    var date: Date {
        Date(timeIntervalSince1970: Double(timestamp) / 1000.0)
    }

    enum Kind {
        case intensity(IntensityReading)
        case symptomOnset(SymptomLog)
        case symptomResolved(SymptomLog)
        case painLocation(PainLocationLog, PainLocationDelta)
        case note(EpisodeNote)
        case medication(DoseWithMedication)
        case episodeEnded

        var isEpisodeEnded: Bool {
            if case .episodeEnded = self { return true }
            return false
        }
    }
}

/// Represents changes in pain locations between timeline entries
struct PainLocationDelta {
    let added: [PainLocation]
    let removed: [PainLocation]
    let unchanged: [PainLocation]
    /// True if this is the first pain location log (all locations are "initial", shown as neutral)
    let isInitial: Bool
}

// MARK: - Custom End Time Sheet

struct CustomEndTimeSheet: View {
    @Binding var customEndTime: Date
    let onConfirm: () -> Void
    let onCancel: () -> Void

    var body: some View {
        VStack {
            DatePicker("End Time", selection: $customEndTime)
                .datePickerStyle(.wheel)

            HStack {
                Button("Cancel", action: onCancel)
                    .buttonStyle(.bordered)
                Spacer()
                Button("Confirm", action: onConfirm)
                    .buttonStyle(.borderedProminent)
            }
            .padding()
        }
        .navigationTitle("Custom End Time")
        .navigationBarTitleDisplayMode(.inline)
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

// MARK: - Intensity Sparkline

struct IntensitySparklineView: View {
    let readings: [IntensityReading]
    /// Episode start time — chart X axis starts here
    var episodeStart: Int64?
    /// Episode end time (nil for ongoing — uses current time)
    var episodeEnd: Int64?

    /// Pain scale gradient colors from 0 (green) to 10 (purple)
    private static let gradientColors: [Color] = [
        Color(hex: "#2E7D32"), // 0 - Dark Green
        Color(hex: "#558B2F"), // 1
        Color(hex: "#689F38"), // 2
        Color(hex: "#F9A825"), // 3
        Color(hex: "#FF8F00"), // 4
        Color(hex: "#EF6C00"), // 5
        Color(hex: "#E65100"), // 6
        Color(hex: "#D84315"), // 7
        Color(hex: "#C62828"), // 8
        Color(hex: "#EC407A"), // 9
        Color(hex: "#AB47BC"), // 10
    ]

    var body: some View {
        GeometryReader { geo in
            let sorted = readings
                .filter { $0.intensity >= 0 }
                .sorted { $0.timestamp < $1.timestamp }

            if !sorted.isEmpty {
                let startT = episodeStart ?? sorted.first!.timestamp
                let endT = episodeEnd ?? Int64(Date().timeIntervalSince1970 * 1000)
                let timeRange = max(Double(endT - startT), 1)
                let padding: CGFloat = 4
                let chartW = geo.size.width - padding * 2
                let chartH = geo.size.height - padding * 2

                // Background gradient (green at bottom, purple at top)
                RoundedRectangle(cornerRadius: 4)
                    .fill(
                        LinearGradient(
                            colors: Self.gradientColors.map { $0.opacity(0.15) },
                            startPoint: .bottom,
                            endPoint: .top
                        )
                    )

                // Sample-and-hold step function line
                Path { path in
                    for (i, reading) in sorted.enumerated() {
                        let x = padding + chartW * CGFloat(Double(reading.timestamp - startT) / timeRange)
                        let y = padding + chartH * (1 - CGFloat(reading.intensity / 10.0))
                        if i == 0 {
                            path.move(to: CGPoint(x: x, y: y))
                        } else {
                            // Horizontal segment at previous intensity, then vertical jump
                            path.addLine(to: CGPoint(x: x, y: path.currentPoint?.y ?? y))
                            path.addLine(to: CGPoint(x: x, y: y))
                        }
                    }
                    // Hold last value to end of episode
                    if let lastY = path.currentPoint?.y {
                        let endX = padding + chartW
                        path.addLine(to: CGPoint(x: endX, y: lastY))
                    }
                }
                .stroke(
                    LinearGradient(
                        colors: Self.gradientColors,
                        startPoint: .bottom,
                        endPoint: .top
                    ),
                    style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round)
                )

                // Reading dots
                ForEach(sorted) { reading in
                    let x = padding + chartW * CGFloat(Double(reading.timestamp - startT) / timeRange)
                    let y = padding + chartH * (1 - CGFloat(reading.intensity / 10.0))
                    Circle()
                        .fill(PainScale.color(for: reading.intensity))
                        .overlay(Circle().stroke(Color.white, lineWidth: 1.5))
                        .frame(width: 7, height: 7)
                        .position(x: x, y: y)
                }
            }
        }
    }

    /// Sample-and-hold interpolation at fixed intervals
}
