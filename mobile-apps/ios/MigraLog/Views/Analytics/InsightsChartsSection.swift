import Charts
import SwiftUI

/// Swift Charts insight suite for the Trends screen (issue #435).
///
/// Renders the clinically grounded views computed by `AnalyticsInsights`:
/// warning callouts, the rolling 28-day headache-day trend vs. the chronic
/// range, medication-overuse risk in intake days, weekly severity
/// distribution, and time-of-day clustering.
struct InsightsChartsSection: View {
    @Bindable var viewModel: AnalyticsViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            WarningCalloutsCard(warnings: viewModel.insightWarnings)
            MonthlySummaryCard(summaries: viewModel.monthlySummaries, medications: viewModel.summaryMedications)
            HeadacheBurdenChartCard(points: viewModel.headacheDayTrend)
            MedicationOveruseChartCard(series: viewModel.intakeSeries)
            SeverityDistributionChartCard(counts: viewModel.severityWeekCounts)
            TimeOfDayChartCard(bins: viewModel.timeOfDayBins)
            SymptomFrequencyChartCard(frequencies: viewModel.symptomFrequencies)
            PainLocationFrequencyChartCard(frequencies: viewModel.painLocationFrequencies)
            AdherenceChartCard(weeks: viewModel.weeklyAdherence)
        }
    }
}

// MARK: - Card chrome

private struct InsightCard<Content: View>: View {
    let title: String
    let subtitle: String
    let accessibilityId: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text(title)
                .font(.headline)
            Text(subtitle)
                .font(.caption)
                .foregroundStyle(.secondary)
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.lg))
        .accessibilityIdentifier(accessibilityId)
    }
}

private struct EmptyChartPlaceholder: View {
    var body: some View {
        Text("Not enough data in this range yet")
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, minHeight: 80)
    }
}

// MARK: - Warning callouts

struct WarningCalloutsCard: View {
    let warnings: [AnalyticsInsights.Warning]

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            Text("Warning Signs")
                .font(.headline)

            if warnings.isEmpty {
                HStack(spacing: DesignTokens.Spacing.sm) {
                    Image(systemName: "checkmark.seal.fill")
                        .foregroundStyle(.green)
                    Text("Nothing flagged in the current data.")
                        .font(.subheadline)
                }
            } else {
                ForEach(warnings) { warning in
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: icon(for: warning.severity))
                            .foregroundStyle(color(for: warning.severity))
                            .font(.body)
                            .padding(.top, 1)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(warning.title)
                                .font(.subheadline.weight(.semibold))
                            Text(warning.detail)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }

            Text("Informational only — not medical advice.")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.Radius.lg))
        .accessibilityIdentifier("insights-warnings-card")
    }

    private func icon(for severity: AnalyticsInsights.WarningSeverity) -> String {
        switch severity {
        case .alert: return "exclamationmark.triangle.fill"
        case .caution: return "exclamationmark.circle.fill"
        case .info: return "info.circle.fill"
        }
    }

    private func color(for severity: AnalyticsInsights.WarningSeverity) -> Color {
        switch severity {
        case .alert: return .red
        case .caution: return .orange
        case .info: return .blue
        }
    }
}

// MARK: - Headache burden trend

struct HeadacheBurdenChartCard: View {
    let points: [AnalyticsInsights.DailyCount]

    private var yMax: Int {
        max(AnalyticsInsights.chronicRangeThreshold + 3, (points.map(\.count).max() ?? 0) + 2)
    }

    var body: some View {
        InsightCard(
            title: "Headache Burden",
            subtitle: "Headache days in the trailing 28 days. ≥15 for three months is the chronic-migraine range (ICHD-3).",
            accessibilityId: "headache-trend-chart"
        ) {
            if points.isEmpty {
                EmptyChartPlaceholder()
            } else {
                Chart {
                    ForEach(points) { point in
                        AreaMark(
                            x: .value("Date", point.date),
                            y: .value("Days", point.count)
                        )
                        .foregroundStyle(Color.accentColor.opacity(0.15))
                        LineMark(
                            x: .value("Date", point.date),
                            y: .value("Days", point.count)
                        )
                        .foregroundStyle(Color.accentColor)
                        .interpolationMethod(.monotone)
                    }
                    RuleMark(y: .value("Chronic range", AnalyticsInsights.chronicRangeThreshold))
                        .foregroundStyle(.red.opacity(0.7))
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                }
                .chartYScale(domain: 0...yMax)
                .frame(height: 180)
            }
        }
    }
}

