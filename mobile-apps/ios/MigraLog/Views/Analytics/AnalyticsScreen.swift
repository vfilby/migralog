import SwiftUI

/// Top-level sections of the Trends tab: day-tracking calendar vs.
/// time-range analytics. Decoupled because the calendar is month-driven
/// while everything else follows the range selector.
enum AnalyticsSection: String, CaseIterable, Identifiable {
    case calendar
    case insights

    var id: String { rawValue }

    var label: String {
        switch self {
        case .calendar: return "Calendar"
        case .insights: return "Insights"
        }
    }
}

struct AnalyticsSectionPicker: View {
    @Binding var selection: AnalyticsSection

    var body: some View {
        Picker("View", selection: $selection) {
            ForEach(AnalyticsSection.allCases) { section in
                Text(section.label).tag(section)
            }
        }
        .pickerStyle(.segmented)
        .accessibilityIdentifier("analytics-section-picker")
    }
}

struct AnalyticsScreen: View {
    @State private var viewModel = AnalyticsViewModel()
    @State private var showAddOverlay = false
    @State private var editingOverlay: CalendarOverlay?
    @State private var selectedSection: AnalyticsSection = .calendar

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                AnalyticsSectionPicker(selection: $selectedSection)

                switch selectedSection {
                case .calendar:
                    // Monthly Calendar
                    MonthlyCalendarView(viewModel: viewModel)

                    // Overlays section
                    OverlayListCard(
                        overlays: viewModel.calendarOverlays,
                        onAdd: { showAddOverlay = true },
                        onEdit: { editingOverlay = $0 }
                    )

                case .insights:
                    // Time Range Selector
                    TimeRangeSelectorView(viewModel: viewModel)

                    // Day Statistics Card
                    DayStatisticsCard(viewModel: viewModel)

                    // Duration Metrics
                    DurationMetricsCard(viewModel: viewModel)

                    // Insight charts and summary table (episode totals and
                    // per-medication usage live in the Monthly Summary)
                    InsightsChartsSection(viewModel: viewModel)
                }
            }
            .padding()
        }
        .navigationTitle("Trends & Analytics")
        .accessibilityIdentifier("trends-screen")
        .task {
            await viewModel.fetchData()
        }
        .sheet(isPresented: $showAddOverlay, onDismiss: { Task { await viewModel.loadCalendarData(for: Date()) } }) {
            NavigationStack {
                OverlayFormSheet { overlay in
                    Task { await viewModel.saveOverlay(overlay) }
                }
            }
        }
        .sheet(item: $editingOverlay, onDismiss: { Task { await viewModel.loadCalendarData(for: Date()) } }) { overlay in
            NavigationStack {
                OverlayFormSheet(overlay: overlay, onSave: { updated in
                    Task { await viewModel.saveOverlay(updated) }
                }, onDelete: { id in
                    Task { await viewModel.deleteOverlay(id) }
                })
            }
        }
    }
}

// MARK: - Monthly Calendar View

struct MonthlyCalendarView: View {
    @Bindable var viewModel: AnalyticsViewModel
    /// When set, day cells grow so the month grid fills this height
    /// (wide iPad panes). When nil, cells use the compact 44pt minimum.
    var fillHeight: CGFloat?
    @State private var displayMonth = Date()

    private let weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    /// Vertical space inside the card not occupied by the day grid:
    /// card padding, month navigation, weekday header, and stack spacing.
    private static let cardChromeHeight: CGFloat = 110

    private func dayCellHeight(rows: Int) -> CGFloat {
        guard let fillHeight, rows > 0 else { return 44 }
        let gridSpacing = CGFloat(rows - 1) * 6
        let available = fillHeight - Self.cardChromeHeight - gridSpacing
        return max(44, min(160, available / CGFloat(rows)))
    }

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            // Month navigation
            HStack {
                Button {
                    displayMonth = Calendar.current.date(byAdding: .month, value: -1, to: displayMonth) ?? displayMonth
                    Task { await viewModel.loadCalendarData(for: displayMonth) }
                } label: {
                    Image(systemName: "chevron.left")
                }
                .accessibilityIdentifier("calendar-previous")

                Spacer()
                Text(monthYearString(displayMonth))
                    .font(.headline)
                Spacer()

                Button {
                    displayMonth = Calendar.current.date(byAdding: .month, value: 1, to: displayMonth) ?? displayMonth
                    Task { await viewModel.loadCalendarData(for: displayMonth) }
                } label: {
                    Image(systemName: "chevron.right")
                }
                .accessibilityIdentifier("calendar-next")
            }

