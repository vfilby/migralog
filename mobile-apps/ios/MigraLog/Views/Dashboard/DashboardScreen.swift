import SwiftUI

struct DashboardScreen: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = DashboardViewModel()
    /// Backs the Log Update flow shown in place of "Start Episode" while an
    /// episode is ongoing; loaded on demand for the current episode.
    @State private var detailViewModel = EpisodeDetailViewModel()
    /// Backs the iPad-only "This Month" calendar card; never fetched on iPhone.
    @State private var calendarViewModel = AnalyticsViewModel()
    /// Backs the "Did you know?" contextual tip slot.
    @State private var didYouKnowViewModel = DidYouKnowViewModel()
    /// Backs the setup checklist shown where the episode list will be.
    @State private var setupChecklistViewModel = SetupChecklistViewModel()
    /// Drives the add-medication sheet launched from a setup-checklist task, with
    /// the type preselected to match the task.
    @State private var showAddMedication = false
    @State private var addMedicationType: MedicationType = .rescue
    @State private var refreshId = UUID()
    @State private var refreshTask: Task<Void, Never>?
    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        GeometryReader { geo in
            ScrollView {
                if sizeClass == .regular {
                    iPadDashboardLayout(width: geo.size.width, height: geo.size.height)
                } else {
                    iPhoneDashboardLayout
                }
            }
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
            didYouKnowViewModel.refresh()
            setupChecklistViewModel.refresh()
        }) {
            NavigationStack {
                NewEpisodeScreen()
            }
        }
        .sheet(isPresented: $viewModel.showLogUpdate, onDismiss: {
            Task { await viewModel.loadData() }
        }) {
            NavigationStack {
                // Gate on the detail view model having loaded the *current*
                // episode so LogUpdateScreen prefills from real data rather
                // than a stale or empty state.
                if let episode = detailViewModel.episode,
                   episode.id == viewModel.currentEpisode?.id {
                    LogUpdateScreen(episodeId: episode.id, viewModel: detailViewModel)
                } else {
                    ProgressView()
                        .accessibilityIdentifier("log-update-loading")
                }
            }
            .task {
                if let id = viewModel.currentEpisode?.id {
                    await detailViewModel.loadEpisode(id)
                }
            }
        }
        .sheet(isPresented: $viewModel.showLogMedication, onDismiss: {
            Task { await viewModel.loadData() }
            didYouKnowViewModel.refresh()
            setupChecklistViewModel.refresh()
        }) {
            NavigationStack {
                LogMedicationScreen()
            }
        }
        .sheet(isPresented: $showAddMedication, onDismiss: {
            Task { await viewModel.loadData() }
            didYouKnowViewModel.refresh()
            setupChecklistViewModel.refresh()
        }) {
            NavigationStack {
                AddMedicationScreen(initialType: addMedicationType)
            }
        }
        .task(id: refreshId) {
            await viewModel.loadData()
            didYouKnowViewModel.refresh()
            setupChecklistViewModel.refresh()
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
        .onReceive(NotificationCenter.default.publisher(for: .dailyStatusDataChanged)) { _ in
            refreshId = UUID()
        }
    }

    // MARK: - iPhone Layout (existing single-column)

    private var iPhoneDashboardLayout: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            topSlot
            TodaysMedicationsCard(viewModel: viewModel)
            DailyStatusWidgetView(viewModel: viewModel)
            HStack(spacing: DesignTokens.Spacing.md) {
                startEpisodeButton
                logMedicationButton
            }
            RecentEpisodesCard(viewModel: viewModel)
        }
        .padding()
    }

    /// The single top slot. The onboarding checklist takes precedence; tips only
    /// appear once it's completed or dismissed. The two are never shown together.
    @ViewBuilder
    private var topSlot: some View {
        if setupChecklistViewModel.shouldShow {
            SetupChecklistCard(
                viewModel: setupChecklistViewModel,
                onAction: handleSetupTask,
                onDismiss: { setupChecklistViewModel.dismiss($0) }
            )
        } else {
            DidYouKnowCard(viewModel: didYouKnowViewModel, onAction: handleTipAction)
        }
    }

    // MARK: - iPad Layout (adapts to available width / orientation)

    /// Width at/above which the dashboard uses the wide (landscape) three-column
    /// master arrangement instead of the stacked portrait grid. Above 13" iPad
    /// portrait width (1032) so portrait never gets three cramped columns.
    private static let dashboardLandscapeBreakpoint: CGFloat = 1100
    /// Cap so content doesn't stretch edge-to-edge on a 13" display.
    private static let dashboardMaxWidth: CGFloat = 1400
    /// Chrome above the landscape columns: outer padding plus nav bar slack,
    /// used to size the month calendar to the visible column height.
    private static let landscapeChromeHeight: CGFloat = 48

    @ViewBuilder
    private func iPadDashboardLayout(width: CGFloat, height: CGFloat) -> some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            topSlot

            if width >= Self.dashboardLandscapeBreakpoint {
                // Landscape / wide: three balanced columns — actions, activity,
                // and the month calendar — so the wide canvas carries real
                // content instead of trailing whitespace.
                HStack(alignment: .top, spacing: DesignTokens.Spacing.lg) {
                    VStack(spacing: DesignTokens.Spacing.lg) {
                        TodaysMedicationsCard(viewModel: viewModel)
                        HStack(spacing: DesignTokens.Spacing.md) {
                            startEpisodeButton
                            logMedicationButton
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .top)

                    VStack(spacing: DesignTokens.Spacing.lg) {
                        DailyStatusWidgetView(viewModel: viewModel)
                        RecentEpisodesCard(viewModel: viewModel)
                    }
                    .frame(maxWidth: .infinity, alignment: .top)

                    MonthlyCalendarView(
                        viewModel: calendarViewModel,
                        fillHeight: height - Self.landscapeChromeHeight
                    )
                    .frame(maxWidth: .infinity, alignment: .top)
                }
            } else {
                // Portrait iPad: medications + status side by side, then
                // full-width actions, then recent episodes beside the
                // month calendar.
                VStack(spacing: DesignTokens.Spacing.lg) {
                    HStack(alignment: .top, spacing: DesignTokens.Spacing.lg) {
                        TodaysMedicationsCard(viewModel: viewModel)
                            .frame(maxWidth: .infinity)
                        DailyStatusWidgetView(viewModel: viewModel)
                            .frame(maxWidth: .infinity)
                    }
                    HStack(spacing: DesignTokens.Spacing.md) {
                        startEpisodeButton
                        logMedicationButton
                    }
                    HStack(alignment: .top, spacing: DesignTokens.Spacing.lg) {
                        RecentEpisodesCard(viewModel: viewModel)
                            .frame(maxWidth: .infinity)
                        MonthlyCalendarView(viewModel: calendarViewModel)
                            .frame(maxWidth: .infinity)
                    }
                }
            }
        }
        .frame(maxWidth: Self.dashboardMaxWidth)
        .frame(maxWidth: .infinity, alignment: .center)
        .padding()
    }

    /// Routes a tapped tip CTA to the relevant feature. Tips with no
    /// data-completion signal are dismissed via `registerAction` so they don't
    /// keep reappearing after the user has acted on them.
    private func handleTipAction(_ tip: Tip) {
        didYouKnowViewModel.registerAction(on: tip)
        switch tip.cta {
        case .openCalendar:
            appState.showTrends(section: .calendar)
        case .openTrends:
            // Deep-link straight to Insights, not the Trends tab's default
            // Calendar view, so the patterns the tip promises are on screen.
            appState.showTrends(section: .insights)
        case .exportDoctorSummary:
            // The doctor-summary export lives at the bottom of the Trends
            // screen regardless of section; the default Calendar view is fine.
            appState.showTrends()
        }
    }

    /// Opens the add-medication screen for a setup-checklist task, with the
    /// medication type preselected.
    private func handleSetupTask(_ task: SetupTask) {
        addMedicationType = task.medicationType
        showAddMedication = true
    }

    /// While an episode is ongoing the primary action logs an update to it
    /// rather than starting a second episode.
    private var hasOngoingEpisode: Bool { viewModel.currentEpisode != nil }

    private var startEpisodeButton: some View {
        Button {
            if hasOngoingEpisode {
                viewModel.showLogUpdate = true
            } else {
                viewModel.showNewEpisode = true
            }
        } label: {
            Label(
                hasOngoingEpisode ? "Log Update" : "Start Episode",
                systemImage: "plus.circle.fill"
            )
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .fontWeight(.semibold)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color.accentColor)
                .foregroundStyle(.white)
                .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.lg))
        }
        .accessibilityIdentifier(hasOngoingEpisode ? "log-update-button" : "start-episode-button")
        .accessibilityHint(hasOngoingEpisode
            ? "Log an update to the ongoing migraine episode"
            : "Start tracking a new migraine episode")
    }

    private var logMedicationButton: some View {
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
                .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.lg))
        }
        .accessibilityIdentifier("log-medication-button")
    }
}

