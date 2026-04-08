import SwiftUI

struct DashboardScreen: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = DashboardViewModel()
    @State private var refreshId = UUID()
    @State private var refreshTask: Task<Void, Never>?

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // 1. Today's Medications
                TodaysMedicationsCard(viewModel: viewModel)

                // 2. Daily Status Widget (Log Your Day)
                DailyStatusWidgetView(viewModel: viewModel)

                // 3. Action Buttons - side by side
                HStack(spacing: 12) {
                    Button {
                        viewModel.showNewEpisode = true
                    } label: {
                        Label("Start Episode", systemImage: "plus.circle.fill")
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Color.accentColor)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .accessibilityIdentifier("start-episode-button")
                    .accessibilityHint("Start tracking a new migraine episode")

                    Button {
                        viewModel.showLogMedication = true
                    } label: {
                        Label("Log Medication", systemImage: "pills.circle.fill")
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Color.blue.opacity(0.1))
                            .foregroundStyle(.blue)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .accessibilityIdentifier("log-medication-button")
                }

                // 4/5/6. Recent Episodes (title, ongoing, closed)
                RecentEpisodesCard(viewModel: viewModel)
            }
            .padding()
        }
        .navigationTitle("MigraLog")
        .accessibilityIdentifier("dashboard-title")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavigationLink {
                    SettingsScreen()
                } label: {
                    Image(systemName: "gearshape")
                }
                .accessibilityIdentifier("settings-button")
                .accessibilityLabel("Settings")
                .accessibilityHint("Open application settings")
            }
        }
        .sheet(isPresented: $viewModel.showNewEpisode, onDismiss: {
            Task { await viewModel.loadData() }
        }) {
            NavigationStack {
                NewEpisodeScreen()
            }
        }
        .sheet(isPresented: $viewModel.showLogMedication, onDismiss: {
            Task { await viewModel.loadData() }
        }) {
            NavigationStack {
                LogMedicationScreen()
            }
        }
        .task(id: refreshId) {
            await viewModel.loadData()
        }
        .onAppear {
            refreshId = UUID()
        }
        .onReceive(NotificationCenter.default.publisher(for: .medicationDataChanged)) { _ in
            refreshTask?.cancel()
            refreshTask = Task {
                try? await Task.sleep(for: .milliseconds(300))
                guard !Task.isCancelled else { return }
                refreshId = UUID()
            }
        }
    }
}

// MARK: - Daily Status Widget

struct DailyStatusWidgetView: View {
    @Bindable var viewModel: DashboardViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let yesterdayStatus = viewModel.yesterdayStatus {
                HStack {
                    Text("Yesterday logged as \(yesterdayStatus.status.displayName) day")
                        .font(.subheadline)
                    Spacer()
                    Button("Undo") {
                        Task { await viewModel.undoYesterdayStatus() }
                    }
                    .accessibilityIdentifier("undo-status-button")
                }
                .accessibilityIdentifier("daily-status-widget-logged")
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    Text("How was yesterday?")
                        .font(.headline)

                    HStack(spacing: 12) {
                        Button {
                            Task { await viewModel.logYesterdayStatus(.green) }
                        } label: {
                            Text("Clear")
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 10)
                                .background(Color.green.opacity(0.2))
                                .foregroundStyle(.green)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                        .accessibilityLabel("Clear day")
                        .accessibilityIdentifier("green-day-button")

                        Button {
                            Task { await viewModel.logYesterdayStatus(.yellow) }
                        } label: {
                            Text("Not Clear")
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 10)
                                .background(Color.yellow.opacity(0.2))
                                .foregroundStyle(.orange)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                        .accessibilityLabel("Not clear day")
                        .accessibilityIdentifier("yellow-day-button")
                    }
                }
                .accessibilityIdentifier("daily-status-widget")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Today's Medications Card

struct TodaysMedicationsCard: View {
    @Bindable var viewModel: DashboardViewModel

    var body: some View {
        if !viewModel.todaysMedications.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text("Today's Medications")
                    .font(.headline)

                ForEach(viewModel.todaysMedications) { item in
                    MedicationScheduleRow(item: item, viewModel: viewModel)
                    if item.id != viewModel.todaysMedications.last?.id {
                        Divider()
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            .background(Color(.secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .accessibilityIdentifier("todays-medications-card")
        }
    }
}

struct MedicationScheduleRow: View {
    let item: MedicationScheduleItem
    @Bindable var viewModel: DashboardViewModel

    private var doseLabel: String {
        MedicationFormatting.formatDose(
            quantity: item.schedule.dosage,
            amount: item.medication.dosageAmount,
            unit: item.medication.dosageUnit
        )
    }

    var body: some View {
        HStack {
            Text(item.medication.name)
                .font(.subheadline.weight(.medium))

            Spacer()

            if let dose = item.dose {
                if dose.status == .taken {
                    Label("Taken at \(DateFormatting.displayTime(dose.date))", systemImage: "checkmark.circle.fill")
                        .font(.caption)
                        .foregroundStyle(.green)
                } else {
                    Label("Skipped", systemImage: "xmark.circle.fill")
                        .font(.caption)
                        .foregroundStyle(.red)
                }
                Button("Undo") {
                    Task { await viewModel.undoDose(scheduleItem: item) }
                }
                .font(.caption)
            } else {
                Button {
                    Task { await viewModel.logDose(scheduleItem: item) }
                } label: {
                    Text("Log \(doseLabel)")
                        .font(.caption.weight(.medium))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color.accentColor)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }

                Button {
                    Task { await viewModel.skipDose(scheduleItem: item) }
                } label: {
                    Text("Skip")
                        .font(.caption.weight(.medium))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Color.red.opacity(0.15))
                        .foregroundStyle(.red)
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
            }
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Recent Episodes Card

struct RecentEpisodesCard: View {
    @Bindable var viewModel: DashboardViewModel

    private var hasContent: Bool {
        viewModel.currentEpisode != nil || !viewModel.recentEpisodes.isEmpty
    }

    var body: some View {
        if hasContent {
            VStack(alignment: .leading, spacing: 12) {
                Text("Recent Episodes")
                    .font(.headline)

                // Ongoing episode first
                if let episode = viewModel.currentEpisode {
                    NavigationLink {
                        EpisodeDetailScreen(episodeId: episode.id)
                    } label: {
                        EpisodeCardView(
                            episode: episode,
                            readings: viewModel.recentReadings[episode.id] ?? []
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("active-episode-card")
                }

                // Recent closed episodes
                ForEach(viewModel.recentEpisodes) { episode in
                    NavigationLink {
                        EpisodeDetailScreen(episodeId: episode.id)
                    } label: {
                        EpisodeCardView(
                            episode: episode,
                            readings: viewModel.recentReadings[episode.id] ?? []
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}
