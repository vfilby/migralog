import Charts
import SwiftUI

/// "Med Response" section of the Trends tab (issue #487).
///
/// Compares how well each rescue medication worked over the selected range:
/// the median + IQR of its effectiveness rating and of its time to relief.
/// A medication's metric only appears once it clears the minimum-sample gate
/// in `AnalyticsInsights.medicationEffectiveness`, so a comparison never rests
/// on one or two doses. Informational only — not medical advice.
struct MedicationResponseSection: View {
    @Bindable var viewModel: AnalyticsViewModel

    private var meds: [AnalyticsInsights.MedicationEffectiveness] {
        viewModel.medicationEffectiveness
    }

    /// Medications that cleared the gate for the effectiveness rating, used for
    /// the at-a-glance comparison chart.
    private var ratedMeds: [AnalyticsInsights.MedicationEffectiveness] {
        meds.filter { $0.rating != nil }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if meds.isEmpty {
                MedResponseEmptyState()
            } else {
                if !ratedMeds.isEmpty {
                    EffectivenessComparisonCard(meds: ratedMeds)
                }
                ForEach(meds) { med in
                    MedicationResponseCard(med: med)
                }
                Text("Informational only — not medical advice.")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .accessibilityIdentifier("med-response-section")
    }
}

// MARK: - Card chrome

private struct ResponseCard<Content: View>: View {
    let title: String
    let subtitle: String?
    let accessibilityId: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)
            if let subtitle {
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .accessibilityIdentifier(accessibilityId)
    }
}

// MARK: - Empty state

private struct MedResponseEmptyState: View {
    var body: some View {
        ResponseCard(
            title: "Medication Response",
            subtitle: "How well each rescue medication worked, side by side.",
            accessibilityId: "med-response-empty"
        ) {
            Text("No rescue-medication doses in this range yet. Log doses against your episodes — and rate how well they worked — to compare medications here.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, minHeight: 60, alignment: .leading)
        }
    }
}

// MARK: - Effectiveness comparison chart

/// Horizontal IQR comparison of effectiveness ratings: a band from Q25 to Q75
/// with a dot at the median, one row per medication. Higher is better.
private struct EffectivenessComparisonCard: View {
    let meds: [AnalyticsInsights.MedicationEffectiveness]

    var body: some View {
        ResponseCard(
            title: "Effectiveness Compared",
            subtitle: "Median rating with its interquartile range (25th–75th percentile). Higher is better; the dot is the median.",
            accessibilityId: "med-response-comparison"
        ) {
            Chart(meds) { med in
                if let rating = med.rating {
                    BarMark(
                        xStart: .value("Q25", rating.q25),
                        xEnd: .value("Q75", rating.q75),
                        y: .value("Medication", med.medicationName),
                        height: 14
                    )
                    .foregroundStyle(Color.accentColor.opacity(0.25))
                    .cornerRadius(4)

                    PointMark(
                        x: .value("Median", rating.median),
                        y: .value("Medication", med.medicationName)
                    )
                    .foregroundStyle(Color.accentColor)
                    .symbolSize(90)
                    .annotation(position: .trailing, alignment: .leading) {
                        Text(MedResponseFormat.rating(rating.median))
                            .font(.caption2.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .chartXScale(domain: 0...10)
            .chartXAxis {
                AxisMarks(values: [0, 2, 4, 6, 8, 10]) {
                    AxisGridLine()
                    AxisValueLabel()
                }
            }
            .chartYScale(domain: meds.map(\.medicationName))
            .frame(height: CGFloat(meds.count) * 40 + 24)
        }
    }
}

// MARK: - Per-medication detail card

private struct MedicationResponseCard: View {
    let med: AnalyticsInsights.MedicationEffectiveness

    var body: some View {
        ResponseCard(
            title: med.medicationName,
            subtitle: nil,
            accessibilityId: "med-response-card-\(med.medicationId)"
        ) {
            HStack(spacing: 8) {
                if let category = med.category {
                    Text(category.displayName)
                        .font(.caption2.weight(.semibold))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color(.tertiarySystemBackground))
                        .clipShape(Capsule())
                }
                Text("\(med.takenDoses) \(med.takenDoses == 1 ? "dose" : "doses")")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.bottom, 4)

            MetricRow(
                label: "Effectiveness",
                summary: med.rating,
                value: { MedResponseFormat.rating($0) },
                range: { "\(MedResponseFormat.rating($0)) – \(MedResponseFormat.rating($1))" },
                hint: "Need ≥\(AnalyticsInsights.minimumEffectivenessDoses) rated doses",
                accessibilityId: "med-response-rating-\(med.medicationId)"
            )

            Divider()

            MetricRow(
                label: "Time to relief",
                summary: med.relief,
                value: { MedResponseFormat.minutes($0) },
                range: { "\(MedResponseFormat.minutes($0)) – \(MedResponseFormat.minutes($1))" },
                hint: "Need ≥\(AnalyticsInsights.minimumEffectivenessDoses) doses with relief data",
                accessibilityId: "med-response-relief-\(med.medicationId)"
            )
        }
    }
}

/// One labeled metric: the median big, IQR + sample size beneath, or a
/// minimum-sample hint when the metric hasn't cleared the gate.
private struct MetricRow: View {
    let label: String
    let summary: AnalyticsInsights.MetricSummary?
    let value: (Double) -> String
    let range: (Double, Double) -> String
    let hint: String
    let accessibilityId: String

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(label)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Spacer()
            if let summary {
                VStack(alignment: .trailing, spacing: 2) {
                    Text(value(summary.median))
                        .font(.title3.weight(.semibold).monospacedDigit())
                    Text("IQR \(range(summary.q25, summary.q75)) · n=\(summary.n)")
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(.secondary)
                }
            } else {
                Text(hint)
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
        .accessibilityIdentifier(accessibilityId)
    }
}

// MARK: - Formatting

private enum MedResponseFormat {
    /// Effectiveness rating on the 0–10 scale, no decimals.
    static func rating(_ value: Double) -> String {
        String(Int(value.rounded()))
    }

    /// Time-to-relief minutes rendered as a duration (e.g. "45m", "2h 15m").
    static func minutes(_ value: Double) -> String {
        DateFormatting.formatDuration(milliseconds: Int64(value.rounded()) * 60_000)
    }
}
