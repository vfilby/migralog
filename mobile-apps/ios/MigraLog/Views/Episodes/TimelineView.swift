import SwiftUI

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

// MARK: - Timeline View

struct TimelineView: View {
    let details: EpisodeWithDetails
    let viewModel: EpisodeDetailViewModel

    // Timeline editing bindings
    @Binding var editingReading: IntensityReading?
    @Binding var editingSymptomLog: SymptomLog?
    @Binding var editingPainLocationLog: PainLocationLog?
    @Binding var editingNote: EpisodeNote?
    @Binding var showDeleteConfirmation: Bool
    @Binding var pendingDeleteAction: (() async -> Void)?
    @Binding var pendingDeleteLabel: String
    @Binding var customEndTime: Date
    @Binding var showEndTimePicker: Bool

    var body: some View {
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
}
