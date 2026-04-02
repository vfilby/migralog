import SwiftUI

struct DailyStatusPromptScreen: View {
    let date: Date
    @Bindable var viewModel: AnalyticsViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var existingStatus: DailyStatusLog?
    @State private var episodes: [Episode] = []
    @State private var overlays: [CalendarOverlay] = []
    @State private var isLoaded = false

    // Edit state
    @State private var selectedStatus: DayStatus?
    @State private var selectedType: YellowDayType?
    @State private var notes: String = ""
    @State private var isSaving = false
    @State private var isEditing = false

    private var dateString: String { DateFormatting.dateString(from: date) }
    private var hasEpisodes: Bool { !episodes.isEmpty }
    private var isImplicitRed: Bool { hasEpisodes }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Date header
                Text(DateFormatting.displayDate(date))
                    .font(.title3.weight(.bold))
                    .frame(maxWidth: .infinity, alignment: .center)

                // Current status display
                statusSection

                // Episodes on this day
                if hasEpisodes {
                    episodesSection
                }

                // Overlays on this day
                if !overlays.isEmpty {
                    overlaysSection
                }

                // Edit/log status (only if not an implicit red day, or editing)
                if !isImplicitRed || isEditing {
                    editStatusSection
                }
            }
            .padding()
        }
        .navigationTitle("Day Details")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Done") { dismiss() }
            }
        }
        .task { await loadDayData() }
    }

    // MARK: - Status Section

    @ViewBuilder
    private var statusSection: some View {
        let effectiveStatus: DayStatus? = isImplicitRed ? .red : existingStatus?.status

        HStack {
            Circle()
                .fill(statusColor(effectiveStatus))
                .frame(width: 16, height: 16)

            if isImplicitRed {
                Text("Migraine Day")
                    .font(.headline)
                    .foregroundStyle(.red)
            } else if let status = existingStatus {
                Text("\(status.status.displayName) Day")
                    .font(.headline)
                    .foregroundStyle(statusColor(status.status))
                if let type = status.statusType {
                    Text("(\(type.displayName))")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            } else {
                Text("Not Logged")
                    .font(.headline)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            if existingStatus != nil && !isImplicitRed {
                Button("Edit") { isEditing = true }
                    .font(.subheadline)
            }
        }
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))

        // Show notes if logged
        if let existingNotes = existingStatus?.notes, !existingNotes.isEmpty, !isEditing {
            Text(existingNotes)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .padding(.horizontal)
        }
    }

    // MARK: - Episodes Section

    @ViewBuilder
    private var episodesSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Episodes")
                .font(.headline)

            ForEach(episodes) { episode in
                NavigationLink {
                    EpisodeDetailScreen(episodeId: episode.id)
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(DateFormatting.displayTime(episode.startDate))\(episode.endDate.map { " — \(DateFormatting.displayTime($0))" } ?? " — Ongoing")")
                                .font(.subheadline)
                            if let duration = episode.durationMillis {
                                Text(DateFormatting.formatDuration(milliseconds: duration))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                    .padding()
                    .background(Color(.secondarySystemBackground))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Overlays Section

    @ViewBuilder
    private var overlaysSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Overlays")
                .font(.headline)

            ForEach(overlays) { overlay in
                HStack {
                    Text(overlay.label)
                        .font(.subheadline.weight(.medium))
                    Spacer()
                    if let endDate = overlay.endDate {
                        Text("\(overlay.startDate) — \(endDate)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    } else {
                        Text("Ongoing")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding()
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
    }

    // MARK: - Edit Status Section

    @ViewBuilder
    private var editStatusSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            if existingStatus == nil && !isImplicitRed {
                Text("Log this day")
                    .font(.headline)
            } else if isEditing {
                Text("Update status")
                    .font(.headline)
            }

            HStack(spacing: 16) {
                StatusButton(title: "Clear", color: .green, isSelected: selectedStatus == .green) {
                    selectedStatus = .green
                    selectedType = nil
                }
                .accessibilityIdentifier("green-day-button")

                StatusButton(title: "Not Clear", color: .orange, isSelected: selectedStatus == .yellow) {
                    selectedStatus = .yellow
                }
                .accessibilityIdentifier("yellow-day-button")
            }

            if selectedStatus == .yellow {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Type (optional)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    FlowLayout(spacing: 8) {
                        ForEach(YellowDayType.allCases) { type in
                            SelectableChip(
                                title: type.displayName,
                                isSelected: selectedType == type
                            ) {
                                selectedType = selectedType == type ? nil : type
                            }
                        }
                    }
                }
            }

            if selectedStatus != nil {
                TextField("Notes (optional)", text: $notes, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(3...6)

                Button("Save") {
                    Task { await save() }
                }
                .buttonStyle(.borderedProminent)
                .disabled(selectedStatus == nil || isSaving)
                .frame(maxWidth: .infinity)
            }

            if existingStatus != nil {
                Button("Remove Status", role: .destructive) {
                    Task { await deleteStatus() }
                }
                .frame(maxWidth: .infinity)
            }
        }
    }

    // MARK: - Data Loading

    private func loadDayData() async {
        let dateStr = dateString
        do {
            let statusRepo = DailyStatusRepository(dbManager: DatabaseManager.shared)
            let episodeRepo = EpisodeRepository(dbManager: DatabaseManager.shared)
            let overlayRepo = OverlayRepository(dbManager: DatabaseManager.shared)

            existingStatus = try statusRepo.getStatusByDate(dateStr)
            overlays = try overlayRepo.getOverlaysForDate(dateStr)

            // Find episodes overlapping this day
            let dayStart = Calendar.current.startOfDay(for: date)
            let dayEnd = Calendar.current.date(byAdding: .day, value: 1, to: dayStart)!
            let dayStartMs = TimestampHelper.fromDate(dayStart)
            let dayEndMs = TimestampHelper.fromDate(dayEnd)
            let allEpisodes = try episodeRepo.getAllEpisodes()
            episodes = allEpisodes.filter { ep in
                ep.startTime < dayEndMs && (ep.endTime ?? Int64.max) > dayStartMs
            }

            // Pre-fill edit state from existing status
            if let status = existingStatus {
                selectedStatus = status.status
                selectedType = status.statusType
                notes = status.notes ?? ""
            }

            isLoaded = true
        } catch {
            AppLogger.shared.error("Failed to load day data", error: error)
        }
    }

    private func save() async {
        guard let status = selectedStatus else { return }
        isSaving = true
        defer { isSaving = false }

        let now = TimestampHelper.now
        let log = DailyStatusLog(
            id: existingStatus?.id ?? UUID().uuidString,
            date: dateString,
            status: status,
            statusType: selectedType,
            notes: notes.isEmpty ? nil : notes,
            prompted: false,
            createdAt: existingStatus?.createdAt ?? now,
            updatedAt: now
        )

        do {
            let repo = DailyStatusRepository(dbManager: DatabaseManager.shared)
            if existingStatus != nil {
                _ = try repo.updateStatus(log)
            } else {
                _ = try repo.createStatus(log)
            }

            let checkinService = DailyCheckinNotificationService(
                notificationService: NotificationService.shared,
                scheduledNotificationRepo: ScheduledNotificationRepository(dbManager: DatabaseManager.shared),
                episodeRepo: EpisodeRepository(dbManager: DatabaseManager.shared),
                dailyStatusRepo: repo
            )
            await checkinService.cancelForDate(dateString)
            await checkinService.topUp()

            await viewModel.loadCalendarData(for: date)
            dismiss()
        } catch {
            AppLogger.shared.error("Failed to save daily status", error: error)
        }
    }

    private func deleteStatus() async {
        guard let status = existingStatus else { return }
        do {
            let repo = DailyStatusRepository(dbManager: DatabaseManager.shared)
            try repo.deleteStatus(status.id)
            await viewModel.loadCalendarData(for: date)
            dismiss()
        } catch {
            AppLogger.shared.error("Failed to delete daily status", error: error)
        }
    }

    private func statusColor(_ status: DayStatus?) -> Color {
        switch status {
        case .green: .green
        case .yellow: .yellow
        case .red: .red
        case nil: Color(.systemGray4)
        }
    }
}

struct StatusButton: View {
    let title: String
    let color: Color
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding()
                .background(isSelected ? color : color.opacity(0.2))
                .foregroundStyle(isSelected ? .white : color)
                .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }
}
