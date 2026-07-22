import ActivityKit
import Foundation

/// Lifecycle owner for the active-episode Live Activity (#416).
protocol LiveActivityManaging: Sendable {
    /// Start a Live Activity for a freshly created episode.
    func start(for episode: Episode)
    /// Push the latest surfaced state (intensity, last rescue med) for an episode.
    func refresh(episodeId: String)
    /// Transition to the warm post-episode close, then auto-dismiss.
    func end(episodeId: String, at endTime: Int64)
    /// Immediately dismiss an episode's activity with no close state (e.g. the
    /// episode was deleted).
    func dismiss(episodeId: String)
    /// Reconcile running activities with the source of truth at launch:
    /// dismiss stale/mismatched activities *and* start one for the current
    /// episode if it's missing. Run once per launch — the dismiss step would
    /// otherwise tear down the warm post-episode close on every foreground.
    func reconcileOnLaunch()
    /// Start a Live Activity for the current episode if one isn't already
    /// running. Safe to call on every foreground: it never dismisses an
    /// activity, and `start(for:)` no-ops when disabled or already running.
    /// This is the recovery path for a create-time start that didn't take.
    func ensureActivityForCurrentEpisode()
    /// End every running episode activity immediately (feature turned off).
    func endAll()
}

/// Default implementation. The widget extension only renders the `ContentState`
/// this pushes, so all "what should the activity say" logic lives here. State is
/// rebuilt from the repositories on every change, keeping callers trivial — they
/// just say which episode changed.
///
/// Not actor/`@MainActor` isolated: it holds no mutable state (it queries
/// `Activity.activities` each time) and the ActivityKit APIs it uses are not
/// main-actor bound, so it composes like the other `Sendable` services and its
/// `.shared` default argument is usable from any context.
final class LiveActivityManager: LiveActivityManaging {
    static let shared = LiveActivityManager()

    /// How long the warm post-episode close lingers before the activity is
    /// dismissed. The richer ~2h postdromal recovery check-in is v1.1.
    private let postEpisodeLinger: TimeInterval = 30 * 60

    /// UserDefaults key for the "Live Activities" setting (Phase 4 owns the UI).
    /// Absent defaults to enabled.
    private let settingKey = "live_activities_enabled"

    private let episodeRepository: EpisodeRepositoryProtocol
    private let medicationRepository: MedicationRepositoryProtocol

    init(
        episodeRepository: EpisodeRepositoryProtocol = EpisodeRepository(dbManager: DatabaseManager.shared),
        medicationRepository: MedicationRepositoryProtocol = MedicationRepository(dbManager: DatabaseManager.shared)
    ) {
        self.episodeRepository = episodeRepository
        self.medicationRepository = medicationRepository
    }

    // MARK: - LiveActivityManaging

    func start(for episode: Episode) {
        guard isEnabled, activity(for: episode.id) == nil else { return }
        let attributes = EpisodeActivityAttributes(episodeId: episode.id, startDate: episode.startDate)
        let state = contentState(for: episode.id, endedAt: nil)
        do {
            _ = try Activity.request(
                attributes: attributes,
                content: ActivityContent(state: state, staleDate: nil),
                pushType: nil
            )
        } catch let error as ActivityAuthorizationError {
            // ActivityKit declined the start. Every code here is an environmental
            // or user-configuration condition — the app wasn't visible/foreground
            // at request time (`.visibility`), the user disabled Live Activities
            // (`.denied`), a system limit was hit, etc. — not a bug. The recovery
            // path (`ensureActivityForCurrentEpisode()`) retries on the next
            // foreground, so log locally for diagnostics but don't report it to
            // Sentry as an error (#572).
            AppLogger.shared.warn(
                "Live Activity start declined by ActivityKit",
                context: ["service": "LiveActivityManager", "code": "\(error)"]
            )
        } catch {
            ErrorLogger.shared.logError(error, context: ["service": "LiveActivityManager", "action": "start"])
        }
    }

    func refresh(episodeId: String) {
        guard let activity = activity(for: episodeId) else { return }
        let state = contentState(for: episodeId, endedAt: nil)
        Task { await activity.update(ActivityContent(state: state, staleDate: nil)) }
    }

    func end(episodeId: String, at endTime: Int64) {
        guard let activity = activity(for: episodeId) else { return }
        let endedAt = Date(timeIntervalSince1970: Double(endTime) / 1000.0)
        let state = contentState(for: episodeId, endedAt: endedAt)
        let dismissAt = Date().addingTimeInterval(postEpisodeLinger)
        Task {
            await activity.end(
                ActivityContent(state: state, staleDate: nil),
                dismissalPolicy: .after(dismissAt)
            )
        }
    }

    func dismiss(episodeId: String) {
        guard let activity = activity(for: episodeId) else { return }
        Task { await activity.end(nil, dismissalPolicy: .immediate) }
    }

