import SwiftUI

/// Modal sheet for adding or editing a single `CategorySafetyRule`.
/// In add mode the user picks a category and a rule type from the supplied
/// (category → addable types) options; the form auto-fills with the category's
/// preset for the chosen type when one exists. In edit mode both category and
/// type are locked.
struct CategorySafetyRuleEditorSheet: View {
    enum Mode: Equatable {
        case add(available: [MedicationCategory: [CategorySafetyRuleType]])
        case edit(existing: CategorySafetyRule)
    }

    let mode: Mode
    let onSave: (CategorySafetyRule) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var selectedCategory: MedicationCategory?
    @State private var selectedType: CategorySafetyRuleType?

    @State private var maxDaysText: String = ""
    @State private var windowDaysText: String = ""
    @State private var cooldownHoursText: String = ""

    var body: some View {
        NavigationStack {
            Form {
                categorySection
                typeSection
                if resolvedType == .periodLimit { periodLimitSection }
                if resolvedType == .cooldown { cooldownSection }
            }
            .navigationTitle(navigationTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .accessibilityIdentifier("rule-editor-cancel")
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .disabled(!isValid)
                        .accessibilityIdentifier("rule-editor-save")
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
                    ForEach(sortedCategories(in: available), id: \.self) { category in
                        Text(category.displayName).tag(Optional(category))
                    }
                }
                .accessibilityIdentifier("rule-editor-category-picker")
                .onChange(of: selectedCategory) { _, _ in
                    selectedType = nil
                    clearFormFields()
                }
            }
        case .edit(let existing):
            Section("Category") {
                Text(existing.category.displayName)
                    .foregroundStyle(.secondary)
            }
        }
    }

    @ViewBuilder
    private var typeSection: some View {
        switch mode {
        case .add(let available):
            if let category = selectedCategory, let types = available[category], !types.isEmpty {
                Section("Rule Type") {
                    Picker("Rule Type", selection: $selectedType) {
                        Text("Select a rule type").tag(CategorySafetyRuleType?.none)
                        ForEach(types, id: \.self) { type in
                            Text(typeDisplayName(type)).tag(Optional(type))
                        }
                    }
                    .accessibilityIdentifier("rule-editor-type-picker")
                    .onChange(of: selectedType) { _, newValue in
                        applyPresetIfAvailable(category: category, type: newValue)
                    }
                }
            }
        case .edit(let existing):
            Section("Rule Type") {
                Text(typeDisplayName(existing.type))
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var periodLimitSection: some View {
        Section {
            LabeledContent("Max days taken") {
                TextField("", text: $maxDaysText, prompt: Text("e.g. 15"))
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.trailing)
                    .accessibilityIdentifier("rule-editor-max-days")
            }
            LabeledContent("In any rolling window of") {
                HStack(spacing: 4) {
                    TextField("", text: $windowDaysText, prompt: Text("e.g. 30"))
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing)
                        .accessibilityIdentifier("rule-editor-window-days")
                    Text("days")
                        .foregroundStyle(.secondary)
                }
            }
            if let warning = periodLimitValidationWarning {
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

    private var cooldownSection: some View {
        Section {
            LabeledContent("Minimum time between doses") {
                HStack(spacing: 4) {
                    TextField("", text: $cooldownHoursText, prompt: Text("e.g. 4"))
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.trailing)
                        .accessibilityIdentifier("rule-editor-cooldown-hours")
                    Text("hours")
                        .foregroundStyle(.secondary)
                }
            }
        } header: {
            Text("Cooldown")
        } footer: {
            Text("Warns when any medication in this category was taken recently. Any medication in the category counts — warnings are informational only.")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - Derived state

    private var navigationTitle: String {
        switch mode {
        case .add: return "Add Rule"
        case .edit(let existing): return existing.category.displayName
        }
    }

    private var resolvedCategory: MedicationCategory? {
        switch mode {
        case .add:                 return selectedCategory
        case .edit(let existing):  return existing.category
        }
    }

    private var resolvedType: CategorySafetyRuleType? {
        switch mode {
        case .add:                 return selectedType
        case .edit(let existing):  return existing.type
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

    private var parsedCooldownHours: Double? {
        guard let v = Double(cooldownHoursText), v > 0 else { return nil }
        return v
    }

    private var periodLimitValidationWarning: String? {
        guard let maxDays = parsedMaxDays, let windowDays = parsedWindowDays else {
            return nil
        }
        return maxDays > windowDays ? "Max days can't exceed the window." : nil
    }

    private var isValid: Bool {
        guard resolvedCategory != nil else { return false }
        switch resolvedType {
        case .none: return false
        case .periodLimit:
            guard let maxDays = parsedMaxDays, let windowDays = parsedWindowDays else { return false }
            return maxDays <= windowDays
        case .cooldown:
            return parsedCooldownHours != nil
        }
    }

    // MARK: - Lifecycle

    private func configureInitialState() {
        if case .edit(let existing) = mode {
            switch existing.type {
            case .periodLimit:
                maxDaysText = String(existing.maxCount ?? 0)
                windowDaysText = String(existing.windowDays)
            case .cooldown:
                cooldownHoursText = formatHours(existing.periodHours)
            }
        }
    }

    private func clearFormFields() {
        maxDaysText = ""
        windowDaysText = ""
        cooldownHoursText = ""
    }

    private func applyPresetIfAvailable(category: MedicationCategory, type: CategorySafetyRuleType?) {
        clearFormFields()
        guard let type else { return }
        switch type {
        case .periodLimit:
            if let preset = category.mohPreset {
                maxDaysText = String(preset.maxDays)
                windowDaysText = String(preset.windowDays)
            }
        case .cooldown:
            if let hours = category.cooldownPreset {
                cooldownHoursText = formatHours(hours)
            }
        }
    }

    private func save() {
        guard let category = resolvedCategory, let type = resolvedType else { return }
        let createdAt: Date
        let id: String
        if case .edit(let existing) = mode {
            createdAt = existing.createdAt
            id = existing.id
        } else {
            createdAt = Date()
            id = UUID().uuidString
        }

        let rule: CategorySafetyRule
        switch type {
        case .periodLimit:
            guard let maxDays = parsedMaxDays, let windowDays = parsedWindowDays,
                  maxDays <= windowDays else { return }
            rule = CategorySafetyRule(
                id: id,
                category: category,
                type: .periodLimit,
                periodHours: Double(windowDays) * 24.0,
                maxCount: maxDays,
                createdAt: createdAt
            )
        case .cooldown:
            guard let hours = parsedCooldownHours else { return }
            rule = CategorySafetyRule(
                id: id,
                category: category,
                type: .cooldown,
                periodHours: hours,
                maxCount: nil,
                createdAt: createdAt
            )
        }

        onSave(rule)
        dismiss()
    }

    // MARK: - Helpers

    private func typeDisplayName(_ type: CategorySafetyRuleType) -> String {
        switch type {
        case .cooldown:    return "Cooldown"
        case .periodLimit: return "Usage limit"
        }
    }

    private func formatHours(_ hours: Double) -> String {
        let rounded = (hours * 10).rounded() / 10
        if rounded.truncatingRemainder(dividingBy: 1) == 0 {
            return String(Int(rounded))
        }
        return String(rounded)
    }

    private func sortedCategories(in available: [MedicationCategory: [CategorySafetyRuleType]]) -> [MedicationCategory] {
        MedicationCategory.allCases.filter { available[$0]?.isEmpty == false }
    }
}

// MARK: - Identifiable (for .sheet(item:) presentation)

extension CategorySafetyRuleEditorSheet.Mode: Identifiable {
    var id: String {
        switch self {
        case .add:                 return "add"
        case .edit(let existing):  return "edit-\(existing.id)"
        }
    }
}