// MARK: - Daily Status Widget

struct DailyStatusWidgetView: View {
    @Bindable var viewModel: DashboardViewModel

    var body: some View {
        if viewModel.yesterdayStatus != nil || viewModel.shouldShowYesterdayPrompt {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
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
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                        Text("How was yesterday?")
                            .font(.headline)

                        HStack(spacing: DesignTokens.Spacing.md) {
                            Button {
                                Task { await viewModel.logYesterdayStatus(.green) }
                            } label: {
                                Text("Clear")
                                    .frame(maxWidth: .infinity)
                                    .padding(.vertical, 10)
                                    .background(Color.green.opacity(0.2))
                                    .foregroundStyle(.green)
                                    .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.lg))
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
                                    .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.lg))
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
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.lg))
        }
    }
}

// MARK: - Today's Medications Card

struct TodaysMedicationsCard: View {
    @Bindable var viewModel: DashboardViewModel

    /// Logged doses linger on the dashboard this long before being hidden, so the
    /// transition isn't jarring and the user has a window to undo.
    private static let postLogVisibilityWindow: TimeInterval = 15 * 60

    private func visibleItems(now: Date) -> [MedicationScheduleItem] {
        viewModel.todaysMedications.filter { item in
            guard let dose = item.dose else { return true }
            let doseDate = Date(timeIntervalSince1970: TimeInterval(dose.timestamp) / 1000)
            return now.timeIntervalSince(doseDate) < Self.postLogVisibilityWindow
        }
    }

