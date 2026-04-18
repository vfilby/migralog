import SwiftUI

/// Settings screen listing the user's configured medication safety rules
/// (cooldowns and period-limits). A category can have up to one of each; each
/// rule is its own row. Tap a row to edit; swipe to delete that rule. Add via
/// the toolbar "+".
struct CategorySafetyRulesScreen: View {
    @State private var viewModel = CategorySafetyRulesViewModel()
    @State private var editorMode: CategorySafetyRuleEditorSheet.Mode?

    var body: some View {
        Group {
            if viewModel.rules.isEmpty {
                emptyState
            } else {
                rulesList
            }
        }
        .navigationTitle("Medication Safety Limits")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    presentAddSheet()
                } label: {
                    Image(systemName: "plus")
                }
                .disabled(!viewModel.canAddMoreRules)
                .accessibilityIdentifier("category-rules-add")
            }
        }
        .sheet(item: $editorMode) { mode in
            CategorySafetyRuleEditorSheet(mode: mode) { rule in
                viewModel.saveRule(rule)
            }
        }
        .task {
            viewModel.loadRules()
        }
    }

    // MARK: - Empty state

    private var emptyState: some View {
        ContentUnavailableView {
            Label("No Rules Configured", systemImage: "shield.lefthalf.filled")
        } description: {
            Text("Optional warnings for medication-overuse headache risk and minimum dose spacing. These are informational only — talk to your doctor before relying on them.")
        } actions: {
            Button {
                presentAddSheet()
            } label: {
                Text("Add Rule")
                    .fontWeight(.semibold)
            }
            .buttonStyle(.borderedProminent)
            .accessibilityIdentifier("category-rules-empty-add")
        }
    }

    // MARK: - List

    private var rulesList: some View {
        List {
            Section {
                ForEach(viewModel.rules) { rule in
                    Button {
                        editorMode = .edit(existing: rule)
                    } label: {
                        ruleRow(rule)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("rule-row-\(rule.id)")
                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                        Button(role: .destructive) {
                            viewModel.deleteRule(id: rule.id)
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                        .accessibilityIdentifier("rule-row-delete-\(rule.id)")
                    }
                }
            } footer: {
                Text("Informational warnings only — not medical advice. The app will not block you from logging doses. Talk to your doctor about appropriate thresholds. Common guidelines: NSAIDs 15/30 days, Triptans 10/30 days and 2 h between doses.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func ruleRow(_ rule: CategorySafetyRule) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(rule.category.displayName)
                    .font(.body)
                Text(summary(for: rule))
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.footnote)
                .foregroundStyle(.tertiary)
                .accessibilityHidden(true)
        }
        .contentShape(Rectangle())
    }

    // MARK: - Helpers

    private func summary(for rule: CategorySafetyRule) -> String {
        switch rule.type {
        case .periodLimit:
            let maxDays = rule.maxCount ?? 0
            return "\(maxDays) days in any \(rule.windowDays) days"
        case .cooldown:
            return "\(formatHours(rule.periodHours)) between doses"
        }
    }

    private func formatHours(_ hours: Double) -> String {
        if hours.truncatingRemainder(dividingBy: 1) == 0 {
            return "\(Int(hours))h"
        }
        return String(format: "%.1fh", hours)
    }

    private func presentAddSheet() {
        let available = Dictionary(
            uniqueKeysWithValues: viewModel.addableCategories.map { category in
                (category, viewModel.addableTypes(for: category))
            }
        )
        editorMode = .add(available: available)
    }
}
