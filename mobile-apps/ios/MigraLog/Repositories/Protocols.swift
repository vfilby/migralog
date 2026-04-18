import Foundation

// MARK: - Episode Repository Protocol

protocol EpisodeRepositoryProtocol: Sendable {
    // Episode CRUD
    func createEpisode(_ episode: Episode) throws -> Episode
    func getEpisodeById(_ id: String) throws -> Episode?
    func getAllEpisodes() throws -> [Episode]
    func getEpisodesByDateRange(start: Int64, end: Int64) throws -> [Episode]
    func getCurrentEpisode() throws -> Episode?
    func getEpisodeByTimestamp(_ timestamp: Int64) throws -> Episode?
    func updateEpisode(_ episode: Episode) throws -> Episode
    func updateEpisodeTimestamps(episodeId: String, offset: Int64) throws
    func deleteEpisode(_ id: String) throws
    func deleteAllEpisodes() throws

    // Intensity Readings
    func createIntensityReading(_ reading: IntensityReading) throws -> IntensityReading
    func getReadingsByEpisodeId(_ episodeId: String) throws -> [IntensityReading]
    func getReadingsByMultipleEpisodeIds(_ episodeIds: [String]) throws -> [String: [IntensityReading]]
    func updateReading(_ reading: IntensityReading) throws -> IntensityReading
    func updateReadingTimestamps(episodeId: String, offset: Int64) throws
    func deleteReading(_ id: String) throws

    // Symptom Logs
    func createSymptomLog(_ log: SymptomLog) throws -> SymptomLog
    func getSymptomLogsByEpisodeId(_ episodeId: String) throws -> [SymptomLog]
    func updateSymptomLog(_ log: SymptomLog) throws -> SymptomLog
    func deleteSymptomLog(_ id: String) throws

    // Pain Location Logs
    func createPainLocationLog(_ log: PainLocationLog) throws -> PainLocationLog
    func getLocationLogsByEpisodeId(_ episodeId: String) throws -> [PainLocationLog]
    func updatePainLocationLog(_ log: PainLocationLog) throws -> PainLocationLog
    func deletePainLocationLog(_ id: String) throws

    // Episode Notes
    func createEpisodeNote(_ note: EpisodeNote) throws -> EpisodeNote
    func getNotesByEpisodeId(_ episodeId: String) throws -> [EpisodeNote]
    func updateEpisodeNote(_ note: EpisodeNote) throws -> EpisodeNote
    func updateNoteTimestamps(episodeId: String, offset: Int64) throws
    func deleteEpisodeNote(_ id: String) throws
}

// MARK: - Medication Repository Protocol

protocol MedicationRepositoryProtocol: Sendable {
    // Medication CRUD
    func createMedication(_ medication: Medication) throws -> Medication
    func getMedicationById(_ id: String) throws -> Medication?
    func getAllMedications() throws -> [Medication]
    func getActiveMedications() throws -> [Medication]
    func getArchivedMedications() throws -> [Medication]
    func updateMedication(_ medication: Medication) throws -> Medication
    func archiveMedication(_ id: String) throws
    func unarchiveMedication(_ id: String) throws
    func deleteMedication(_ id: String) throws

    // Doses
    func createDose(_ dose: MedicationDose) throws -> MedicationDose
    func getLastDose(medicationId: String) throws -> MedicationDose?
    func getDosesByMedicationId(_ medicationId: String) throws -> [MedicationDose]
    func getDosesByEpisodeId(_ episodeId: String) throws -> [MedicationDose]
    func getDosesByDateRange(start: Int64, end: Int64) throws -> [MedicationDose]
    func getMedicationUsageCounts(start: Int64, end: Int64) throws -> [String: Int]
    func getActiveMedicationsWithUsageCounts() throws -> [(medication: Medication, usageCount: Int)]
    func updateDose(_ dose: MedicationDose) throws -> MedicationDose
    func deleteDose(_ id: String) throws

    // Schedules
    func createSchedule(_ schedule: MedicationSchedule) throws -> MedicationSchedule
    func getSchedulesByMedicationId(_ medicationId: String) throws -> [MedicationSchedule]
    func getSchedulesByMultipleMedicationIds(_ medicationIds: [String]) throws -> [String: [MedicationSchedule]]
    func updateSchedule(_ schedule: MedicationSchedule) throws -> MedicationSchedule
    func deleteSchedule(_ id: String) throws

    // Notification helpers
    func wasLoggedForScheduleToday(medicationId: String, date: String) throws -> Bool
}

// MARK: - Category Safety Rule Repository Protocol

protocol CategorySafetyRuleRepositoryProtocol: Sendable {
    func getAllRules() throws -> [CategorySafetyRule]
    func getRules(for category: MedicationCategory) throws -> [CategorySafetyRule]
    func getRule(category: MedicationCategory, type: CategorySafetyRuleType) throws -> CategorySafetyRule?
    func upsert(_ rule: CategorySafetyRule) throws
    func delete(id: String) throws
    /// Distinct calendar days (local time) on which ANY medication in the given
    /// category had a dose with status 'taken' in the last `windowDays`.
    func countUsageDays(category: MedicationCategory, windowDays: Int, now: Date) throws -> Int
}

// MARK: - Daily Status Repository Protocol

