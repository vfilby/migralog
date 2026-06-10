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
        VStack(alignment: .leading, spacing: 16) {
            WarningCalloutsCard(warnings: viewModel.insightWarnings)
            HeadacheBurdenChartCard(points: viewModel.headacheDayTrend)
            MedicationOveruseChartCard(series: viewModel.intakeSeries)
            SeverityDistributionChartCard(counts: viewModel.severityWeekCounts)
            TimeOfDayChartCard(bins: viewModel.timeOfDayBins)
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
        VStack(alignment: .leading, spacing: 8) {
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
        .clipShape(RoundedRectangle(cornerRadius: 12))
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
        VStack(alignment: .leading, spacing: 12) {
            Text("Warning Signs")
                .font(.headline)

            if warnings.isEmpty {
                HStack(spacing: 8) {
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
        .clipShape(RoundedRectangle(cornerRadius: 12))
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

    private static let classColors: [String: Color] = [
        AnalyticsInsights.AcuteMedClass.triptanLike.displayName: .blue,
        AnalyticsInsights.AcuteMedClass.simpleAnalgesic.displayName: .teal,
    ]

    private var hasData: Bool {
        series.contains { classSeries in classSeries.points.contains { $0.count >= 1 } }
    }

    private var yMax: Int {
        let maxCount = series.flatMap { $0.points.map(\.count) }.max() ?? 0
        return max(17, maxCount + 2)
    }

    var body: some View {
        InsightCard(
            title: "Medication Overuse Risk",
            subtitle: "Days with a rescue dose in the trailing 28 days — counted in days, not doses. Guidelines: under 10 days for triptans/CGRP, under 15 for OTC/NSAID.",
            accessibilityId: "moh-chart"
        ) {
            if !hasData {
                EmptyChartPlaceholder()
            } else {
                Chart {
                    ForEach(series) { classSeries in
                        ForEach(classSeries.points) { point in
                            LineMark(
                                x: .value("Date", point.date),
                                y: .value("Days", point.count)
                            )
                            .interpolationMethod(.monotone)
                        }
                        .foregroundStyle(by: .value("Class", classSeries.medClass.displayName))
                    }
                    RuleMark(y: .value("Triptan/CGRP guideline", AnalyticsInsights.AcuteMedClass.triptanLike.overuseThresholdDays))
                        .foregroundStyle(.blue.opacity(0.5))
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                    RuleMark(y: .value("OTC/NSAID guideline", AnalyticsInsights.AcuteMedClass.simpleAnalgesic.overuseThresholdDays))
                        .foregroundStyle(.teal.opacity(0.5))
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 4]))
                }
                .chartForegroundStyleScale { (name: String) in
                    Self.classColors[name] ?? .gray
                }
                .chartYScale(domain: 0...yMax)
                .frame(height: 180)
            }
        }
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