            // Weekday headers
            HStack {
                ForEach(weekdays, id: \.self) { day in
                    Text(day)
                        .font(.caption2)
                        .frame(maxWidth: .infinity)
                        .foregroundStyle(.secondary)
                }
            }

            // Calendar grid
            let days = calendarDays(for: displayMonth)
            let cellHeight = dayCellHeight(rows: days.count / 7)
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 2), count: 7), spacing: 6) {
                ForEach(days, id: \.self) { date in
                    if let date = date {
                        let dateStr = DateFormatting.dateString(from: date)
                        CalendarDayCell(
                            date: date,
                            status: viewModel.calendarStatuses[dateStr],
                            hasOverlay: viewModel.calendarOverlayDates.contains(dateStr),
                            minHeight: cellHeight,
                            onTap: {
                                viewModel.selectedCalendarDate = date
                                viewModel.showDailyStatusPrompt = true
                            }
                        )
                        .accessibilityIdentifier("calendar-day-\(DateFormatting.dateString(from: date))")
                    } else {
                        Color.clear
                            .frame(maxWidth: .infinity, minHeight: cellHeight)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.lg))
        .sheet(isPresented: $viewModel.showDailyStatusPrompt) {
            if let date = viewModel.selectedCalendarDate {
                NavigationStack {
                    DailyStatusPromptScreen(date: date, viewModel: viewModel)
                }
            }
        }
        .task {
            await viewModel.loadCalendarData(for: displayMonth)
        }
    }

    private func monthYearString(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM yyyy"
        return formatter.string(from: date)
    }

    private func calendarDays(for date: Date) -> [Date?] {
        let calendar = Calendar.current
        guard let range = calendar.range(of: .day, in: .month, for: date),
              let firstDay = calendar.date(from: calendar.dateComponents([.year, .month], from: date)) else {
            return []
        }

        let firstWeekday = calendar.component(.weekday, from: firstDay) - 1
        var days: [Date?] = Array(repeating: nil, count: firstWeekday)

        for day in range {
            if let date = calendar.date(byAdding: .day, value: day - 1, to: firstDay) {
                days.append(date)
            }
        }

        // Pad to complete last week
        while days.count % 7 != 0 {
            days.append(nil)
        }
        return days
    }
}

struct CalendarDayCell: View {
    let date: Date
    let status: DayStatus?
    let hasOverlay: Bool
    var minHeight: CGFloat = 44
    let onTap: () -> Void

    private var isToday: Bool {
        Calendar.current.isDateInToday(date)
    }

    private var isFuture: Bool {
        date > Date()
    }

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 2) {
                Circle()
                    .fill(statusColor)
                    .frame(width: 12, height: 12)

                Text("\(Calendar.current.component(.day, from: date))")
                    .font(.subheadline)
                    .fontWeight(isToday ? .bold : .regular)
                    .foregroundStyle(isFuture ? .tertiary : .primary)

                // Overlay line at bottom
                RoundedRectangle(cornerRadius: 2)
                    .fill(hasOverlay ? Color(.systemGray3) : .clear)
                    .frame(height: 4)
            }
            .frame(maxWidth: .infinity, minHeight: minHeight)
            .background(isToday ? Color.accentColor.opacity(0.1) : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: 6))
        }
        .buttonStyle(.plain)
        .disabled(isFuture)
    }

    private var statusColor: Color {
        if isFuture { return .clear }
        switch status {
        case .green: return .green
        case .yellow: return .yellow
        case .red: return .red
        case nil: return Color(.systemGray4)
        }
    }
}

// MARK: - Time Range Selector

struct TimeRangeSelectorView: View {
    @Bindable var viewModel: AnalyticsViewModel
    @State private var showCustomRangeSheet = false

