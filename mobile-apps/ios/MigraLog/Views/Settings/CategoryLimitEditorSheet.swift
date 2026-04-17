import SwiftUI

/// Modal sheet for adding or editing a single `CategoryUsageLimit`.
/// In add mode the user picks a category from the supplied list and the fields
/// auto-fill with the category's `mohPreset` if one exists. In edit mode the
/// category is locked and the fields are pre-populated from the existing limit.
struct CategoryLimitEditorSheet: View {
    enum Mode: Equatable {
        case add(available: [MedicationCategory])
        case edit(existing: CategoryUsageLimit)
    }

    let mode: Mode
    let onSave: (CategoryUsageLimit) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var selectedCategory: MedicationCategory?
    @State private var maxDaysText: String = ""
    @State private var windowDaysText: String = ""

    var body: some View {
        NavigationStack {
            Form {
                categorySection
                limitSection
            }
            .navigationTitle(navigationTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .accessibilityIdentifier("limit-editor-cancel")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(!isValid)
                        .accessibilityIdentifier("limit-editor-save")
                }
            }
            .onAppear(perform: configureInitialState)
            .presentationDetents([.medium])
        }
    }

    // MARK: - Sections

    @ViewBuilder
    private var categorySection: some View {
        switch mode {
        case .add(let available):
            Section("Category") {
                Picker("Category", selection: $selectedCategory) {
                    Text("Select a category").tag(MedicationCategory?.none)
                    ForEach(available) { category in
                        Text(category.displayName).tag(Optional(category))
                    }
                }
                .accessibilityIdentifier("limit-editor-category-picker")
                .onChange(of: selectedCategory) { _, newValue in
                    applyPresetIfAvailable(for: newValue)
                }
            }
        case .edit(let existing):
            Section("Category") {
                Text(existing.category.displayName)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var limitSection: some View {
        Section {
            TextField("Max days", text: $maxDaysText)
                .keyboardType(.numberPad)
                .accessibilityIdentifier("limit-editor-max-days")

            TextField("Window (days)", text: $windowDaysText)
                .keyboardType(.numberPad)
                .accessibilityIdentifier("limit-editor-window-days")

            if let warning = validationWarning {
                Text(warning)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }
        } header: {
            Text("Limit")
        } footer: {
            Text("Based on common MOH (medication overuse headache) guidelines — informational only. Talk to your doctor about thresholds appropriate for your situation. This app does not provide medical advice.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - State / actions

    private var navigationTitle: String {
        switch mode {
        case .add: return "Add Limit"
        case .edit(let existing): return existing.category.displayName
        }
    }

    private var parsedMaxDays: Int? {
        guard let v = Int(maxDaysText), v > 0 else { return nil }
        return v
    }

    private var parsedWindowDays: Int? {
        guard let v = Int(windowDaysText), v > 0 else { return nil }
        return v
    }

    private var resolvedCategory: MedicationCategory? {
        switch mode {
        case .add:                 return selectedCategory
        case .edit(let existing):  return existing.category
        }
    }

    private var isValid: Bool {
        guard resolvedCategory != nil,
              let maxDays = parsedMaxDays,
              let windowDays = parsedWindowDays else {
            return false
        }
        return maxDays <= windowDays
    }

    private var validationWarning: String? {
        guard let maxDays = parsedMaxDays, let windowDays = parsedWindowDays else {
            return nil
        }
        return maxDays > windowDays ? "Max days can't exceed the window." : nil
    }

    private func configureInitialState() {
        if case .edit(let existing) = mode {
            maxDaysText = String(existing.maxDays)
            windowDaysText = String(existing.windowDays)
        }
    }

    // Re-selecting a category (or selecting a new one) re-applies its preset,
    // overwriting any user edits. Intentional: treats picker changes as a
    // reset. Cancel is always available if the user wants to abandon.
    private func applyPresetIfAvailable(for category: MedicationCategory?) {
        guard case .add = mode, let category, let preset = category.mohPreset else {
            return
        }
        maxDaysText = String(preset.maxDays)
        windowDaysText = String(preset.windowDays)
    }

    private func save() {
        guard let category = resolvedCategory,
              let maxDays = parsedMaxDays,
              let windowDays = parsedWindowDays,
              maxDays <= windowDays else {
            return
        }
        let limit = CategoryUsageLimit(
            category: category,
            maxDays: maxDays,
            windowDays: windowDays
        )
        onSave(limit)
        dismiss()
    }
}

// MARK: - Identifiable (for .sheet(item:) presentation)

extension CategoryLimitEditorSheet.Mode: Identifiable {
    var id: String {
        switch self {
        case .add:                 return "add"
        case .edit(let existing):  return "edit-\(existing.category.rawValue)"
        }
    }
}