    func reconcileOnLaunch() {
        let current: Episode?
        do {
            current = try episodeRepository.getCurrentEpisode()
        } catch {
            // Couldn't determine the active episode — leave any running activity
            // alone rather than dismissing a possibly-valid one on a transient read.
            ErrorLogger.shared.logError(error, context: ["service": "LiveActivityManager", "action": "reconcileOnLaunch"])
            return
        }
        // Dismiss any activity that isn't the current episode's (e.g. an orphan
        // left by a force-quit, or a stale warm close with no active episode).
        for activity in Activity<EpisodeActivityAttributes>.activities
        where activity.attributes.episodeId != current?.id {
            Task { await activity.end(nil, dismissalPolicy: .immediate) }
        }
        if let current { start(for: current) }
    }

    func ensureActivityForCurrentEpisode() {
        let current: Episode?
        do {
            current = try episodeRepository.getCurrentEpisode()
        } catch {
            ErrorLogger.shared.logError(error, context: ["service": "LiveActivityManager", "action": "ensureActivityForCurrentEpisode"])
            return
        }
        // `start(for:)` is a no-op when activities are disabled or one is already
        // running for this episode, so this only ever *adds* a missing activity —
        // never dismisses one. That makes it safe on every foreground.
        if let current { start(for: current) }
    }

    func endAll() {
        for activity in Activity<EpisodeActivityAttributes>.activities {
            Task { await activity.end(nil, dismissalPolicy: .immediate) }
        }
    }

    // MARK: - Helpers

    private var isEnabled: Bool {
        // Never touch ActivityKit from the unit-test host.
        guard NSClassFromString("XCTestCase") == nil else { return false }
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return false }
        return UserDefaults.standard.object(forKey: settingKey) as? Bool ?? true
    }

    private func activity(for episodeId: String) -> Activity<EpisodeActivityAttributes>? {
        Activity<EpisodeActivityAttributes>.activities.first { $0.attributes.episodeId == episodeId }
    }

    /// Generic stand-in shown instead of a medication's name when the user has
    /// turned off "Show Medication Names" — keeps the Lock Screen from revealing
    /// the specific drug while still surfacing that a rescue dose was taken.
    static let genericRescueName = "Rescue medication"

    private func contentState(
        for episodeId: String,
        endedAt: Date?
    ) -> EpisodeActivityAttributes.ContentState {
        let readings = (try? episodeRepository.getReadingsByEpisodeId(episodeId)) ?? []
        let intensity = readings.max { $0.timestamp < $1.timestamp }?.intensity
        let lastRescue = latestRescueDose(episodeId: episodeId)
        // Beta post-drome tracking: surface the recovery phase so the activity
        // reads "post-drome" instead of an active attack.
        let postdromeStartAt = (try? episodeRepository.getEpisodeById(episodeId))?.postdromeStartDate
        return Self.makeContentState(
            intensity: intensity,
            rescue: lastRescue,
            showMedicationNames: showMedicationNames,
            endedAt: endedAt,
            postdromeStartAt: postdromeStartAt
        )
    }

    /// Pure assembly of the activity content, split out for testability. When
    /// `showMedicationNames` is false the specific drug name is replaced with a
    /// generic label, mirroring how medication notifications hide names.
    static func makeContentState(
        intensity: Double?,
        rescue: (name: String, takenAt: Date)?,
        showMedicationNames: Bool,
        endedAt: Date?,
        postdromeStartAt: Date? = nil
    ) -> EpisodeActivityAttributes.ContentState {
        EpisodeActivityAttributes.ContentState(
            currentIntensity: intensity,
            lastRescueMedName: rescue.map { showMedicationNames ? $0.name : genericRescueName },
            lastRescueMedAt: rescue?.takenAt,
            endedAt: endedAt,
            postdromeStartAt: postdromeStartAt
        )
    }

    /// Honour the existing "Show Medication Names" privacy setting on the Lock
    /// Screen (shared key with medication notifications).
    private var showMedicationNames: Bool {
        UserDefaults.standard.object(forKey: "notification_show_medication_names") as? Bool ?? true
    }

    /// The most recent rescue-category dose taken during the episode, if any.
    private func latestRescueDose(episodeId: String) -> (name: String, takenAt: Date)? {
        guard let doses = try? medicationRepository.getDosesByEpisodeId(episodeId) else { return nil }
        let rescue = doses
            .filter { $0.status == .taken }
            .compactMap { dose -> (MedicationDose, Medication)? in
                guard let med = try? medicationRepository.getMedicationById(dose.medicationId),
                      med.isRescue else { return nil }
                return (dose, med)
            }
        guard let latest = rescue.max(by: { $0.0.timestamp < $1.0.timestamp }) else { return nil }
        return (latest.1.name, Date(timeIntervalSince1970: Double(latest.0.timestamp) / 1000.0))
    }
}

extension Medication {
    /// Whether this medication counts as a "rescue" treatment for the Live
    /// Activity's last-dose readout: anything the user typed as a rescue med, or
    /// categorised as an NSAID/triptan even if typed otherwise.
    var isRescue: Bool {
        type == .rescue || category == .nsaid || category == .triptan
    }
}
