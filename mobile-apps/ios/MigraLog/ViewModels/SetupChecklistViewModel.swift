import Foundation
import Observation

/// A one-time setup action shown in the dashboard checklist (in the space where
/// the episode list will eventually live).
enum SetupTask: String, CaseIterable, Identifiable {
    case addRescue
    case addPreventative

    var id: String { rawValue }

    var title: String {
        switch self {
        case .addRescue: return "Add your rescue meds"
        case .addPreventative: return "Add a preventative"
        }
    }

    var detail: String {
        switch self {
        case .addRescue: return "Log a dose in one tap when an attack hits."
        case .addPreventative: return "Set a schedule to get reminders and track adherence."
        }
    }

    var icon: String {
        switch self {
        case .addRescue: return "cross.case"
        case .addPreventative: return "pills"
        }
    }

    /// The medication type to preselect when this task opens the add-med screen.
    var medicationType: MedicationType {
        switch self {
        case .addRescue: return .rescue
        case .addPreventative: return .preventative
        }
    }
}

/// Backs the dashboard setup checklist. Completion is derived from the user's
/// medications; each task can also be individually dismissed ("not applicable"),
/// since plenty of people only take rescue meds and would never check off a
/// preventative. The card hides once no task remains to show.
@MainActor
@Observable
final class SetupChecklistViewModel {
    private(set) var hasRescue = false
    private(set) var hasPreventative = false
    private(set) var hasLoaded = false

    private let medicationRepository: MedicationRepositoryProtocol
    private let defaults: UserDefaults

    private var dismissed: Set<String>
    private static let dismissedKey = "setupChecklist.dismissedTasks"

    init(
        medicationRepository: MedicationRepositoryProtocol = MedicationRepository(dbManager: DatabaseManager.shared),
        defaults: UserDefaults = .standard
    ) {
        self.medicationRepository = medicationRepository
        self.defaults = defaults
        self.dismissed = Set(defaults.stringArray(forKey: Self.dismissedKey) ?? [])
    }

    func refresh() {
        do {
            let activeMeds = try medicationRepository.getActiveMedications()
            hasRescue = activeMeds.contains { $0.type == .rescue }
            hasPreventative = activeMeds.contains { $0.type == .preventative }
        } catch {
            ErrorLogger.shared.logError(
                error,
                context: ["viewModel": "SetupChecklistViewModel", "action": "refresh"]
            )
        }
        hasLoaded = true
    }

    func isCompleted(_ task: SetupTask) -> Bool {
        switch task {
        case .addRescue: return hasRescue
        case .addPreventative: return hasPreventative
        }
    }

    func isDismissed(_ task: SetupTask) -> Bool { dismissed.contains(task.id) }

    /// Tasks still worth showing: not done and not dismissed.
    var visibleTasks: [SetupTask] {
        SetupTask.allCases.filter { !isCompleted($0) && !isDismissed($0) }
    }

    var shouldShow: Bool { hasLoaded && !visibleTasks.isEmpty }

    func dismiss(_ task: SetupTask) {
        dismissed.insert(task.id)
        defaults.set(Array(dismissed), forKey: Self.dismissedKey)
    }
}
