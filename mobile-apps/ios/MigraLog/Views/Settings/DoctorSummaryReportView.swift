import Charts
import SwiftUI

/// One-page, print-oriented layout of a `DoctorSummaryReport`.
///
/// Sized to a fixed A4 page (it is rendered to PDF, not shown interactively), so
/// it uses fixed point sizes rather than Dynamic Type. `DoctorSummaryPDFRenderer`
/// rasterizes this into a single-page PDF for sharing with a clinician.
struct DoctorSummaryReportView: View {
    let report: DoctorSummaryReport

    /// A4 at 72 dpi.
    static let pageSize = CGSize(width: 595.2, height: 841.8)
    private let pagePadding: CGFloat = 32

    private let ink = Color(hex: "#152233")        // navy
    private let subtle = Color(hex: "#6C757D")     // gray600
    private let hairline = Color(hex: "#E2E5E9")
    private let accent = Color(hex: "#FF552A")      // brand orange
    private let dangerText = Color(hex: "#C62828")

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            header
            recentStats
            trendSection
            usageSection
            complianceSection
            Spacer(minLength: 0)
            footer
        }
        .padding(pagePadding)
        .frame(width: Self.pageSize.width, height: Self.pageSize.height, alignment: .top)
        .background(Color.white)
        .environment(\.colorScheme, .light)
    }

    // MARK: - Header

    private var header: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
                Text("Doctor Visit Summary")
                    .font(.system(size: 24, weight: .bold))
                    .foregroundStyle(ink)
                Text("Reporting period: \(DateFormatting.displayDate(report.recentStart)) – \(DateFormatting.displayDate(report.recentEnd))")
                    .font(.system(size: 11))
                    .foregroundStyle(subtle)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("MigraLog")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(accent)
                Text("Generated \(DateFormatting.displayDate(report.generatedAt))")
                    .font(.system(size: 10))
                    .foregroundStyle(subtle)
            }
        }
    }

    // MARK: - Recent stats

    private var recentStats: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionTitle("Last \(report.recentDays) days at a glance")
            HStack(spacing: 12) {
                statCell(
                    value: "\(report.headacheDayCount)",
                    suffix: "of \(report.recentDays) days",
                    label: "Headache days",
                    emphasized: report.isInChronicRange
                )
                statCell(value: "\(report.episodeCount)", suffix: nil, label: "Episodes logged")
                statCell(value: "\(report.rescueDayCount)", suffix: "of \(report.recentDays) days", label: "Rescue-med days")
            }
            if report.isInChronicRange {
                Text("Headache days are at or above the ≥\(report.chronicThreshold)-day chronic-migraine range (ICHD-3).")
                    .font(.system(size: 10))
                    .foregroundStyle(dangerText)
            }
        }
    }

    private func statCell(value: String, suffix: String?, label: String, emphasized: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(value)
                    .font(.system(size: 30, weight: .bold))
                    .foregroundStyle(emphasized ? dangerText : ink)
                if let suffix {
                    Text(suffix)
                        .font(.system(size: 10))
                        .foregroundStyle(subtle)
                }
            }
            Text(label)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(subtle)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color(hex: "#F8F9FA"))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    // MARK: - Trend

    private var trendSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionTitle("Headache burden — last \(DoctorSummaryReportBuilder.trendMonths) months")
            if report.monthlyHeadacheDays.allSatisfy({ $0.headacheDayCount == 0 }) {
                emptyRow("No headache days recorded in this period.")
            } else {
                Chart(report.monthlyHeadacheDays) { month in
                    BarMark(
                        x: .value("Month", month.monthStart, unit: .month),
                        y: .value("Headache days", month.headacheDayCount),
                        width: .ratio(0.6)
                    )
                    .foregroundStyle(accent.opacity(month.isPartial ? 0.45 : 1))
                    .annotation(position: .top, alignment: .center) {
                        Text("\(month.headacheDayCount)")
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundStyle(ink)
                    }
                    RuleMark(y: .value("Chronic", report.chronicThreshold))
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 3]))
                        .foregroundStyle(dangerText.opacity(0.6))
                }
                .chartXAxis {
                    AxisMarks(values: .stride(by: .month)) { value in
                        AxisValueLabel(format: .dateTime.month(.abbreviated))
                            .font(.system(size: 9))
                    }
                }
                .chartYAxis {
                    AxisMarks(position: .leading) { _ in
                        AxisGridLine()
                        AxisValueLabel().font(.system(size: 9))
                    }
                }
                .frame(height: 150)
                Text("Bars count days with a logged episode or a red day. Dashed line marks the ≥\(report.chronicThreshold)-day chronic-migraine range. Lighter bars are partial months.")
                    .font(.system(size: 9))
                    .foregroundStyle(subtle)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    // MARK: - Medication usage

    private var usageSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionTitle("Acute / rescue medication — last \(report.recentDays) days")
            if report.medicationUsage.isEmpty {
                emptyRow("No rescue medication taken in this period.")
            } else {
                VStack(spacing: 0) {
                    usageHeaderRow
                    ForEach(Array(report.medicationUsage.enumerated()), id: \.element.id) { index, med in
                        usageRow(med, zebra: index.isMultiple(of: 2))
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(hairline, lineWidth: 1))
            }
        }
    }

    private var usageHeaderRow: some View {
        HStack(spacing: 8) {
            Text("Medication").frame(maxWidth: .infinity, alignment: .leading)
            Text("Type").frame(width: 70, alignment: .leading)
            Text("Doses").frame(width: 50, alignment: .trailing)
            Text("Days").frame(width: 50, alignment: .trailing)
            Text("Total").frame(width: 80, alignment: .trailing)
        }
        .font(.system(size: 10, weight: .semibold))
        .foregroundStyle(subtle)
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .background(Color(hex: "#F8F9FA"))
    }

    private func usageRow(_ med: AnalyticsInsights.MedicationUsage, zebra: Bool) -> some View {
        HStack(spacing: 8) {
            Text(med.medicationName)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(ink)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(med.category?.displayName ?? "—")
                .font(.system(size: 10))
                .foregroundStyle(subtle)
                .frame(width: 70, alignment: .leading)
            Text("\(med.doseCount)").frame(width: 50, alignment: .trailing)
            Text("\(med.dayCount)").frame(width: 50, alignment: .trailing)
            Text(MedicationFormatting.formatDosage(amount: med.totalAmount, unit: med.dosageUnit))
                .frame(width: 80, alignment: .trailing)
        }
        .font(.system(size: 11))
        .foregroundStyle(ink)
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(zebra ? Color.white : Color(hex: "#FBFBFC"))
    }

    // MARK: - Preventative compliance

    private var complianceSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            sectionTitle("Preventatives & compliance — last \(report.recentDays) days")
            if report.preventativeCompliance.isEmpty {
                emptyRow("No active scheduled preventatives.")
            } else {
                VStack(spacing: 0) {
                    complianceHeaderRow
                    ForEach(Array(report.preventativeCompliance.enumerated()), id: \.element.id) { index, med in
                        complianceRow(med, zebra: index.isMultiple(of: 2))
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(hairline, lineWidth: 1))
            }
        }
    }

    private var complianceHeaderRow: some View {
        HStack(spacing: 8) {
            Text("Medication").frame(maxWidth: .infinity, alignment: .leading)
            Text("Schedule").frame(width: 90, alignment: .leading)
            Text("Taken / expected").frame(width: 110, alignment: .trailing)
            Text("Adherence").frame(width: 70, alignment: .trailing)
        }
        .font(.system(size: 10, weight: .semibold))
        .foregroundStyle(subtle)
        .padding(.horizontal, 12)
        .padding(.vertical, 7)
        .background(Color(hex: "#F8F9FA"))
    }

    private func complianceRow(_ med: AnalyticsInsights.PreventativeCompliance, zebra: Bool) -> some View {
        let percent = Int(med.percent.rounded())
        let percentColor: Color = percent >= 80 ? Color(hex: "#2E7D32") : (percent >= 50 ? accent : dangerText)
        return HStack(spacing: 8) {
            Text(med.medicationName)
                .font(.system(size: 11, weight: .medium))
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(med.dosesPerDay == 1 ? "Once daily" : "\(med.dosesPerDay)× daily")
                .font(.system(size: 10))
                .foregroundStyle(subtle)
                .frame(width: 90, alignment: .leading)
            Text("\(med.takenDoses) / \(med.expectedDoses)")
                .frame(width: 110, alignment: .trailing)
            Text("\(percent)%")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(percentColor)
                .frame(width: 70, alignment: .trailing)
        }
        .font(.system(size: 11))
        .foregroundStyle(ink)
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(zebra ? Color.white : Color(hex: "#FBFBFC"))
    }

    // MARK: - Footer

    private var footer: some View {
        VStack(alignment: .leading, spacing: 2) {
            Divider().overlay(hairline)
            Text("Generated by MigraLog. Informational only — not medical advice. Headache days and medication-overuse references follow ICHD-3.")
                .font(.system(size: 9))
                .foregroundStyle(subtle)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 4)
        }
    }

    // MARK: - Helpers

    private func sectionTitle(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.system(size: 11, weight: .bold))
            .tracking(0.5)
            .foregroundStyle(ink)
    }

    private func emptyRow(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 11))
            .foregroundStyle(subtle)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(12)
            .background(Color(hex: "#F8F9FA"))
            .clipShape(RoundedRectangle(cornerRadius: 8))
    }
}

