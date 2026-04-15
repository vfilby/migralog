import SwiftUI

/// Configuration screen for per-category medication usage limits used to warn
/// about MOH (medication overuse headache) risk.
struct CategoryLimitsScreen: View {
    @State private var viewModel = CategoryLimitsViewModel()

    var body: some View {
        Form {
            ForEach(MedicationCategory.allCases) { category in
                CategoryLimitSection(
                    category: category,
                    existing: viewModel.limits[category],
                    onSave: { maxDays, windowDays in
                        let limit = CategoryUsageLimit(
                            category: category,
                            maxDays: maxDays,
                            windowDays: windowDays
                        )
                        viewModel.saveLimit(limit)
                    },
                    onClear: {
                        viewModel.clearLimit(category)
                    }
                )
            }

            Section {
                EmptyView()
            } footer: {
                Text("These limits are informational warnings only — they are not medical advice. The app will not block you from logging doses. Talk to your doctor about appropriate thresholds for your situation. Common examples: NSAIDs 15 days / 30 days, Triptans 10 days / 30 days.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("Medication Safety Limits")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            viewModel.loadLimits()
        }
    }
}

// MARK: - Per-Category Section

private struct CategoryLimitSection: View {
    let category: MedicationCategory
    let existing: CategoryUsageLimit?
    let onSave: (Int, Int) -> Void
    let onClear: () -> Void

    @State private var maxDaysText: String = ""
    @State private var windowDaysText: String = ""
    @FocusState private var maxDaysFocused: Bool
    @FocusState private var windowDaysFocused: Bool

    var body: some View {
        Section(category.displayName) {
            TextField("Max days", text: $maxDaysText)
                .keyboardType(.numberPad)
                .focused($maxDaysFocused)
                .accessibilityIdentifier("max-days-\(category.rawValue)")
                .onChange(of: maxDaysFocused) { _, focused in
                    if !focused { commitIfValid() }
                }

            TextField("Window (days)", text: $windowDaysText)
                .keyboardType(.numberPad)
                .focused($windowDaysFocused)
                .accessibilityIdentifier("window-days-\(category.rawValue)")
                .onChange(of: windowDaysFocused) { _, focused in
                    if !focused { commitIfValid() }
                }

            HStack {
                Button("Save") {
                    commitIfValid()
                }
                .disabled(!hasValidInput)
                .accessibilityIdentifier("save-limit-\(category.rawValue)")

                Spacer()

                if existing != nil {
                    Button("Clear", role: .destructive) {
                        onClear()
                        maxDaysText = ""
                        windowDaysText = ""
                    }
                    .accessibilityIdentifier("clear-limit-\(category.rawValue)")
                }
            }
        }
        .onAppear {
            if let e = existing {
                maxDaysText = String(e.maxDays)
                windowDaysText = String(e.windowDays)
            }
        }
        .onChange(of: existing) { _, new in
            if let e = new {
                maxDaysText = String(e.maxDays)
                windowDaysText = String(e.windowDays)
            }
        }
    }

    private var hasValidInput: Bool {
        guard let maxDays = Int(maxDaysText), maxDays > 0 else { return false }
        guard let windowDays = Int(windowDaysText), windowDays > 0 else { return false }
        return maxDays <= windowDays
    }

    private func commitIfValid() {
        guard let maxDays = Int(maxDaysText), maxDays > 0 else { return }
        guard let windowDays = Int(windowDaysText), windowDays > 0 else { return }
        guard maxDays <= windowDays else { return }
        onSave(maxDays, windowDays)
    }
}
