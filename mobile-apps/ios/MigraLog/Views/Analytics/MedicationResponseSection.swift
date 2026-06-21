import Charts
import SwiftUI

/// "Med Response" section of the Trends tab (issue #487).
///
/// Compares how quickly each rescue medication brought relief over the
/// selected range: the median time from a dose to the first drop in headache
/// intensity. A medication's median only appears once it clears the
/// minimum-sample gate in `AnalyticsInsights.medicationEffectiveness`, so a
/// comparison never rests on one or two doses. Informational only — not
/// medical advice.
struct MedicationResponseSection: View {
    @Bindable var viewModel: AnalyticsViewModel

    private var meds: [AnalyticsInsights.MedicationEffectiveness] {
        viewModel.medicationEffectiveness
    }

    /// Medications that cleared the gate, fastest median first, for the chart.
    private var reliefMeds: [AnalyticsInsights.MedicationEffectiveness] {
        meds.filter { $0.reliefMedianMinutes != nil }
            .sorted { ($0.reliefMedianMinutes ?? 0) < ($1.reliefMedianMinutes ?? 0) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            if meds.isEmpty {
                MedResponseEmptyState()
            } else {
                if !reliefMeds.isEmpty {
                    ReliefComparisonCard(meds: reliefMeds)
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
            subtitle: "How quickly each rescue medication brought relief, side by side.",
            accessibilityId: "med-response-empty"
        ) {
            Text("No rescue-medication doses in this range yet. Log doses against your episodes — and keep tracking intensity — to compare how fast each one works here.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, minHeight: 60, alignment: .leading)
        }
    }
}

// MARK: - Time-to-relief comparison chart

/// Horizontal bars of each medication's median time to relief, fastest first.
/// Lower is faster.
private struct ReliefComparisonCard: View {
    let meds: [AnalyticsInsights.MedicationEffectiveness]

    var body: some View {
        ResponseCard(
            title: "Time to Relief Compared",
            subtitle: "Median time from a rescue dose to the first drop in headache intensity. Lower is faster.",
            accessibilityId: "med-response-comparison"
        ) {
            Chart(meds) { med in
                if let minutes = med.reliefMedianMinutes {
                    BarMark(
                        x: .value("Time to relief", minutes),
                        y: .value("Medication", med.medicationName)
                    )
                    .foregroundStyle(Color.accentColor)
                    .annotation(position: .trailing, alignment: .leading) {
                        Text(MedResponseFormat.minutes(minutes))
                            .font(.caption2.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                }
            }
            // Fastest median sits at the top (rows are pre-sorted ascending).
            .chartYScale(domain: meds.map(\.medicationName))
            .chartXAxis {
                AxisMarks(values: .automatic(desiredCount: 4)) {
                    AxisGridLine()
                    AxisValueLabel()
                }
            }
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

            HStack(alignment: .firstTextBaseline) {
                Text("Time to relief")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Spacer()
                if let minutes = med.reliefMedianMinutes {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(MedResponseFormat.minutes(minutes))
                            .font(.title3.weight(.semibold).monospacedDigit())
                        Text("median · \(med.reliefDoses) \(med.reliefDoses == 1 ? "dose" : "doses")")
                            .font(.caption2.monospacedDigit())
                            .foregroundStyle(.secondary)
                    }
                } else {
                    Text("Need ≥\(AnalyticsInsights.minimumReliefDoses) doses with relief data")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
            }
            .accessibilityIdentifier("med-response-relief-\(med.medicationId)")
        }
    }
}

// MARK: - Formatting

private enum MedResponseFormat {
    /// Time-to-relief minutes rendered as a duration (e.g. "45m", "2h 15m").
    static func minutes(_ value: Double) -> String {
        DateFormatting.formatDuration(milliseconds: Int64(value.rounded()) * 60_000)
    }
}