// MARK: - Medication overuse risk

struct MedicationOveruseChartCard: View {
    let series: [AnalyticsInsights.ClassIntakeSeries]

    private static let classColors: [AnalyticsInsights.AcuteMedClass: Color] = [
        .triptan: .blue,
        .simpleAnalgesic: .teal,
    ]

    /// One mini-chart per used class with an established overuse guideline
    /// (triptans, OTC/NSAID). Classes without one — CGRP acute meds — are
    /// excluded from this card entirely.
    private var visibleSeries: [AnalyticsInsights.ClassIntakeSeries] {
        series.filter { classSeries in
            classSeries.medClass.overuseThresholdDays != nil
                && classSeries.points.contains { $0.count >= 1 }
        }
    }

    var body: some View {
        InsightCard(
            title: "Medication Overuse Risk",
            subtitle: "Days with a rescue dose in the trailing 28 days — counted in days, not doses.",
            accessibilityId: "moh-chart"
        ) {
            if visibleSeries.isEmpty {
                EmptyChartPlaceholder()
            } else {
                ForEach(visibleSeries) { classSeries in
                    ClassIntakeChart(
                        series: classSeries,
                        color: Self.classColors[classSeries.medClass] ?? .gray
                    )
                }
            }
        }
    }
}

/// A single acute class's rolling intake-day trend with its own guideline.
private struct ClassIntakeChart: View {
    let series: AnalyticsInsights.ClassIntakeSeries
    let color: Color

