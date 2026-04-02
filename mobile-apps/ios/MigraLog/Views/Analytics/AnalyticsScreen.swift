import SwiftUI

struct AnalyticsScreen: View {
    @State private var viewModel = AnalyticsViewModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                // Monthly Calendar
                MonthlyCalendarView(viewModel: viewModel)

                // Time Range Selector
                TimeRangeSelectorView(viewModel: viewModel)

                // Day Statistics Card
                DayStatisticsCard(viewModel: viewModel)

                // Episode Statistics
                EpisodeStatisticsCard(viewModel: viewModel)

                // Duration Metrics
                DurationMetricsCard(viewModel: viewModel)

                // Medication Usage
                MedicationUsageCard(viewModel: viewModel)
            }
            .padding()
        }
        .navigationTitle("Trends & Analytics")
        .accessibilityIdentifier("trends-screen")
        .task {
            await viewModel.fetchData()
        }
    }
}

// MARK: - Monthly Calendar View

struct MonthlyCalendarView: View {
    @Bindable var viewModel: AnalyticsViewModel
    @State private var displayMonth = Date()

    private let weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

    var body: some View {
        VStack(spacing: 8) {
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
            LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 7), spacing: 4) {
                ForEach(days, id: \.self) { date in
                    if let date = date {
                        CalendarDayCell(
                            date: date,
                            status: viewModel.calendarStatuses[DateFormatting.dateString(from: date)],
                            onTap: {
                                viewModel.selectedCalendarDate = date
                                viewModel.showDailyStatusPrompt = true
                            }
                        )
                        .accessibilityIdentifier("calendar-day-\(DateFormatting.dateString(from: date))")
                    } else {
                        Text("")
                            .frame(maxWidth: .infinity, minHeight: 36)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
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
    let onTap: () -> Void

    private var isToday: Bool {
        Calendar.current.isDateInToday(date)
    }

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 2) {
                Text("\(Calendar.current.component(.day, from: date))")
                    .font(.caption)
                    .fontWeight(isToday ? .bold : .regular)

                Circle()
                    .fill(statusColor)
                    .frame(width: 8, height: 8)
                    .opacity(status != nil ? 1 : 0)
            }
            .frame(maxWidth: .infinity, minHeight: 36)
            .background(isToday ? Color.accentColor.opacity(0.1) : Color.clear)
            .clipShape(RoundedRectangle(cornerRadius: 6))
        }
        .buttonStyle(.plain)
    }

    private var statusColor: Color {
        switch status {
        case .green: return .green
        case .yellow: return .yellow
        case .red: return .red
        case nil: return .clear
        }
    }
}

// MARK: - Time Range Selector

struct TimeRangeSelectorView: View {
    @Bindable var viewModel: AnalyticsViewModel

    var body: some View {
        HStack(spacing: 8) {
            ForEach(TimeRangeDays.allCases) { range in
                Button {
                    viewModel.selectedRange = range
                    Task { await viewModel.fetchData() }
                } label: {
                    Text(range.displayName)
                        .font(.caption.weight(viewModel.selectedRange == range ? .bold : .regular))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(viewModel.selectedRange == range ? Color.accentColor : Color(.secondarySystemBackground))
                        .foregroundStyle(viewModel.selectedRange == range ? .white : .primary)
                        .clipShape(Capsule())
                }
                .accessibilityIdentifier("time-range-\(range.rawValue)")
            }
        }
    }
}

// MARK: - Day Statistics Card

struct DayStatisticsCard: View {
    @Bindable var viewModel: AnalyticsViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
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
        .clipShape(RoundedRectangle(cornerRadius: 12))
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

// MARK: - Episode Statistics

struct EpisodeStatisticsCard: View {
    @Bindable var viewModel: AnalyticsViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if viewModel.episodes.isEmpty {
                Text("No episodes in selected period")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                Text("Episodes")
                    .font(.headline)

                HStack {
                    LabeledContent("Total") {
                        Text("\(viewModel.episodes.count)")
                    }
                    .accessibilityIdentifier("total-episodes-row")
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Duration Metrics

struct DurationMetricsCard: View {
    @Bindable var viewModel: AnalyticsViewModel

    var body: some View {
        if !viewModel.episodes.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
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
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .accessibilityIdentifier("duration-metrics-card")
        }
    }
}

// MARK: - Medication Usage

struct MedicationUsageCard: View {
    @Bindable var viewModel: AnalyticsViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Rescue Medication Usage")
                .font(.headline)

            if viewModel.rescueDoses.isEmpty {
                Text("No rescue medication usage in selected period")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(viewModel.medicationUsageSummary, id: \.name) { usage in
                    HStack {
                        Text(usage.name)
                            .font(.subheadline)
                        Spacer()
                        Text("\(usage.count) doses")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