    var body: some View {
        SwiftUI.TimelineView(.periodic(from: .now, by: 60)) { context in
            let items = visibleItems(now: context.date)
            if !items.isEmpty {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    Text("Today's Medications")
                        .font(.headline)

                    ForEach(items) { item in
                        MedicationScheduleRow(item: item, viewModel: viewModel)
                        if item.id != items.last?.id {
                            Divider()
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.lg))
                // Contain children so this identifier stays on the card and
                // doesn't override the per-row identifiers (e.g.
                // medication-name-link-*).
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier("todays-medications-card")
            }
        }
    }
}

struct MedicationScheduleRow: View {
    let item: MedicationScheduleItem
    @Bindable var viewModel: DashboardViewModel
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(AppState.self) private var appState

    private var medicationNameLabel: some View {
        Text(item.medication.name)
            .font(.subheadline.weight(.medium))
            .foregroundStyle(.primary)
    }

    private var doseLabel: String {
        MedicationFormatting.formatDose(
            quantity: item.medication.defaultQuantity ?? 1,
            amount: item.medication.dosageAmount,
            unit: item.medication.dosageUnit
        )
    }

    private var cooldownStatus: MedicationCooldown.Status {
        MedicationCooldown.evaluate(
            medication: item.medication,
            lastDose: viewModel.lastDoseByMedication[item.medication.id]
        )
    }