    private var yMax: Int {
        let maxCount = series.points.map(\.count).max() ?? 0
        return max((series.medClass.overuseThresholdDays ?? 8) + 2, maxCount + 2)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            HStack(spacing: 6) {
                Circle()
                    .fill(color)
                    .frame(width: 8, height: 8)
                Text(series.medClass.displayName)
                    .font(.subheadline.weight(.medium))
                Spacer()
                if let threshold = series.medClass.overuseThresholdDays {
                    Text("guideline: under \(threshold) days")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            Chart {
                ForEach(series.points) { point in
                    LineMark(
                        x: .value("Date", point.date),
                        y: .value("Days", point.count)
                    )
                    .foregroundStyle(color)
                    .interpolationMethod(.monotone)
                }
                if let threshold = series.medClass.overuseThresholdDays {
                    RuleMark(y: .value("Guideline", threshold))
                        .foregroundStyle(.red.opacity(0.6))
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                }
            }
            .chartYScale(domain: 0...yMax)
            .frame(height: 110)

            if !series.medicationNames.isEmpty {
                Text("Includes: \(series.medicationNames.joined(separator: ", "))")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.top, DesignTokens.Spacing.xs)
    }
}

// MARK: - Severity distribution

struct SeverityDistributionChartCard: View {
    let counts: [AnalyticsInsights.SeverityWeekCount]

    /// Bin colors sampled from the shared pain scale (2, 4, 6, 8).
    private static let binColors: [String: Color] = [
        AnalyticsInsights.SeverityBin.mild.displayName: PainScale.color(for: 2),
        AnalyticsInsights.SeverityBin.moderate.displayName: PainScale.color(for: 4),
        AnalyticsInsights.SeverityBin.severe.displayName: PainScale.color(for: 6),
        AnalyticsInsights.SeverityBin.verySevere.displayName: PainScale.color(for: 8),
    ]

    var body: some View {
        InsightCard(
            title: "Severity by Week",
            subtitle: "Episodes per week, stacked by peak intensity. Shows whether attacks are getting milder or harsher independent of how often they happen.",
            accessibilityId: "severity-chart"
        ) {
            if counts.isEmpty {
                EmptyChartPlaceholder()
            } else {
                Chart(counts) { entry in
                    BarMark(
                        x: .value("Week", entry.weekStart, unit: .weekOfYear),
                        y: .value("Episodes", entry.count)
                    )
                    .foregroundStyle(by: .value("Severity", entry.bin.displayName))
                }
                .chartForegroundStyleScale(
                    domain: AnalyticsInsights.SeverityBin.allCases.map(\.displayName),
                    range: AnalyticsInsights.SeverityBin.allCases.map { Self.binColors[$0.displayName] ?? .gray }
                )
                .frame(height: 180)
            }
        }
    }
}

// MARK: - Preventative adherence

struct AdherenceChartCard: View {
    let weeks: [AnalyticsInsights.WeeklyAdherence]

    var body: some View {
        InsightCard(
            title: "Preventative Adherence",
            subtitle: "Percent of scheduled preventative doses logged as taken, by week. Only days a medication was actively scheduled count.",
            accessibilityId: "adherence-chart"
        ) {
            if weeks.isEmpty {
                EmptyChartPlaceholder()
            } else {
                Chart(weeks) { week in
                    BarMark(
                        x: .value("Week", week.weekStart, unit: .weekOfYear),
                        y: .value("Adherence", week.percent)
                    )
                    .foregroundStyle(MedicationTypeColors.color(for: .preventative).opacity(0.85))
                }
                .chartYScale(domain: 0...100)
                .frame(height: 150)
            }
        }
    }
}

// MARK: - Monthly summary

struct MonthlySummaryCard: View {
    let summaries: [AnalyticsInsights.MonthSummary]
    let medications: [Medication]

    private static let monthFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM yyyy"
        return formatter
    }()

    private var hasPartial: Bool {
        summaries.contains(where: \.isPartial)
    }

    /// Acute classes with any usage across the shown months.
    private var activeClasses: [AnalyticsInsights.AcuteMedClass] {
        AnalyticsInsights.AcuteMedClass.allCases.filter { medClass in
            summaries.contains { ($0.classStats[medClass]?.doses ?? 0) > 0 }
        }
    }

    /// Month columns plus a range-total column when more than one month shows.
    private var columns: [(key: String, label: String, isTotal: Bool, summary: AnalyticsInsights.MonthSummary)] {
        var columns = summaries.map { summary in
            (key: TimestampHelper.dateString(from: summary.monthStart), label: monthLabel(summary), isTotal: false, summary: summary)
        }
        if summaries.count > 1, let total = AnalyticsInsights.totalSummary(of: summaries) {
            columns.append((key: "total", label: "Total", isTotal: true, summary: total))
        }
        return columns
    }

    /// One table row: a pinned label plus one value per month column.
    private struct SummaryRow: Identifiable {
        let id: String
        let label: String
        let value: (AnalyticsInsights.MonthSummary) -> String
    }

    @ScaledMetric(relativeTo: .caption) private var rowHeight: CGFloat = 20
    @ScaledMetric(relativeTo: .caption) private var labelWidth: CGFloat = 116
    @State private var scrollMetrics = HorizontalScrollMetrics()
    @State private var viewportWidth: CGFloat = 0

    private var metricRows: [SummaryRow] {
        var rows: [SummaryRow] = [
            SummaryRow(id: "episodes", label: "Episodes") { "\($0.episodeCount)" },
            SummaryRow(id: "episode-days", label: "Episode days") { "\($0.episodeDays)" },
            SummaryRow(id: "rescue-doses", label: "Rescue doses") { "\($0.totalDoses)" },
            SummaryRow(id: "rescue-days", label: "Rescue days") { "\($0.totalIntakeDays)" },
        ]
        for medClass in activeClasses {
            rows.append(SummaryRow(id: "class-\(medClass.rawValue)", label: "\(medClass.displayName) days") {
                "\($0.classStats[medClass]?.days ?? 0)"
            })
        }
        return rows
    }

    private var medicationRows: [SummaryRow] {
        medications.map { med in
            SummaryRow(id: "med-\(med.id)", label: med.name) { month in
                guard let stat = month.medStats[med.id] else { return "—" }
                return "\(stat.doses) (\(stat.days)d)"
            }
        }
    }

    var body: some View {
        InsightCard(
            title: "Monthly Summary",
            subtitle: "Calendar-month totals for your care team. Medication cells read doses (days with a dose).",
            accessibilityId: "monthly-summary-card"
        ) {
            if summaries.isEmpty {
                EmptyChartPlaceholder()
            } else {
                HStack(alignment: .top, spacing: DesignTokens.Spacing.sm) {
                    labelColumn
                    scrollableValueColumns
                }
                if hasPartial {
                    Text("* Partial month — totals only cover the selected range.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    /// Pinned labels: stays put while the month columns scroll.
    private var labelColumn: some View {
        VStack(alignment: .leading, spacing: 6) {
            Color.clear.frame(width: labelWidth, height: rowHeight)
            Divider()
            ForEach(metricRows) { row in
                labelCell(row.label)
            }
            if !medicationRows.isEmpty {
                Divider()
            }
            ForEach(medicationRows) { row in
                labelCell(row.label)
            }
        }
        .frame(width: labelWidth, alignment: .leading)
    }

    /// True while at least one column is hidden past the trailing edge.
    private var showMoreHint: Bool {
        scrollMetrics.contentWidth - scrollMetrics.offsetX > viewportWidth + 2
    }

    private var scrollableValueColumns: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 6) {
                GridRow {
                    ForEach(columns, id: \.key) { column in
                        valueCell(column.label, isTotal: column.isTotal, isHeader: true)
                    }
                }
                Divider()
                ForEach(metricRows) { row in
                    valueRow(row)
                }
                if !medicationRows.isEmpty {
                    Divider()
                }
                ForEach(medicationRows) { row in
                    valueRow(row)
                }
            }
            .background(
                GeometryReader { geometry in
                    let frame = geometry.frame(in: .named("monthly-summary-scroll"))
                    Color.clear
                        .onAppear {
                            scrollMetrics = HorizontalScrollMetrics(offsetX: -frame.minX, contentWidth: frame.width)
                        }
                        .onChange(of: frame) { _, newFrame in
                            scrollMetrics = HorizontalScrollMetrics(offsetX: -newFrame.minX, contentWidth: newFrame.width)
                        }
                }
            )
        }
        .coordinateSpace(name: "monthly-summary-scroll")
        .background(
            GeometryReader { geometry in
                Color.clear
                    .onAppear { viewportWidth = geometry.size.width }
                    .onChange(of: geometry.size.width) { _, width in viewportWidth = width }
            }
        )
        .overlay(alignment: .trailing) {
            if showMoreHint {
                ScrollMoreHint()
            }
        }
    }

    private func valueRow(_ row: SummaryRow) -> some View {
        GridRow {
            ForEach(columns, id: \.key) { column in
                valueCell(row.value(column.summary), isTotal: column.isTotal)
            }
        }
    }

    private func labelCell(_ text: String) -> some View {
        Text(text)
            .font(.caption)
            .foregroundStyle(.secondary)
            .lineLimit(1)
            .frame(width: labelWidth, height: rowHeight, alignment: .leading)
    }

    private func valueCell(_ text: String, isTotal: Bool, isHeader: Bool = false) -> some View {
        Text(text)
            .font(isHeader || isTotal ? .caption.monospacedDigit().weight(.semibold) : .caption.monospacedDigit())
            .lineLimit(1)
            .frame(height: rowHeight, alignment: .leading)
    }

    private func monthLabel(_ month: AnalyticsInsights.MonthSummary) -> String {
        Self.monthFormatter.string(from: month.monthStart) + (month.isPartial ? "*" : "")
    }
}

// MARK: - Horizontal scroll affordance

/// Offset + content width of a horizontally scrolling table, used to decide
/// whether a "more content" hint should show.
private struct HorizontalScrollMetrics: Equatable {
    var offsetX: CGFloat = 0
    var contentWidth: CGFloat = 0
}

/// Trailing-edge gradient + chevron shown while more columns are off-screen.
private struct ScrollMoreHint: View {
    var body: some View {
        ZStack(alignment: .trailing) {
            LinearGradient(
                colors: [Color(.secondarySystemBackground).opacity(0), Color(.secondarySystemBackground)],
                startPoint: .leading,
                endPoint: .trailing
            )
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
        }
        .frame(width: 32)
        .allowsHitTesting(false)
    }
}

// MARK: - Time of day

struct TimeOfDayChartCard: View {
    let bins: [AnalyticsInsights.TimeOfDayBin]

    private var hasData: Bool {
        bins.contains { $0.count >= 1 }
    }

    var body: some View {
        InsightCard(
            title: "Time of Day",
            subtitle: "When episodes start. Consistent early-morning onset can point at sleep, medication wear-off, or caffeine timing.",
            accessibilityId: "time-of-day-chart"
        ) {
            if !hasData {
                EmptyChartPlaceholder()
            } else {
                Chart(bins) { bin in
                    BarMark(
                        x: .value("Time", bin.label),
                        y: .value("Episodes", bin.count)
                    )
                    .foregroundStyle(Color.accentColor)
                }
                .chartXScale(domain: bins.map(\.label))
                .frame(height: 160)
            }
        }
    }
}

// MARK: - Symptom & pain-location frequency

/// One ranked row in a frequency bar chart.
private struct FrequencyRow: Identifiable {
    let label: String
    let count: Int
    let percent: Double
    var id: String { label }
}

/// Horizontal bar chart of the top frequency rows, most frequent at the top,
/// each annotated with its share of episodes.
private struct FrequencyBarChart: View {
    let rows: [FrequencyRow]
    let color: Color

    var body: some View {
        Chart(rows) { row in
            BarMark(
                x: .value("Episodes", row.count),
                y: .value("Item", row.label)
            )
            .foregroundStyle(color)
            .annotation(position: .trailing, alignment: .leading) {
                Text("\(Int(row.percent.rounded()))%")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
        // Rows are sorted most-frequent first; the first domain entry renders
        // at the top of the axis, so the busiest row sits on top.
        .chartYScale(domain: rows.map(\.label))
        .chartXAxis {
            AxisMarks(values: .automatic(desiredCount: 4)) {
                AxisGridLine()
                AxisValueLabel()
            }
        }
        .frame(height: CGFloat(rows.count) * 30 + 24)
    }
}

struct SymptomFrequencyChartCard: View {
    let frequencies: [AnalyticsInsights.SymptomFrequency]

    /// Cap the chart at the most common handful so it stays readable.
    private var rows: [FrequencyRow] {
        frequencies.prefix(8).map {
            FrequencyRow(label: $0.symptom.displayName, count: $0.episodeCount, percent: $0.percentOfEpisodes)
        }
    }

    var body: some View {
        InsightCard(
            title: "Symptom Frequency",
            subtitle: "Most common symptoms recorded with your episodes in this range, as a share of those episodes.",
            accessibilityId: "symptom-frequency-chart"
        ) {
            if rows.isEmpty {
                EmptyChartPlaceholder()
            } else {
                FrequencyBarChart(rows: rows, color: .accentColor)
            }
        }
    }
}

struct PainLocationFrequencyChartCard: View {
    let frequencies: [AnalyticsInsights.PainLocationFrequency]

    private var rows: [FrequencyRow] {
        frequencies.prefix(8).map {
            FrequencyRow(label: $0.location.displayName, count: $0.episodeCount, percent: $0.percentOfEpisodes)
        }
    }

    var body: some View {
        InsightCard(
            title: "Pain Location Frequency",
            subtitle: "Where pain was recorded most often across your episodes in this range, as a share of those episodes.",
            accessibilityId: "pain-location-frequency-chart"
        ) {
            if rows.isEmpty {
                EmptyChartPlaceholder()
            } else {
                FrequencyBarChart(rows: rows, color: .pink)
            }
        }
    }
}