    private static let rangeFormatter: DateIntervalFormatter = {
        let formatter = DateIntervalFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: DesignTokens.Spacing.sm) {
                ForEach(TimeRangeDays.allCases) { range in
                    let isSelected = viewModel.customRange == nil && viewModel.selectedRange == range
                    Button {
                        Task { await viewModel.setDateRange(range) }
                    } label: {
                        chipLabel(range.displayName, isSelected: isSelected)
                    }
                    // .plain keeps each chip its own tap target inside the
                    // iPad sidebar List; default-styled buttons in a List row
                    // merge into one target that fires the last action.
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("time-range-\(range.rawValue)")
                }

                Button {
                    showCustomRangeSheet = true
                } label: {
                    chipLabel("Custom", isSelected: viewModel.customRange != nil)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("time-range-custom")
            }

            if let custom = viewModel.customRange {
                Text(Self.rangeFormatter.string(from: custom.lowerBound, to: custom.upperBound))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .accessibilityIdentifier("custom-range-label")
            }
        }
        .sheet(isPresented: $showCustomRangeSheet) {
            CustomRangeSheet(initialRange: viewModel.customRange) { start, end in
                Task { await viewModel.setCustomRange(start: start, end: end) }
            }
        }
    }

    private func chipLabel(_ text: String, isSelected: Bool) -> some View {
        Text(text)
            .font(.caption.weight(isSelected ? .bold : .regular))
            .padding(.horizontal, DesignTokens.Spacing.md)
            .padding(.vertical, 6)
            .background(isSelected ? Color.accentColor : Color(.secondarySystemBackground))
            .foregroundStyle(isSelected ? .white : .primary)
            .clipShape(Capsule())
    }
}

/// Start/end date picker for a custom analytics range.
struct CustomRangeSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var startDate: Date
    @State private var endDate: Date
    let onApply: (Date, Date) -> Void

    init(initialRange: ClosedRange<Date>?, onApply: @escaping (Date, Date) -> Void) {
        let defaultEnd = Date()
        let defaultStart = Calendar.current.date(byAdding: .day, value: -29, to: defaultEnd) ?? defaultEnd
        _startDate = State(initialValue: initialRange?.lowerBound ?? defaultStart)
        _endDate = State(initialValue: initialRange?.upperBound ?? defaultEnd)
        self.onApply = onApply
    }

    var body: some View {
        NavigationStack {
            Form {
                DatePicker(
                    "Start",
                    selection: $startDate,
                    in: ...endDate,
                    displayedComponents: .date
                )
                .accessibilityIdentifier("custom-range-start")
                DatePicker(
                    "End",
                    selection: $endDate,
                    in: startDate...Date(),
                    displayedComponents: .date
                )
                .accessibilityIdentifier("custom-range-end")
            }
            .navigationTitle("Custom Range")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Apply") {
                        onApply(startDate, endDate)
                        dismiss()
                    }
                    .accessibilityIdentifier("custom-range-apply")
                }
            }
        }
        .presentationDetents([.medium])
    }
}

// MARK: - Day Statistics Card

struct DayStatisticsCard: View {
    @Bindable var viewModel: AnalyticsViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text("Day Statistics")
                .font(.headline)

            HStack {
                StatRow(label: "Migraine days", value: "\(viewModel.migraineDays)", color: .red)
                    .accessibilityIdentifier("migraine-days-row")
                Spacer()
                StatRow(label: "Not-clear days", value: "\(viewModel.notClearDays)", color: .yellow)
                Spacer()
                StatRow(label: "Clear days", value: "\(viewModel.clearDays)", color: .green)
                    .accessibilityIdentifier("clear-days-row")
                Spacer()
                StatRow(label: "Unknown", value: "\(viewModel.unknownDays)", color: .gray)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.lg))
        .accessibilityIdentifier("day-statistics-card")
    }
}

struct StatRow: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        VStack {
            Text(value)
                .font(.title3.weight(.bold))
                .foregroundStyle(color)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
    }
}

// MARK: - Duration Metrics

struct DurationMetricsCard: View {
    @Bindable var viewModel: AnalyticsViewModel

    var body: some View {
        if !viewModel.episodes.isEmpty {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                Text("Duration Metrics")
                    .font(.headline)

                let durations = viewModel.episodes.compactMap { $0.durationMillis }
                if !durations.isEmpty {
                    LabeledContent("Shortest") {
                        Text(DateFormatting.formatDuration(milliseconds: durations.min() ?? 0))
                    }
                    LabeledContent("Longest") {
                        Text(DateFormatting.formatDuration(milliseconds: durations.max() ?? 0))
                    }
                    LabeledContent("Average") {
                        let avg = durations.reduce(0, +) / Int64(durations.count)
                        Text(DateFormatting.formatDuration(milliseconds: avg))
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
            .background(Color(.secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.lg))
            .accessibilityIdentifier("duration-metrics-card")
        }
    }
}

// MARK: - Overlay List

struct OverlayListCard: View {
    let overlays: [CalendarOverlay]
    var onAdd: (() -> Void)?
    var onEdit: ((CalendarOverlay) -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            HStack {
                Text("Overlays")
                    .font(.headline)
                Spacer()
                if let onAdd = onAdd {
                    Button {
                        onAdd()
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.title3)
                    }
                }
            }

            if overlays.isEmpty {
                Text("No active overlays")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(overlays) { overlay in
                    Button {
                        onEdit?(overlay)
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(overlay.label)
                                    .font(.subheadline.weight(.medium))
                                Text(formatDateRange(overlay))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                        }
                    }
                    .buttonStyle(.plain)
                    if overlay.id != overlays.last?.id {
                        Divider()
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.lg))
    }

    private func formatDateRange(_ overlay: CalendarOverlay) -> String {
        if let endDate = overlay.endDate {
            return "\(overlay.startDate) — \(endDate)"
        }
        return "\(overlay.startDate) — Ongoing"
    }
}

// MARK: - iPad Split Views

/// Controls and statistics for the iPad narrow column.
struct AnalyticsControlsColumn: View {
    @Bindable var viewModel: AnalyticsViewModel
    var onAddOverlay: () -> Void
    var onEditOverlay: (CalendarOverlay) -> Void

