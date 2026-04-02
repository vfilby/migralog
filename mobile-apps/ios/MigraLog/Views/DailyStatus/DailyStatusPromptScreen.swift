import SwiftUI

struct DailyStatusPromptScreen: View {
    let date: Date
    @Bindable var viewModel: AnalyticsViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var selectedStatus: DayStatus?
    @State private var selectedType: YellowDayType?
    @State private var notes: String = ""
    @State private var isSaving = false

    var body: some View {
        VStack(spacing: 20) {
            Text("How was \(DateFormatting.displayDate(date))?")
                .font(.title3.weight(.bold))

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
                            Button {
                                selectedType = selectedType == type ? nil : type
                            } label: {
                                Text(type.displayName)
                                    .font(.caption)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 6)
                                    .background(selectedType == type ? Color.orange : Color(.secondarySystemBackground))
                                    .foregroundStyle(selectedType == type ? .white : .primary)
                                    .clipShape(Capsule())
                            }
                            .accessibilityIdentifier("yellow-type-\(type.rawValue)")
                        }
                    }
                }
            }

            if selectedStatus != nil {
                TextField("Notes (optional)", text: $notes, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .lineLimit(3...6)
                    .accessibilityIdentifier("daily-status-notes-input")
            }

            Spacer()

            HStack(spacing: 16) {
                Button("Skip") {
                    dismiss()
                }
                .buttonStyle(.bordered)
                .accessibilityIdentifier("skip-button")

                Button("Save") {
                    Task { await save() }
                }
                .buttonStyle(.borderedProminent)
                .disabled(selectedStatus == nil || isSaving)
                .accessibilityIdentifier("save-status-button")
            }
        }
        .padding()
        .navigationTitle("Daily Status")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func save() async {
        guard let status = selectedStatus else { return }
        isSaving = true
        defer { isSaving = false }

        let dateString = DateFormatting.dateString(from: date)
        let now = TimestampHelper.now

        let log = DailyStatusLog(
            id: UUID().uuidString,
            date: dateString,
            status: status,
            statusType: selectedType,
            notes: notes.isEmpty ? nil : notes,
            prompted: false,
            createdAt: now,
            updatedAt: now
        )

        do {
            let repo = DailyStatusRepository(dbManager: DatabaseManager.shared)
            try await repo.createStatus(log)

            // Cancel daily check-in for this date
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
