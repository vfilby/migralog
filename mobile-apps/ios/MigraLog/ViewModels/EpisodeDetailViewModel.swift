import Foundation
import Observation

@Observable
final class EpisodeDetailViewModel {
    // MARK: - State

    var details: EpisodeWithDetails?
    var episodeDoses: [DoseWithMedication] = []
    var isLoading = false
    var error: String?

    // MARK: - Dependencies

    private let episodeRepository: EpisodeRepositoryProtocol
    private let medicationRepository: MedicationRepositoryProtocol
    private let dailyCheckinService: DailyCheckinNotificationServiceProtocol
    private let doseCheckinService: DoseCheckinNotificationServiceProtocol
    private let liveActivityManager: LiveActivityManaging
    private var episodeId: String

    // MARK: - Init

    init(
        episodeId: String = "",
        episodeRepository: EpisodeRepositoryProtocol = EpisodeRepository(dbManager: DatabaseManager.shared),
        medicationRepository: MedicationRepositoryProtocol = MedicationRepository(dbManager: DatabaseManager.shared),
        dailyCheckinService: DailyCheckinNotificationServiceProtocol = DailyCheckinNotificationService(
            notificationService: NotificationService.shared,
            scheduledNotificationRepo: ScheduledNotificationRepository(dbManager: DatabaseManager.shared),
            episodeRepo: EpisodeRepository(dbManager: DatabaseManager.shared),
            dailyStatusRepo: DailyStatusRepository(dbManager: DatabaseManager.shared)
        ),
        doseCheckinService: DoseCheckinNotificationServiceProtocol = DoseCheckinNotificationService(
            notificationService: NotificationService.shared,
            medicationRepo: MedicationRepository(dbManager: DatabaseManager.shared)
        ),
        liveActivityManager: LiveActivityManaging = LiveActivityManager.shared
    ) {
        self.episodeId = episodeId
        self.episodeRepository = episodeRepository
        self.medicationRepository = medicationRepository
        self.dailyCheckinService = dailyCheckinService
        self.doseCheckinService = doseCheckinService
        self.liveActivityManager = liveActivityManager
    }

    // MARK: - Computed

    var episode: Episode? { details?.episode }
    var intensityReadings: [IntensityReading] { details?.intensityReadings ?? [] }
    var symptomLogs: [SymptomLog] { details?.symptomLogs ?? [] }
    var painLocationLogs: [PainLocationLog] { details?.painLocationLogs ?? [] }
    var episodeNotes: [EpisodeNote] { details?.episodeNotes ?? [] }

    // MARK: - Actions