    var body: some View {
        List {
            Section("Time Range") {
                TimeRangeSelectorView(viewModel: viewModel)
            }

            Section("Day Statistics") {
                DayStatisticsContent(viewModel: viewModel)
            }

            Section("Duration") {
                DurationMetricsContent(viewModel: viewModel)
            }

            Section("Overlays") {
                OverlayListContent(
                    overlays: viewModel.calendarOverlays,
                    onAdd: onAddOverlay,
                    onEdit: onEditOverlay
                )
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Trends")
    }
}

// MARK: - Inline content views for iPad list sections

private struct DayStatisticsContent: View {
    @Bindable var viewModel: AnalyticsViewModel

    var body: some View {
        HStack {
            StatRow(label: "Migraine", value: "\(viewModel.migraineDays)", color: .red)
            Spacer()
            StatRow(label: "Not-clear", value: "\(viewModel.notClearDays)", color: .yellow)
            Spacer()
            StatRow(label: "Clear", value: "\(viewModel.clearDays)", color: .green)
            Spacer()
            StatRow(label: "Unknown", value: "\(viewModel.unknownDays)", color: .gray)
        }
    }
}

private struct DurationMetricsContent: View {
    @Bindable var viewModel: AnalyticsViewModel

    var body: some View {
        let durations = viewModel.episodes.compactMap { $0.durationMillis }
        if durations.isEmpty {
            Text("No data")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        } else {
            LabeledContent("Shortest") {
                Text(DateFormatting.formatDuration(milliseconds: durations.min() ?? 0))
            }
            LabeledContent("Longest") {
                Text(DateFormatting.formatDuration(milliseconds: durations.max() ?? 0))
            }
            LabeledContent("Average") {
                let avg = durations.reduce(0, +) / Int64(durations.count)
                Text(DateFormatting.formatDuration(milliseconds: avg))
            }
        }
    }
}

private struct OverlayListContent: View {
    let overlays: [CalendarOverlay]
    var onAdd: () -> Void
    var onEdit: (CalendarOverlay) -> Void

    var body: some View {
        Button { onAdd() } label: {
            Label("Add Overlay", systemImage: "plus.circle")
        }

        ForEach(overlays) { overlay in
            Button { onEdit(overlay) } label: {
                VStack(alignment: .leading, spacing: 2) {
                    Text(overlay.label)
                        .font(.subheadline.weight(.medium))
                    Text("\(overlay.startDate) — \(overlay.endDate ?? "Ongoing")")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .buttonStyle(.plain)
        }
    }
}

/// Calendar and visualizations for the iPad wide pane.
struct AnalyticsVisualizationPane: View {
    @Bindable var viewModel: AnalyticsViewModel
    @State private var selectedSection: AnalyticsSection = .calendar

    /// Vertical space above the calendar card: pane padding, the
    /// Calendar/Insights picker, and the stack spacing below it.
    private static let paneChromeHeight: CGFloat = 96

    var body: some View {
        GeometryReader { geo in
            ScrollView {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                    AnalyticsSectionPicker(selection: $selectedSection)

                    switch selectedSection {
                    case .calendar:
                        // Fill the pane height so the month grid uses the
                        // wide canvas instead of floating over empty space.
                        MonthlyCalendarView(
                            viewModel: viewModel,
                            fillHeight: geo.size.height - Self.paneChromeHeight
                        )
                    case .insights:
                        InsightsChartsSection(viewModel: viewModel)
                    }
                }
                .padding()
            }
        }
    }
}