// MARK: - PDF rendering

/// Rasterizes `DoctorSummaryReportView` into a single-page A4 PDF on disk.
enum DoctorSummaryPDFRenderer {
    /// Renders `report` to a one-page PDF in the temporary directory and returns
    /// its URL. The file holds plaintext health data — callers must remove it
    /// once the share is complete.
    @MainActor
    static func renderPDF(report: DoctorSummaryReport) throws -> URL {
        let pageSize = DoctorSummaryReportView.pageSize
        let renderer = ImageRenderer(content: DoctorSummaryReportView(report: report))
        renderer.proposedSize = ProposedViewSize(pageSize)

        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("MigraLog-Doctor-Summary.pdf")
        try? FileManager.default.removeItem(at: url)

        var mediaBox = CGRect(origin: .zero, size: pageSize)
        guard let consumer = CGDataConsumer(url: url as CFURL),
              let context = CGContext(consumer: consumer, mediaBox: &mediaBox, nil) else {
            throw DoctorSummaryPDFError.contextCreationFailed
        }

        renderer.render { _, renderInContext in
            context.beginPDFPage(nil)
            renderInContext(context)
            context.endPDFPage()
        }
        context.closePDF()
        return url
    }
}

enum DoctorSummaryPDFError: LocalizedError {
    case contextCreationFailed

    var errorDescription: String? {
        switch self {
        case .contextCreationFailed: return "Could not create the PDF document."
        }
    }
}
