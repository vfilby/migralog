import SwiftUI

/// Reusable button that builds the one-page Doctor Visit Summary PDF and opens
/// the share sheet. Used from both Settings → Backup & Export (as a list row)
/// and the Trends screen (as a prominent button).
///
/// The caller supplies the label via the trailing closure — it receives the
/// in-progress flag so it can swap in a spinner — and may set a `.buttonStyle`
/// on this view; the wrapped `Button` inherits it. The generated PDF is
/// plaintext health data in tmp and is removed as soon as the share sheet
/// closes, matching the JSON export's handling.
struct DoctorSummaryExportButton<Label: View>: View {
    @ViewBuilder var label: (_ isGenerating: Bool) -> Label

    @State private var isGenerating = false
    @State private var pdfURL: URL?
    @State private var showShareSheet = false
    @State private var showError = false
    @State private var errorMessage = ""

    var body: some View {
        Button {
            Task { await generate() }
        } label: {
            label(isGenerating)
        }
        .disabled(isGenerating)
        .sheet(isPresented: $showShareSheet, onDismiss: {
            if let url = pdfURL {
                try? FileManager.default.removeItem(at: url)
                pdfURL = nil
            }
        }) {
            if let url = pdfURL {
                ShareSheet(items: [url])
            }
        }
        .alert("Error", isPresented: $showError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage)
        }
    }

    private func generate() async {
        isGenerating = true
        defer { isGenerating = false }
        do {
            // Build off the main actor (database reads), render on it (ImageRenderer).
            let report = try await Task.detached(priority: .userInitiated) {
                try DoctorSummaryReportBuilder().buildReport()
            }.value
            pdfURL = try await MainActor.run {
                try DoctorSummaryPDFRenderer.renderPDF(report: report)
            }
            showShareSheet = true
        } catch {
            ErrorLogger.shared.logError(error, context: ["component": "DoctorSummaryExportButton", "action": "generate"])
            errorMessage = "Could not generate summary: \(error.localizedDescription)"
            showError = true
        }
    }
}
