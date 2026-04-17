import SwiftUI

/// Settings screen listing the user's configured medication usage limits.
/// Users add a new limit via the toolbar "+" (or the empty-state button),
/// tap a row to edit, and swipe to delete. At most one limit per category.
struct CategoryLimitsScreen: View {
    @State private var viewModel = CategoryLimitsViewModel()
    @State private var editorMode: CategoryLimitEditorSheet.Mode?

    var body: some View {
        Group {
            if viewModel.limits.isEmpty {
                emptyState
            } else {
                limitsList
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
                .disabled(!viewModel.canAddMoreLimits)
                .accessibilityIdentifier("category-limits-add")
            }
        }
        .sheet(item: $editorMode) { mode in
            CategoryLimitEditorSheet(mode: mode) { limit in
                viewModel.saveLimit(limit)
            }
        }
        .task {
            viewModel.loadLimits()
        }
    }

    // MARK: - Empty state

    private var emptyState: some View {
        ContentUnavailableView {
            Label("No Limits Configured", systemImage: "shield.lefthalf.filled")
        } description: {
            Text("Optional warnings for medication-overuse headache risk. These are informational only — talk to your doctor before relying on them.")
        } actions: {
            Button {
                presentAddSheet()
            } label: {
                Text("Add Limit")
                    .fontWeight(.semibold)
            }
            .buttonStyle(.borderedProminent)
            .accessibilityIdentifier("category-limits-empty-add")
        }
    }

    // MARK: - List

    private var limitsList: some View {
        List {
            Section {
                ForEach(configuredLimitsInOrder) { limit in
                    Button {
                        editorMode = .edit(existing: limit)
                    } label: {
                        limitRow(limit)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("limit-row-\(limit.category.rawValue)")
                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                        Button(role: .destructive) {
                            viewModel.clearLimit(limit.category)
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                        .accessibilityIdentifier("limit-row-delete-\(limit.category.rawValue)")
                    }
                }
            } footer: {
                Text("Informational warnings only — not medical advice. The app will not block you from logging doses. Talk to your doctor about appropriate thresholds. Common guidelines: NSAIDs 15/30, Triptans 10/30.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private func limitRow(_ limit: CategoryUsageLimit) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(limit.category.displayName)
                    .font(.body)
                Text("\(limit.maxDays) days in any \(limit.windowDays) days")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.footnote)
                .foregroundStyle(.tertiary)
        }
        .contentShape(Rectangle())
    }

    // MARK: - Helpers

    private var configuredLimitsInOrder: [CategoryUsageLimit] {
        MedicationCategory.allCases.compactMap { viewModel.limits[$0] }
    }

    private func presentAddSheet() {
        editorMode = .add(available: viewModel.availableCategoriesForAdd)
    }
}

// MARK: - Sheet Identifiable

extension CategoryLimitEditorSheet.Mode: Identifiable {
    var id: String {
        switch self {
        case .add:                 return "__add__"
        case .edit(let existing):  return existing.category.rawValue
        }
    }
}
