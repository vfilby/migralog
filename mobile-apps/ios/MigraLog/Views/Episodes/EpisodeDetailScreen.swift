import SwiftUI

struct EpisodeDetailScreen: View {
    let episodeId: String
    @State private var viewModel = EpisodeDetailViewModel()
    @State private var showEndTimePicker = false
    @State private var showEditSheet = false
    @State private var showLogUpdate = false
    @State private var customEndTime = Date()

    var body: some View {
        Group {
            if let details = viewModel.details {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        // Status card
                        episodeStatusSection(details.episode)

                        // Info cards
                        episodeInfoSection(details.episode)

                        // Timeline
                        if !details.intensityReadings.isEmpty || !details.symptomLogs.isEmpty || !details.painLocationLogs.isEmpty || !details.episodeNotes.isEmpty {
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
        .task {
            await viewModel.loadEpisode(episodeId)
        }
    }

    @ViewBuilder
    private func episodeStatusSection(_ episode: Episode) -> some View {
        HStack {
            VStack(alignment: .leading) {
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
                VStack(alignment: .trailing) {
                    Text("Ended")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(DateFormatting.displayDateTime(endDate))
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
    private func episodeInfoSection(_ episode: Episode) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            if !episode.locations.isEmpty {
                LabeledContent("Pain Locations") {
                    FlowLayout(spacing: 4) {
                        ForEach(episode.locations) { location in
                            Text(location.displayName)
                                .font(.caption)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Color.blue.opacity(0.1))
                                .clipShape(Capsule())
                        }
                    }
                }
            }

            if !episode.symptoms.isEmpty {
                LabeledContent("Symptoms") {
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

            if !episode.triggers.isEmpty {
                LabeledContent("Triggers") {
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

            if let notes = episode.notes, !notes.isEmpty {
                LabeledContent("Notes") {
                    Text(notes)
                        .font(.subheadline)
                }
            }

            if let duration = episode.durationMillis {
                LabeledContent("Duration") {
                    Text(DateFormatting.formatDuration(milliseconds: duration))
                }
            } else {
                LabeledContent("Duration") {
                    Text(DateFormatting.formatDuration(from: episode.startTime, to: nil))
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
        VStack(alignment: .leading, spacing: 8) {
            Text("Timeline")
                .font(.headline)

            // Sparkline
            if !details.intensityReadings.isEmpty {
                IntensitySparklineView(readings: details.intensityReadings)
                    .frame(height: 80)
            }

            // Merge all events into a chronological timeline
            let events = buildTimelineEvents(from: details)

            ForEach(Array(events.enumerated()), id: \.element.id) { index, event in
                HStack(alignment: .top, spacing: 12) {
                    // Vertical timeline line + icon
                    VStack(spacing: 0) {
                        if index > 0 {
                            Rectangle()
                                .fill(Color.secondary.opacity(0.3))
                                .frame(width: 2, height: 8)
                        }
                        timelineIcon(for: event)
                        if index < events.count - 1 {
                            Rectangle()
                                .fill(Color.secondary.opacity(0.3))
                                .frame(width: 2)
                                .frame(maxHeight: .infinity)
                        }
                    }
                    .frame(width: 20)

                    // Timestamp
                    Text(DateFormatting.displayTime(event.date))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(width: 60, alignment: .leading)

                    // Description
                    timelineDescription(for: event)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.vertical, 2)
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

        for log in details.painLocationLogs {
            events.append(TimelineEvent(
                id: "pain-location-\(log.id)",
                timestamp: log.timestamp,
                kind: .painLocation(log)
            ))
        }

        for note in details.episodeNotes {
            events.append(TimelineEvent(
                id: "note-\(note.id)",
                timestamp: note.timestamp,
                kind: .note(note)
            ))
        }

        events.sort { $0.timestamp < $1.timestamp }
        return events
    }

    @ViewBuilder
    private func timelineIcon(for event: TimelineEvent) -> some View {
        switch event.kind {
        case .intensity(let reading):
            Circle()
                .fill(PainScale.color(for: reading.intensity))
                .frame(width: 12, height: 12)
        case .symptomOnset, .symptomResolved:
            Image(systemName: "allergens")
                .font(.system(size: 10))
                .foregroundStyle(.purple)
                .frame(width: 12, height: 12)
        case .painLocation:
            Image(systemName: "mappin.circle.fill")
                .font(.system(size: 10))
                .foregroundStyle(.blue)
                .frame(width: 12, height: 12)
        case .note:
            Image(systemName: "note.text")
                .font(.system(size: 10))
                .foregroundStyle(.secondary)
                .frame(width: 12, height: 12)
        }
    }

    @ViewBuilder
    private func timelineDescription(for event: TimelineEvent) -> some View {
        switch event.kind {
        case .intensity(let reading):
            HStack {
                Text("Intensity")
                    .font(.caption)
                Spacer()
                Text(String(format: "%.1f", reading.intensity))
                    .font(.caption.weight(.bold))
                    .foregroundStyle(PainScale.color(for: reading.intensity))
            }
        case .symptomOnset(let log):
            Text("\(log.symptom.displayName) — onset")
                .font(.caption)
                .foregroundStyle(.purple)
        case .symptomResolved(let log):
            Text("\(log.symptom.displayName) — resolved")
                .font(.caption)
                .foregroundStyle(.purple)
        case .painLocation(let log):
            Text(log.painLocations.map(\.displayName).joined(separator: ", "))
                .font(.caption)
                .foregroundStyle(.blue)
        case .note(let note):
            Text(note.note)
                .font(.caption)
                .lineLimit(3)
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
        case painLocation(PainLocationLog)
        case note(EpisodeNote)
    }
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

    var body: some View {
        GeometryReader { geo in
            if readings.count > 1 {
                let sorted = readings.sorted { $0.timestamp < $1.timestamp }
                let minT = sorted.first!.timestamp
                let maxT = sorted.last!.timestamp
                let range = max(Double(maxT - minT), 1)

                Path { path in
                    for (index, reading) in sorted.enumerated() {
                        let x = geo.size.width * CGFloat(Double(reading.timestamp - minT) / range)
                        let y = geo.size.height * (1 - CGFloat(reading.intensity / 10.0))
                        if index == 0 {
                            path.move(to: CGPoint(x: x, y: y))
                        } else {
                            path.addLine(to: CGPoint(x: x, y: y))
                        }
                    }
                }
                .stroke(Color.red, lineWidth: 2)

                ForEach(sorted) { reading in
                    let x = geo.size.width * CGFloat(Double(reading.timestamp - minT) / range)
                    let y = geo.size.height * (1 - CGFloat(reading.intensity / 10.0))
                    Circle()
                        .fill(PainScale.color(for: reading.intensity))
                        .frame(width: 8, height: 8)
                        .position(x: x, y: y)
                }
            } else if let reading = readings.first {
                Circle()
                    .fill(PainScale.color(for: reading.intensity))
                    .frame(width: 12, height: 12)
                    .position(x: geo.size.width / 2, y: geo.size.height / 2)
            }
        }
    }
}