protocol DailyStatusRepositoryProtocol: Sendable {
    func createStatus(_ status: DailyStatusLog) throws -> DailyStatusLog
    func getStatusById(_ id: String) throws -> DailyStatusLog?
    func getStatusByDate(_ date: String) throws -> DailyStatusLog?
    func getStatusesByDateRange(start: String, end: String) throws -> [DailyStatusLog]
    func getMonthStats(year: Int, month: Int) throws -> [DailyStatusLog]
    func updateStatus(_ status: DailyStatusLog) throws -> DailyStatusLog
    func deleteStatus(_ id: String) throws
}

// MARK: - Calendar Overlay Repository Protocol

protocol CalendarOverlayRepositoryProtocol: Sendable {
    func createOverlay(_ overlay: CalendarOverlay) throws -> CalendarOverlay
    func getAllOverlays() throws -> [CalendarOverlay]
    func getOverlaysByDateRange(start: String, end: String) throws -> [CalendarOverlay]
    func getOverlaysForDate(_ date: String) throws -> [CalendarOverlay]
    func updateOverlay(_ overlay: CalendarOverlay) throws -> CalendarOverlay
    func deleteOverlay(_ id: String) throws
}

// MARK: - Scheduled Notification Repository Protocol

protocol ScheduledNotificationRepositoryProtocol: Sendable {
    func createNotification(_ notification: ScheduledNotification) throws -> ScheduledNotification
    func getByEntity(entityType: NotificationSourceType, entityId: String) throws -> [ScheduledNotification]
    func getAllPending() throws -> [ScheduledNotification]
    func deleteByNotificationId(_ notificationId: String) throws
    func deleteByEntity(entityType: NotificationSourceType, entityId: String) throws
    func getByGroupKey(_ groupKey: String, date: String) throws -> [ScheduledNotification]
    func getByNotificationId(_ notificationId: String) throws -> [ScheduledNotification]
    func getMapping(medicationId: String, scheduleId: String, date: String, notificationType: NotificationType) throws -> ScheduledNotification?
    func getMappingsBySchedule(medicationId: String, scheduleId: String) throws -> [ScheduledNotification]
    func countBySchedule(medicationId: String, scheduleId: String) throws -> Int
    func getLastScheduledDate(medicationId: String, scheduleId: String) throws -> String?
    func deleteById(_ id: String) throws
    @discardableResult func deleteBeforeDate(_ date: String) throws -> Int
    @discardableResult func deleteAllMedication() throws -> Int
}

// MARK: - Protocol Extension Convenience Methods

extension EpisodeRepositoryProtocol {
    /// Fetches an episode with all its detail records.
    func getEpisodeWithDetails(_ episodeId: String) throws -> EpisodeWithDetails? {
        guard let episode = try getEpisodeById(episodeId) else { return nil }
        let readings = try getReadingsByEpisodeId(episodeId)
        let symptomLogs = try getSymptomLogsByEpisodeId(episodeId)
        let locationLogs = try getLocationLogsByEpisodeId(episodeId)
        let notes = try getNotesByEpisodeId(episodeId)
        return EpisodeWithDetails(
            episode: episode,
            intensityReadings: readings,
            symptomLogs: symptomLogs,
            painLocationLogs: locationLogs,
            episodeNotes: notes
        )
    }

    /// Convenience: get intensity readings keyed by episode ID.
    func getIntensityReadings(episodeIds: [String]) throws -> [String: [IntensityReading]] {
        try getReadingsByMultipleEpisodeIds(episodeIds)
    }

    /// Alias for updateReading.
    func updateIntensityReading(_ reading: IntensityReading) throws -> IntensityReading {
        try updateReading(reading)
    }

    /// Alias for deleteReading.
    func deleteIntensityReading(_ id: String) throws {
        try deleteReading(id)
    }
}

extension MedicationRepositoryProtocol {
    /// Fetches a medication with its schedules and recent doses.
    func getMedicationWithDetails(_ medicationId: String) throws -> MedicationWithDetails? {
        guard let medication = try getMedicationById(medicationId) else { return nil }
        let schedules = try getSchedulesByMedicationId(medicationId)
        let doses = try getDosesByMedicationId(medicationId)
        // Return most recent 30 doses
        let recentDoses = Array(doses.prefix(30))
        return MedicationWithDetails(
            medication: medication,
            schedules: schedules,
            recentDoses: recentDoses
        )
    }

    /// Alias for getSchedulesByMedicationId.
    func getSchedules(medicationId: String) throws -> [MedicationSchedule] {
        try getSchedulesByMedicationId(medicationId)
    }

    /// Fetches today's doses joined with their medication info.
    func getDosesWithMedications(date: String) throws -> [DoseWithMedication] {
        // Get the timestamp range for the given date
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.timeZone = TimeZone.current
        guard let dayStart = formatter.date(from: date) else { return [] }
        let dayEnd = Calendar.current.date(byAdding: .day, value: 1, to: dayStart)!
        let startTs = TimestampHelper.fromDate(dayStart)
        let endTs = TimestampHelper.fromDate(dayEnd)

        let doses = try getDosesByDateRange(start: startTs, end: endTs)
        var results: [DoseWithMedication] = []
        for dose in doses {
            if let med = try getMedicationById(dose.medicationId) {
                results.append(DoseWithMedication(dose: dose, medication: med))
            }
        }
        return results
    }
}
