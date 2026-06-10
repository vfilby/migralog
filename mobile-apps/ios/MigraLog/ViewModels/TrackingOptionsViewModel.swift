import Foundation
import Observation

/// View model for the customizable tracking pick lists (pain qualities,
/// symptoms, triggers). Backs both the episode-entry pickers (via the
/// `active*` lists) and the Settings → Tracking Options management screen
/// (via `rows(for:)` + mutations).
@Observable
@MainActor
final class TrackingOptionsViewModel {
    /// Values offered in pickers: visible built-ins in canonical order,
    /// then visible custom options. Defaults to the built-ins so pickers
    /// render sensibly before (or without) a successful load.
    var activeQualities: [PainQuality] = PainQuality.allCases
    var activeSymptoms: [Symptom] = Symptom.allCases
    var activeTriggers: [Trigger] = Trigger.allCases

    var error: String?

    /// All override/custom rows, for the management screen.
    private var options: [TrackingOption] = []

    private let repository: TrackingOptionRepositoryProtocol

    init(
        repository: TrackingOptionRepositoryProtocol = TrackingOptionRepository(dbManager: DatabaseManager.shared)
    ) {
        self.repository = repository
    }

    // MARK: - Loading

    func load() {
        do {
            options = try repository.getAllOptions()
            activeQualities = try repository.getActiveValues(category: .painQuality).map(PainQuality.init(rawValue:))
            activeSymptoms = try repository.getActiveValues(category: .symptom).map(Symptom.init(rawValue:))
            activeTriggers = try repository.getActiveValues(category: .trigger).map(Trigger.init(rawValue:))
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "TrackingOptionsViewModel", "action": "load"])
            self.error = error.localizedDescription
        }
    }

    // MARK: - Management Rows

    /// One row per option shown on the management screen: every built-in
    /// (with its current visibility), then the custom options.
    struct OptionRow: Identifiable {
        let value: String
        let displayName: String
        let isBuiltIn: Bool
        let isHidden: Bool
        /// `tracking_options` row id — nil for built-ins without an override.
        let optionId: String?

        var id: String { value }
    }

    func rows(for category: TrackingOptionCategory) -> [OptionRow] {
        let categoryOptions = options.filter { $0.category == category }
        let overridesByValue = Dictionary(
            uniqueKeysWithValues: categoryOptions.filter(\.isBuiltIn).map { ($0.value, $0) }
        )
        let builtIns = category.builtInValues.map { value in
            OptionRow(
                value: value,
                displayName: category.displayName(forValue: value),
                isBuiltIn: true,
                isHidden: overridesByValue[value]?.isHidden ?? false,
                optionId: overridesByValue[value]?.id
            )
        }
        let customs = categoryOptions
            .filter { !$0.isBuiltIn }
            .map { option in
                OptionRow(
                    value: option.value,
                    displayName: option.displayName,
                    isBuiltIn: false,
                    isHidden: option.isHidden,
                    optionId: option.id
                )
            }
        return builtIns + customs
    }

    // MARK: - Suggestions

    struct Suggestion: Identifiable {
        let value: String
        let displayName: String

        var id: String { value }
    }

    /// Catalog values offered via autocomplete when adding to `category`:
    /// every suggested value not already present (as an active built-in,
    /// override or custom row), filtered by `query` (case-insensitive
    /// substring on the display name; empty query returns all).
    func suggestions(for category: TrackingOptionCategory, query: String) -> [Suggestion] {
        let taken = Set(
            (category.builtInValues + options.filter { $0.category == category }.map(\.value))
                .map { $0.lowercased() }
        )
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        return category.suggestedValues
            .filter { !taken.contains($0.lowercased()) }
            .map { Suggestion(value: $0, displayName: category.displayName(forValue: $0)) }
            .filter {
                trimmed.isEmpty
                    || $0.displayName.localizedCaseInsensitiveContains(trimmed)
                    || $0.value.localizedCaseInsensitiveContains(trimmed)
            }
    }

    // MARK: - Mutations

    /// Adds a custom option. Returns true on success; on a duplicate or
    /// empty name, sets `error` and returns false.
    @discardableResult
    func addCustomOption(category: TrackingOptionCategory, value: String) -> Bool {
        do {
            try repository.addCustomOption(category: category, value: value)
            load()
            return true
        } catch TrackingOptionError.duplicateValue {
            error = "\"\(value.trimmingCharacters(in: .whitespacesAndNewlines))\" already exists."
            return false
        } catch TrackingOptionError.emptyValue {
            error = "Enter a name for the option."
            return false
        } catch {
            ErrorLogger.shared.logError(
                error,
                context: ["viewModel": "TrackingOptionsViewModel", "action": "addCustomOption"]
            )
            self.error = error.localizedDescription
            return false
        }
    }

    func setHidden(category: TrackingOptionCategory, value: String, hidden: Bool) {
        do {
            try repository.setHidden(category: category, value: value, hidden: hidden)
            load()
        } catch {
            ErrorLogger.shared.logError(
                error,
                context: ["viewModel": "TrackingOptionsViewModel", "action": "setHidden"]
            )
            self.error = error.localizedDescription
        }
    }

    /// Deletes a custom option. Episodes that already reference the value
    /// keep it; only the pick-list entry is removed.
    func deleteCustomOption(_ row: OptionRow) {
        guard !row.isBuiltIn, let optionId = row.optionId else { return }
        do {
            try repository.deleteCustomOption(id: optionId)
            load()
        } catch {
            ErrorLogger.shared.logError(
                error,
                context: ["viewModel": "TrackingOptionsViewModel", "action": "deleteCustomOption"]
            )
            self.error = error.localizedDescription
        }
    }
}