    @MainActor
    func loadEpisode() async {
        isLoading = true
        error = nil
        do {
            details = try episodeRepository.getEpisodeWithDetails(episodeId)
            episodeDoses = try loadDosesForEpisode(episodeId)
            isLoading = false
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "EpisodeDetailViewModel", "action": "loadEpisode"])
            self.error = error.localizedDescription
            isLoading = false
        }
    }

    /// Overload that accepts an episode ID (updates the stored ID and loads).
    @MainActor
    func loadEpisode(_ id: String) async {
        self.episodeId = id
        isLoading = true
        error = nil
        do {
            details = try episodeRepository.getEpisodeWithDetails(id)
            episodeDoses = try loadDosesForEpisode(id)
            isLoading = false
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "EpisodeDetailViewModel", "action": "loadEpisode"])
            self.error = error.localizedDescription
            isLoading = false
        }
    }

    @MainActor
    func endEpisode(_ id: String, at timestamp: Int64) async {
        guard var episode = details?.episode, episode.isActive else { return }
        episode.endTime = timestamp
        episode.updatedAt = timestamp
        do {
            _ = try episodeRepository.updateEpisode(episode)
            details = EpisodeWithDetails(
                episode: episode,
                intensityReadings: details?.intensityReadings ?? [],
                symptomLogs: details?.symptomLogs ?? [],
                painLocationLogs: details?.painLocationLogs ?? [],
                episodeNotes: details?.episodeNotes ?? []
            )
            // Reinstate daily check-in notifications now that episode is complete
            try? await dailyCheckinService.scheduleNotifications()
            // The episode's outcome is known — drop any pending 2h dose check-in.
            await doseCheckinService.cancelCheckins(forEpisodeId: episode.id)
            // Transition the Live Activity to its warm post-episode close.
            liveActivityManager.end(episodeId: episode.id, at: timestamp)
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "EpisodeDetailViewModel", "action": "endEpisode"])
            self.error = error.localizedDescription
        }
    }

    @MainActor
    func endEpisode() async {
        guard var episode = details?.episode, episode.isActive else { return }
        let now = TimestampHelper.now
        episode.endTime = now
        episode.updatedAt = now
        do {
            try await episodeRepository.updateEpisode(episode)
            details = EpisodeWithDetails(
                episode: episode,
                intensityReadings: details?.intensityReadings ?? [],
                symptomLogs: details?.symptomLogs ?? [],
                painLocationLogs: details?.painLocationLogs ?? [],
                episodeNotes: details?.episodeNotes ?? []
            )
            // Reinstate daily check-in notifications now that episode is complete
            try? await dailyCheckinService.scheduleNotifications()
            // The episode's outcome is known — drop any pending 2h dose check-in.
            await doseCheckinService.cancelCheckins(forEpisodeId: episode.id)
            // Transition the Live Activity to its warm post-episode close.
            liveActivityManager.end(episodeId: episode.id, at: now)
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "EpisodeDetailViewModel", "action": "endEpisode"])
            self.error = error.localizedDescription
        }
    }

    /// Beta post-drome tracking: mark the attack as subsided while keeping the
    /// episode active so after effects can still be logged. The Live Activity is
    /// left as-is — the episode is still ongoing.
    @MainActor
    func startPostdrome(at timestamp: Int64 = TimestampHelper.now) async {
        guard var episode = details?.episode, episode.isActive, !episode.isInPostdrome else { return }
        episode.postdromeStartTime = timestamp
        episode.updatedAt = timestamp
        do {
            _ = try episodeRepository.updateEpisode(episode)
            details = EpisodeWithDetails(
                episode: episode,
                intensityReadings: details?.intensityReadings ?? [],
                symptomLogs: details?.symptomLogs ?? [],
                painLocationLogs: details?.painLocationLogs ?? [],
                episodeNotes: details?.episodeNotes ?? []
            )
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "EpisodeDetailViewModel", "action": "startPostdrome"])
            self.error = error.localizedDescription
        }
    }

    /// Beta post-drome tracking: undo the post-drome transition (the attack came
    /// back, or it was tapped by mistake) — the episode returns to fully active.
    @MainActor
    func resumeAttack() async {
        guard var episode = details?.episode, episode.isInPostdrome else { return }
        episode.postdromeStartTime = nil
        episode.updatedAt = TimestampHelper.now
        do {
            _ = try episodeRepository.updateEpisode(episode)
            details = EpisodeWithDetails(
                episode: episode,
                intensityReadings: details?.intensityReadings ?? [],
                symptomLogs: details?.symptomLogs ?? [],
                painLocationLogs: details?.painLocationLogs ?? [],
                episodeNotes: details?.episodeNotes ?? []
            )
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "EpisodeDetailViewModel", "action": "resumeAttack"])
            self.error = error.localizedDescription
        }
    }

    @MainActor
    func editEndTime(_ timestamp: Int64) async {
        guard var episode = details?.episode, !episode.isActive else { return }
        guard timestamp > episode.startTime else {
            self.error = "End time must be after the start time."
            return
        }
        episode.endTime = timestamp
        episode.updatedAt = TimestampHelper.now
        do {
            try await episodeRepository.updateEpisode(episode)
            details = EpisodeWithDetails(
                episode: episode,
                intensityReadings: details?.intensityReadings ?? [],
                symptomLogs: details?.symptomLogs ?? [],
                painLocationLogs: details?.painLocationLogs ?? [],
                episodeNotes: details?.episodeNotes ?? []
            )
            // Correct the end time on a still-lingering post-episode activity.
            liveActivityManager.end(episodeId: episode.id, at: timestamp)
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "EpisodeDetailViewModel", "action": "editEndTime"])
            self.error = error.localizedDescription
        }
    }

    @MainActor
    func editStartTime(_ timestamp: Int64) async {
        guard var episode = details?.episode else { return }
        if let endTime = episode.endTime, timestamp >= endTime {
            self.error = "Start time must be before the end time."
            return
        }
        episode.startTime = timestamp
        episode.updatedAt = TimestampHelper.now
        do {
            try await episodeRepository.updateEpisode(episode)
            details = EpisodeWithDetails(
                episode: episode,
                intensityReadings: details?.intensityReadings ?? [],
                symptomLogs: details?.symptomLogs ?? [],
                painLocationLogs: details?.painLocationLogs ?? [],
                episodeNotes: details?.episodeNotes ?? []
            )
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "EpisodeDetailViewModel", "action": "editStartTime"])
            self.error = error.localizedDescription
        }
    }

    @MainActor
    func reopenEpisode() async {
        guard var episode = details?.episode, !episode.isActive else { return }
        episode.endTime = nil
        episode.updatedAt = TimestampHelper.now
        do {
            try await episodeRepository.updateEpisode(episode)
            details = EpisodeWithDetails(
                episode: episode,
                intensityReadings: details?.intensityReadings ?? [],
                symptomLogs: details?.symptomLogs ?? [],
                painLocationLogs: details?.painLocationLogs ?? [],
                episodeNotes: details?.episodeNotes ?? []
            )
            // The episode is active again — surface a fresh Live Activity.
            liveActivityManager.start(for: episode)
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "EpisodeDetailViewModel", "action": "reopenEpisode"])
            self.error = error.localizedDescription
        }
    }

    @MainActor
    func updateEpisode(_ updated: Episode) async {
        do {
            try await episodeRepository.updateEpisode(updated)
            details = EpisodeWithDetails(
                episode: updated,
                intensityReadings: details?.intensityReadings ?? [],
                symptomLogs: details?.symptomLogs ?? [],
                painLocationLogs: details?.painLocationLogs ?? [],
                episodeNotes: details?.episodeNotes ?? []
            )
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "EpisodeDetailViewModel", "action": "updateEpisode"])
            self.error = error.localizedDescription
        }
    }

    /// Permanently delete this episode and everything attached to it (intensity
    /// readings, symptom/pain logs, notes — cascaded by the DB). Doses keep their
    /// history; their `episode_id` is nulled by the foreign key. Used to discard an
    /// episode started by accident, whether it's still active or already ended.
    @MainActor
    func deleteEpisode() async {
        guard let episode = details?.episode else { return }
        do {
            try await episodeRepository.deleteEpisode(episode.id)
            // Drop any Live Activity tied to the now-deleted episode.
            liveActivityManager.dismiss(episodeId: episode.id)
            // If it was active, daily check-ins were suppressed — reinstate them
            // now that no episode is in progress.
            if episode.isActive {
                try? await dailyCheckinService.scheduleNotifications()
            }
            details = nil
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "EpisodeDetailViewModel", "action": "deleteEpisode"])
            self.error = error.localizedDescription
        }
    }

    // MARK: - Intensity Readings

    @MainActor
    func addIntensityReading(intensity: Double, timestamp: Int64? = nil) async {
        let now = TimestampHelper.now
        let reading = IntensityReading(
            id: UUID().uuidString,
            episodeId: episodeId,
            timestamp: timestamp ?? now,
            intensity: intensity,
            createdAt: now,
            updatedAt: now
        )
        do {
            let saved = try await episodeRepository.createIntensityReading(reading)
            details?.intensityReadings.append(saved)
            details?.intensityReadings.sort { $0.timestamp < $1.timestamp }
            // Reflect the new intensity on the Live Activity, if running.
            if details?.episode.isActive == true {
                liveActivityManager.refresh(episodeId: episodeId)
            }
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "EpisodeDetailViewModel", "action": "addIntensityReading"])
            self.error = error.localizedDescription
        }
    }

    @MainActor
    func updateReading(_ reading: IntensityReading) async {
        do {
            try await episodeRepository.updateIntensityReading(reading)
            if let index = details?.intensityReadings.firstIndex(where: { $0.id == reading.id }) {
                details?.intensityReadings[index] = reading
            }
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "EpisodeDetailViewModel", "action": "updateReading"])
            self.error = error.localizedDescription
        }
    }

    @MainActor
    func deleteReading(_ id: String) async {
        do {
            try await episodeRepository.deleteIntensityReading(id)
            details?.intensityReadings.removeAll { $0.id == id }
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "EpisodeDetailViewModel", "action": "deleteReading"])
            self.error = error.localizedDescription
        }
    }

    // MARK: - Symptom Logs

    @MainActor
    func addSymptomLog(symptom: Symptom, severity: Double? = nil, timestamp: Int64? = nil) async {
        let now = TimestampHelper.now
        let log = SymptomLog(
            id: UUID().uuidString,
            episodeId: episodeId,
            symptom: symptom,
            onsetTime: timestamp ?? now,
            resolutionTime: nil,
            severity: severity,
            createdAt: now,
            updatedAt: now
        )
        do {
            let saved = try await episodeRepository.createSymptomLog(log)
            details?.symptomLogs.append(saved)
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "EpisodeDetailViewModel", "action": "addSymptomLog"])
            self.error = error.localizedDescription
        }
    }

    @MainActor
    func updateSymptomLog(_ log: SymptomLog) async {
        do {
            try await episodeRepository.updateSymptomLog(log)
            if let index = details?.symptomLogs.firstIndex(where: { $0.id == log.id }) {
                details?.symptomLogs[index] = log
            }
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "EpisodeDetailViewModel", "action": "updateSymptomLog"])
            self.error = error.localizedDescription
        }
    }

    @MainActor
    func deleteSymptomLog(_ id: String) async {
        do {
            try await episodeRepository.deleteSymptomLog(id)
            details?.symptomLogs.removeAll { $0.id == id }
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "EpisodeDetailViewModel", "action": "deleteSymptomLog"])
            self.error = error.localizedDescription
        }
    }

    // MARK: - Episode Notes

    @MainActor
    func addEpisodeNote(note: String, timestamp: Int64? = nil) async {
        let now = TimestampHelper.now
        let episodeNote = EpisodeNote(
            id: UUID().uuidString,
            episodeId: episodeId,
            timestamp: timestamp ?? now,
            note: note,
            createdAt: now,
            updatedAt: now
        )
        do {
            let saved = try await episodeRepository.createEpisodeNote(episodeNote)
            details?.episodeNotes.append(saved)
            details?.episodeNotes.sort { $0.timestamp < $1.timestamp }
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "EpisodeDetailViewModel", "action": "addEpisodeNote"])
            self.error = error.localizedDescription
        }
    }

    @MainActor
    func updateNote(_ note: EpisodeNote) async {
        do {
            try await episodeRepository.updateEpisodeNote(note)
            if let index = details?.episodeNotes.firstIndex(where: { $0.id == note.id }) {
                details?.episodeNotes[index] = note
            }
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "EpisodeDetailViewModel", "action": "updateNote"])
            self.error = error.localizedDescription
        }
    }

    @MainActor
    func deleteNote(_ id: String) async {
        do {
            try await episodeRepository.deleteEpisodeNote(id)
            details?.episodeNotes.removeAll { $0.id == id }
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "EpisodeDetailViewModel", "action": "deleteNote"])
            self.error = error.localizedDescription
        }
    }

    // MARK: - Pain Location Logs

    @MainActor
    func addPainLocationLog(locations: [PainLocation], timestamp: Int64? = nil) async {
        let now = TimestampHelper.now
        let log = PainLocationLog(
            id: UUID().uuidString,
            episodeId: episodeId,
            timestamp: timestamp ?? now,
            painLocations: locations,
            createdAt: now,
            updatedAt: now
        )
        do {
            let saved = try await episodeRepository.createPainLocationLog(log)
            details?.painLocationLogs.append(saved)
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "EpisodeDetailViewModel", "action": "addPainLocationLog"])
            self.error = error.localizedDescription
        }
    }

    @MainActor
    func updatePainLocationLog(_ log: PainLocationLog) async {
        do {
            try await episodeRepository.updatePainLocationLog(log)
            if let index = details?.painLocationLogs.firstIndex(where: { $0.id == log.id }) {
                details?.painLocationLogs[index] = log
            }
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "EpisodeDetailViewModel", "action": "updatePainLocationLog"])
            self.error = error.localizedDescription
        }
    }

    @MainActor
    func deletePainLocationLog(_ id: String) async {
        do {
            try await episodeRepository.deletePainLocationLog(id)
            details?.painLocationLogs.removeAll { $0.id == id }
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "EpisodeDetailViewModel", "action": "deletePainLocationLog"])
            self.error = error.localizedDescription
        }
    }

    // MARK: - Dose Editing

    @MainActor
    func updateDose(_ dose: MedicationDose) async {
        do {
            var updated = dose
            updated.updatedAt = TimestampHelper.now
            _ = try medicationRepository.updateDose(updated)
            if let index = episodeDoses.firstIndex(where: { $0.dose.id == dose.id }) {
                episodeDoses[index] = DoseWithMedication(dose: updated, medication: episodeDoses[index].medication)
            }
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "EpisodeDetailViewModel", "action": "updateDose"])
            self.error = error.localizedDescription
        }
    }

    @MainActor
    func deleteDose(_ id: String) async {
        do {
            try medicationRepository.deleteDose(id)
            episodeDoses.removeAll { $0.dose.id == id }
        } catch {
            ErrorLogger.shared.logError(error, context: ["viewModel": "EpisodeDetailViewModel", "action": "deleteDose"])
            self.error = error.localizedDescription
        }
    }

    // MARK: - Private

    private func loadDosesForEpisode(_ episodeId: String) throws -> [DoseWithMedication] {
        // Get doses explicitly linked to this episode
        var allDoses = try medicationRepository.getDosesByEpisodeId(episodeId)
        let linkedIds = Set(allDoses.map(\.id))

        // Also get doses that fall within the episode's time window but lack episode_id
        // (e.g. logged from homescreen before the association fix, or imported from RN)
        if let episode = details?.episode {
            let endTime = episode.endTime ?? Int64(Date().timeIntervalSince1970 * 1000)
            let windowDoses = try medicationRepository.getDosesByDateRange(
                start: episode.startTime, end: endTime
            )
            for dose in windowDoses where !linkedIds.contains(dose.id) {
                allDoses.append(dose)
            }
        }

        return allDoses.compactMap { dose in
            guard let med = try? medicationRepository.getMedicationById(dose.medicationId) else {
                return nil
            }
            return DoseWithMedication(dose: dose, medication: med)
        }
    }
}
