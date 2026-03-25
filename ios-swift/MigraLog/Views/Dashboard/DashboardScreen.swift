import SwiftUI

struct DashboardScreen: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = DashboardViewModel()
    @State private var refreshId = UUID()

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Daily Status Widget
                DailyStatusWidgetView(viewModel: viewModel)

                // Active Episode Card
                if let episode = viewModel.currentEpisode {
                    ActiveEpisodeCard(episode: episode)
                }

                // Start Episode Button
                Button {
                    viewModel.showNewEpisode = true
                } label: {
                    Label("Start Episode", systemImage: "plus.circle.fill")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.accentColor)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .accessibilityIdentifier("start-episode-button")
                .accessibilityHint("Start tracking a new migraine episode")

                // Today's Medications Card
                TodaysMedicationsCard(viewModel: viewModel)

                // Log Medication Button
                Button {
                    viewModel.showLogMedication = true
                } label: {
                    Label("Log Medication", systemImage: "pills.circle.fill")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.blue.opacity(0.1))
                        .foregroundStyle(.blue)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .accessibilityIdentifier("log-medication-button")
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
            refreshId = UUID()
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
                                .padding(.vertical, 8)
                                .background(Color.green.opacity(0.2))
                                .foregroundStyle(.green)
                                .clipShape(Capsule())
                        }
                        .accessibilityLabel("Clear day")
                        .accessibilityIdentifier("green-day-button")

                        Button {
                            Task { await viewModel.logYesterdayStatus(.yellow) }
                        } label: {
                            Text("Not Clear")
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 8)
                                .background(Color.yellow.opacity(0.2))
                                .foregroundStyle(.orange)
                                .clipShape(Capsule())
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

// MARK: - Active Episode Card

struct ActiveEpisodeCard: View {
    let episode: Episode

    var body: some View {
        NavigationLink {
            EpisodeDetailScreen(episodeId: episode.id)
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("Active Episode")
                        .font(.headline)
                    Spacer()
                    Text("Ongoing")
                        .font(.caption)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.red.opacity(0.2))
                        .foregroundStyle(.red)
                        .clipShape(Capsule())
                }

                Text("Started \(DateFormatting.displayTime(episode.startDate))")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                Text(DateFormatting.formatDuration(from: episode.startTime, to: nil))
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            .background(Color(.secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("active-episode-card")
    }
}

// MARK: - Today's Medications Card

struct TodaysMedicationsCard: View {
    @Bindable var viewModel: DashboardViewModel

    var body: some View {
        if !viewModel.todaysMedications.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("Today's Medications")
                    .font(.headline)

                ForEach(viewModel.todaysMedications) { item in
                    MedicationScheduleRow(item: item, viewModel: viewModel)
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

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(item.medication.name)
                .font(.subheadline.weight(.medium))

            if let dose = item.dose {
                HStack {
                    if dose.status == .taken {
                        Label("Taken at \(DateFormatting.displayTime(dose.date))", systemImage: "checkmark.circle.fill")
                            .font(.caption)
                            .foregroundStyle(.green)
                    } else {
                        Label("Skipped", systemImage: "xmark.circle.fill")
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                    Spacer()
                    Button("Undo") {
                        Task { await viewModel.undoDose(scheduleItem: item) }
                    }
                    .font(.caption)
                }
            } else {
                HStack(spacing: 8) {
                    Button("Log \(MedicationFormatting.formatDose(quantity: 1, amount: item.medication.dosageAmount, unit: item.medication.dosageUnit))") {
                        Task { await viewModel.logDose(scheduleItem: item) }
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)

                    Button("Skip") {
                        Task { await viewModel.skipDose(scheduleItem: item) }
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                }
            }
        }
        .padding(.vertical, 4)
    }
}