    private var categoryStatus: CategoryUsageStatus {
        guard let category = item.medication.category else { return .noLimit }
        return viewModel.categoryUsage[category] ?? .noLimit
    }

    var body: some View {
        let status = cooldownStatus
        let catStatus = categoryStatus
        let showBanners = item.dose == nil

        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            if showBanners {
                MedicationSafetyBanners(
                    cooldown: status,
                    categoryCooldown: viewModel.categoryCooldowns[item.medication.id],
                    categoryStatus: catStatus,
                    medicationCategory: item.medication.category,
                    medicationId: item.medication.id
                )
            }

            HStack {
                // iPad: jump to the Medications tab with this medication
                // selected so the split-view list stays visible; iPhone
                // pushes the detail screen as before.
                if sizeClass == .regular {
                    Button {
                        appState.showMedication(item.medication.id)
                    } label: {
                        medicationNameLabel
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("medication-name-link-\(item.medication.id)")
                    .accessibilityHint("Open medication details")
                } else {
                    NavigationLink {
                        MedicationDetailScreen(medicationId: item.medication.id)
                    } label: {
                        medicationNameLabel
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("medication-name-link-\(item.medication.id)")
                    .accessibilityHint("Open medication details")
                }

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
                        HStack(spacing: DesignTokens.Spacing.xs) {
                            if status.isOnCooldown {
                                Image(systemName: "clock.fill")
                                    .foregroundStyle(.orange)
                                    .accessibilityIdentifier("cooldown-icon-\(item.medication.id)")
                            }
                            if catStatus.isWarning {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundStyle(catStatus.isStrong ? Color.red : Color.orange)
                                    .accessibilityIdentifier("category-icon-\(item.medication.id)")
                            }
                            Text("Log \(doseLabel)")
                        }
                        .font(.caption.weight(.medium))
                        .padding(.horizontal, DesignTokens.Spacing.md)
                        .padding(.vertical, 6)
                        .background(Color.accentColor)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.md))
                    }

                    Button {
                        Task { await viewModel.skipDose(scheduleItem: item) }
                    } label: {
                        Text("Skip")
                            .font(.caption.weight(.medium))
                            .padding(.horizontal, DesignTokens.Spacing.md)
                            .padding(.vertical, 6)
                            .background(Color.red.opacity(0.15))
                            .foregroundStyle(.red)
                            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.md))
                    }
                }
            }
        }
        .padding(.vertical, DesignTokens.Spacing.xs)
    }
}

// MARK: - Recent Episodes Card

struct RecentEpisodesCard: View {
    @Bindable var viewModel: DashboardViewModel
    @Environment(AppState.self) private var appState
    @Environment(\.horizontalSizeClass) private var sizeClass

    private var hasContent: Bool {
        viewModel.currentEpisode != nil || !viewModel.recentEpisodes.isEmpty
    }

    var body: some View {
        if hasContent {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                Text("Recent Episodes")
                    .font(.headline)

                // Ongoing episode first
                if let episode = viewModel.currentEpisode {
                    episodeLink(episode)
                        .accessibilityIdentifier("active-episode-card")
                }

                // Recent closed episodes
                ForEach(viewModel.recentEpisodes) { episode in
                    episodeLink(episode)
                }
            }
        }
    }

    /// On iPad (regular width) switch to the Episodes tab with the episode
    /// preselected so the split-view list stays visible; on iPhone push the
    /// detail screen as before.
    @ViewBuilder
    private func episodeLink(_ episode: Episode) -> some View {
        let card = EpisodeCardView(
            episode: episode,
            readings: viewModel.recentReadings[episode.id] ?? []
        )
        if sizeClass == .regular {
            Button {
                appState.showEpisode(episode.id)
            } label: {
                card
            }
            .buttonStyle(.plain)
        } else {
            NavigationLink {
                EpisodeDetailScreen(episodeId: episode.id)
            } label: {
                card
            }
            .buttonStyle(.plain)
        }
    }
}
