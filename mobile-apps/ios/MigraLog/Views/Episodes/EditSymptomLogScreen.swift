import SwiftUI

struct EditSymptomLogScreen: View {
    let log: SymptomLog
    @Bindable var viewModel: EpisodeDetailViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var onsetDate: Date
    @State private var hasResolution: Bool
    @State private var resolutionDate: Date
    @State private var hasSeverity: Bool
    @State private var severity: Double
    @State private var isSaving = false
    @State private var showValidationAlert = false

    init(log: SymptomLog, viewModel: EpisodeDetailViewModel) {
        self.log = log
        self.viewModel = viewModel
        _onsetDate = State(initialValue: Date(timeIntervalSince1970: Double(log.onsetTime) / 1000.0))
        _hasResolution = State(initialValue: log.resolutionTime != nil)
        _resolutionDate = State(initialValue: log.resolutionTime.map { Date(timeIntervalSince1970: Double($0) / 1000.0) } ?? Date())
        _hasSeverity = State(initialValue: log.severity != nil)
        _severity = State(initialValue: log.severity ?? 5.0)
    }

    var body: some View {
        Form {
            Section("Symptom") {
                Text(log.symptom.displayName)
            }

            Section("Onset Time") {
                DatePicker("Onset", selection: $onsetDate)
                    .accessibilityIdentifier("symptom-onset-picker")
            }

            Section("Resolution Time") {
                Toggle("Has resolution", isOn: $hasResolution)
                    .accessibilityIdentifier("symptom-resolution-toggle")
                if hasResolution {
                    DatePicker("Resolution", selection: $resolutionDate)
                        .accessibilityIdentifier("symptom-resolution-picker")
                }
            }

            Section("Severity") {
                Toggle("Rate severity", isOn: $hasSeverity)
                    .accessibilityIdentifier("symptom-severity-toggle")
                if hasSeverity {
                    VStack {
                        Text(String(format: "%.0f", severity))
                            .font(.title3.weight(.bold))
                        Slider(value: $severity, in: 0...10, step: 1)
                            .accessibilityIdentifier("symptom-severity-slider")
                    }
                }
            }
        }
        .navigationTitle("Edit Symptom")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("Cancel") { dismiss() }
            }
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    Task { await save() }
                }
                .disabled(isSaving)
            }
        }
        .alert("Invalid Times", isPresented: $showValidationAlert) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Resolution time must be after onset time.")
        }
    }

    private func save() async {
        if hasResolution && resolutionDate <= onsetDate {
            showValidationAlert = true
            return
        }

        isSaving = true
        defer { isSaving = false }

        var updated = log
        updated.onsetTime = TimestampHelper.fromDate(onsetDate)
        updated.resolutionTime = hasResolution ? TimestampHelper.fromDate(resolutionDate) : nil
        updated.severity = hasSeverity ? severity : nil
        await viewModel.updateSymptomLog(updated)
        dismiss()
    }
}
