import XCTest
@testable import MigraLog

@MainActor
final class DoctorSummaryPDFRendererTests: XCTestCase {
    private func sampleReport(
        headacheDayCount: Int = 9,
        usage: [AnalyticsInsights.MedicationUsage] = [],
        compliance: [AnalyticsInsights.PreventativeCompliance] = []
    ) -> DoctorSummaryReport {
        let now = Date()
        let calendar = Calendar.current
        let start = calendar.date(byAdding: .day, value: -29, to: now)!
        let trendStart = calendar.date(byAdding: .month, value: -5, to: now)!
        let months = AnalyticsInsights.monthlyHeadacheDays(
            headacheDays: [],
            from: trendStart,
            to: now
        ).enumerated().map { index, month in
            AnalyticsInsights.MonthlyHeadacheDays(
                monthStart: month.monthStart,
                headacheDayCount: index * 2,
                isPartial: month.isPartial
            )
        }
        return DoctorSummaryReport(
            generatedAt: now,
            recentStart: start,
            recentEnd: now,
            recentDays: 30,
            headacheDayCount: headacheDayCount,
            episodeCount: 7,
            rescueDayCount: 5,
            monthlyHeadacheDays: months,
            medicationUsage: usage,
            preventativeCompliance: compliance
        )
    }

    func testRenderPDF_producesNonEmptyPDFFile() throws {
        let usage = [
            AnalyticsInsights.MedicationUsage(
                medicationId: "m1", medicationName: "Sumatriptan", category: .triptan,
                doseCount: 6, dayCount: 5, totalAmount: 600, dosageUnit: "mg"
            ),
        ]
        let compliance = [
            AnalyticsInsights.PreventativeCompliance(
                medicationId: "p1", medicationName: "Propranolol",
                expectedDoses: 30, takenDoses: 27, dosesPerDay: 1
            ),
        ]
        let url = try DoctorSummaryPDFRenderer.renderPDF(report: sampleReport(usage: usage, compliance: compliance))
        defer { try? FileManager.default.removeItem(at: url) }

        let data = try Data(contentsOf: url)
        XCTAssertTrue(data.starts(with: Array("%PDF".utf8)), "Output should be a PDF")
        XCTAssertGreaterThan(data.count, 1000, "PDF should have real content")
        XCTAssertEqual(url.pathExtension, "pdf")
    }

    func testRenderPDF_handlesEmptySectionsAndChronicFlag() throws {
        // Chronic range (≥15) plus empty medication/compliance tables must still render.
        let url = try DoctorSummaryPDFRenderer.renderPDF(report: sampleReport(headacheDayCount: 18))
        defer { try? FileManager.default.removeItem(at: url) }

        let data = try Data(contentsOf: url)
        XCTAssertTrue(data.starts(with: Array("%PDF".utf8)))
    }
}
