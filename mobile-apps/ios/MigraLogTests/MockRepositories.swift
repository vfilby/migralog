import Foundation
@testable import MigraLog

// MARK: - Mock Episode Repository

final class MockEpisodeRepository: EpisodeRepositoryProtocol, @unchecked Sendable {
    // Storage
    var episodes: [Episode] = []
    var intensityReadings: [IntensityReading] = []
    var symptomLogs: [SymptomLog] = []
    var painLocationLogs: [PainLocationLog] = []
    var episodeNotes: [EpisodeNote] = []

    // Call tracking
    var getAllEpisodesCalled = false
    var getEpisodeByIdCalled = false
    var createEpisodeCalled = false
    var updateEpisodeCalled = false
    var deleteEpisodeCalled = false
    var getEpisodeWithDetailsCalled = false
    var createIntensityReadingCalled = false
    var updateIntensityReadingCalled = false
    var deleteIntensityReadingCalled = false
    var createSymptomLogCalled = false
    var updateSymptomLogCalled = false
    var deleteSymptomLogCalled = false
    var createEpisodeNoteCalled = false
    var updateEpisodeNoteCalled = false
    var deleteEpisodeNoteCalled = false
    var createPainLocationLogCalled = false

    // Error injection
    var errorToThrow: Error?

    private func throwIfNeeded() throws {
        if let error = errorToThrow { throw error }
    }

    // MARK: - Episode CRUD

    func createEpisode(_ episode: Episode) throws -> Episode {
        try throwIfNeeded()
        createEpisodeCalled = true
        episodes.append(episode)
        return episode
    }

    func getEpisodeById(_ id: String) throws -> Episode? {
        try throwIfNeeded()
        getEpisodeByIdCalled = true
        return episodes.first { $0.id == id }
    }

    func getAllEpisodes() throws -> [Episode] {
        try throwIfNeeded()
        getAllEpisodesCalled = true
        return episodes.sorted { $0.startTime > $1.startTime }
    }

    func getEpisodesByDateRange(start: Int64, end: Int64) throws -> [Episode] {
        try throwIfNeeded()
        return episodes.filter { ep in
            ep.startTime >= start && ep.startTime <= end
        }
    }

    func getCurrentEpisode() throws -> Episode? {
        try throwIfNeeded()
        return episodes.first { $0.isActive }
    }

    func getEpisodeByTimestamp(_ timestamp: Int64) throws -> Episode? {
        try throwIfNeeded()
        return episodes.first { ep in
            ep.startTime <= timestamp && (ep.endTime ?? Int64.max) >= timestamp
        }
    }

    func updateEpisode(_ episode: Episode) throws -> Episode {
        try throwIfNeeded()
        updateEpisodeCalled = true
        if let index = episodes.firstIndex(where: { $0.id == episode.id }) {
            episodes[index] = episode
        }
        return episode
    }

    func updateEpisodeTimestamps(episodeId: String, offset: Int64) throws {
        try throwIfNeeded()
        if let index = episodes.firstIndex(where: { $0.id == episodeId }) {
            episodes[index].startTime += offset
            if let end = episodes[index].endTime {
                episodes[index].endTime = end + offset
            }
        }
    }

    func deleteEpisode(_ id: String) throws {
        try throwIfNeeded()
        deleteEpisodeCalled = true
        episodes.removeAll { $0.id == id }
        intensityReadings.removeAll { $0.episodeId == id }
        symptomLogs.removeAll { $0.episodeId == id }
        painLocationLogs.removeAll { $0.episodeId == id }
        episodeNotes.removeAll { $0.episodeId == id }
    }

    func deleteAllEpisodes() throws {
        try throwIfNeeded()
        episodes.removeAll()
        intensityReadings.removeAll()
        symptomLogs.removeAll()
        painLocationLogs.removeAll()
        episodeNotes.removeAll()
    }

    // MARK: - Intensity Readings

    func createIntensityReading(_ reading: IntensityReading) throws -> IntensityReading {
        try throwIfNeeded()
        createIntensityReadingCalled = true
        intensityReadings.append(reading)
        return reading
    }

    func getReadingsByEpisodeId(_ episodeId: String) throws -> [IntensityReading] {
        try throwIfNeeded()
        return intensityReadings.filter { $0.episodeId == episodeId }.sorted { $0.timestamp < $1.timestamp }
    }

    func getReadingsByMultipleEpisodeIds(_ episodeIds: [String]) throws -> [String: [IntensityReading]] {
        try throwIfNeeded()
        var result: [String: [IntensityReading]] = [:]
        for id in episodeIds {
            result[id] = intensityReadings.filter { $0.episodeId == id }.sorted { $0.timestamp < $1.timestamp }
        }
        return result
    }

    func updateReading(_ reading: IntensityReading) throws -> IntensityReading {
        try throwIfNeeded()
        updateIntensityReadingCalled = true
        if let index = intensityReadings.firstIndex(where: { $0.id == reading.id }) {
            intensityReadings[index] = reading
        }
        return reading
    }

    func updateReadingTimestamps(episodeId: String, offset: Int64) throws {
        try throwIfNeeded()
        for i in intensityReadings.indices where intensityReadings[i].episodeId == episodeId {
            intensityReadings[i].timestamp += offset
        }
    }

    func deleteReading(_ id: String) throws {
        try throwIfNeeded()
        deleteIntensityReadingCalled = true
        intensityReadings.removeAll { $0.id == id }
    }

    // MARK: - Symptom Logs

    func createSymptomLog(_ log: SymptomLog) throws -> SymptomLog {
        try throwIfNeeded()
        createSymptomLogCalled = true
        symptomLogs.append(log)
        return log
    }

    func getSymptomLogsByEpisodeId(_ episodeId: String) throws -> [SymptomLog] {
        try throwIfNeeded()
        return symptomLogs.filter { $0.episodeId == episodeId }
    }

    func updateSymptomLog(_ log: SymptomLog) throws -> SymptomLog {
        try throwIfNeeded()
        updateSymptomLogCalled = true
        if let index = symptomLogs.firstIndex(where: { $0.id == log.id }) {
            symptomLogs[index] = log
        }
        return log
    }

    func deleteSymptomLog(_ id: String) throws {
        try throwIfNeeded()
        deleteSymptomLogCalled = true
        symptomLogs.removeAll { $0.id == id }
    }

    // MARK: - Pain Location Logs

    func createPainLocationLog(_ log: PainLocationLog) throws -> PainLocationLog {
        try throwIfNeeded()
        createPainLocationLogCalled = true
        painLocationLogs.append(log)
        return log
    }

    func getLocationLogsByEpisodeId(_ episodeId: String) throws -> [PainLocationLog] {
        try throwIfNeeded()
        return painLocationLogs.filter { $0.episodeId == episodeId }
    }

    func updatePainLocationLog(_ log: PainLocationLog) throws -> PainLocationLog {
        try throwIfNeeded()
        if let index = painLocationLogs.firstIndex(where: { $0.id == log.id }) {
            painLocationLogs[index] = log
        }
        return log
    }

    func deletePainLocationLog(_ id: String) throws {
        try throwIfNeeded()
        painLocationLogs.removeAll { $0.id == id }
    }

    // MARK: - Episode Notes

    func createEpisodeNote(_ note: EpisodeNote) throws -> EpisodeNote {
        try throwIfNeeded()
        createEpisodeNoteCalled = true
        episodeNotes.append(note)
        return note
    }

    func getNotesByEpisodeId(_ episodeId: String) throws -> [EpisodeNote] {
        try throwIfNeeded()
        return episodeNotes.filter { $0.episodeId == episodeId }.sorted { $0.timestamp < $1.timestamp }
    }

    func updateEpisodeNote(_ note: EpisodeNote) throws -> EpisodeNote {
        try throwIfNeeded()
        updateEpisodeNoteCalled = true
        if let index = episodeNotes.firstIndex(where: { $0.id == note.id }) {
            episodeNotes[index] = note
        }
        return note
    }

    func updateNoteTimestamps(episodeId: String, offset: Int64) throws {
        try throwIfNeeded()
        for i in episodeNotes.indices where episodeNotes[i].episodeId == episodeId {
            var note = episodeNotes[i]
            note.timestamp += offset
            episodeNotes[i] = note
        }
    }

    func deleteEpisodeNote(_ id: String) throws {
        try throwIfNeeded()
        deleteEpisodeNoteCalled = true
        episodeNotes.removeAll { $0.id == id }
    }
}

// MARK: - Mock Medication Repository

final class MockMedicationRepository: MedicationRepositoryProtocol, @unchecked Sendable {
    // Storage
    var medications: [Medication] = []
    var schedules: [MedicationSchedule] = []
    var doses: [MedicationDose] = []

    // Call tracking
    var createDoseCalled = false
    var deleteDoseCalled = false
    var archiveMedicationCalled = false
    var unarchiveMedicationCalled = false
    var deleteMedicationCalled = false
    var getMedicationWithDetailsCalled = false
    var createMedicationCalled = false

    // Error injection
    var errorToThrow: Error?

    private func throwIfNeeded() throws {
        if let error = errorToThrow { throw error }
    }

    // MARK: - Medication CRUD

    func createMedication(_ medication: Medication) throws -> Medication {
        try throwIfNeeded()
        createMedicationCalled = true
        medications.append(medication)
        return medication
    }

    func getMedicationById(_ id: String) throws -> Medication? {
        try throwIfNeeded()
        return medications.first { $0.id == id }
    }

    func getAllMedications() throws -> [Medication] {
        try throwIfNeeded()
        return medications
    }

    func getActiveMedications() throws -> [Medication] {
        try throwIfNeeded()
        return medications.filter { $0.active }
    }

    func getArchivedMedications() throws -> [Medication] {
        try throwIfNeeded()
        return medications.filter { !$0.active }
    }

    func updateMedication(_ medication: Medication) throws -> Medication {
        try throwIfNeeded()
        if let index = medications.firstIndex(where: { $0.id == medication.id }) {
            medications[index] = medication
        }
        return medication
    }

    func archiveMedication(_ id: String) throws {
        try throwIfNeeded()
        archiveMedicationCalled = true
        if let index = medications.firstIndex(where: { $0.id == id }) {
            medications[index].active = false
        }
    }

    func unarchiveMedication(_ id: String) throws {
        try throwIfNeeded()
        unarchiveMedicationCalled = true
        if let index = medications.firstIndex(where: { $0.id == id }) {
            medications[index].active = true
        }
    }

    func deleteMedication(_ id: String) throws {
        try throwIfNeeded()
        deleteMedicationCalled = true
        medications.removeAll { $0.id == id }
        doses.removeAll { $0.medicationId == id }
        schedules.removeAll { $0.medicationId == id }
    }

    // MARK: - Doses

    func createDose(_ dose: MedicationDose) throws -> MedicationDose {
        try throwIfNeeded()
        createDoseCalled = true
        doses.append(dose)
        return dose
    }

    func getDosesByMedicationId(_ medicationId: String) throws -> [MedicationDose] {
        try throwIfNeeded()
        return doses.filter { $0.medicationId == medicationId }.sorted { $0.timestamp > $1.timestamp }
    }

    func getLastDose(medicationId: String) throws -> MedicationDose? {
        try throwIfNeeded()
        return doses
            .filter { $0.medicationId == medicationId && $0.status == .taken }
            .sorted { $0.timestamp > $1.timestamp }
            .first
    }

    func getDosesByEpisodeId(_ episodeId: String) throws -> [MedicationDose] {
        try throwIfNeeded()
        return doses.filter { $0.episodeId == episodeId }
    }

    func getDosesByDateRange(start: Int64, end: Int64) throws -> [MedicationDose] {
        try throwIfNeeded()
        return doses.filter { $0.timestamp >= start && $0.timestamp <= end }
    }

    func getMedicationUsageCounts(start: Int64, end: Int64) throws -> [String: Int] {
        try throwIfNeeded()
        let filtered = doses.filter { $0.timestamp >= start && $0.timestamp <= end && $0.status == .taken }
        var counts: [String: Int] = [:]
        for dose in filtered {
            counts[dose.medicationId, default: 0] += 1
        }
        return counts
    }

    func getActiveMedicationsWithUsageCounts() throws -> [(medication: Medication, usageCount: Int)] {
        try throwIfNeeded()
        let active = medications.filter { $0.active }
        let counts = try getMedicationUsageCounts(start: 0, end: Int64.max)
        return active.map { med in
            (medication: med, usageCount: counts[med.id] ?? 0)
        }
    }

    func updateDose(_ dose: MedicationDose) throws -> MedicationDose {
        try throwIfNeeded()
        if let index = doses.firstIndex(where: { $0.id == dose.id }) {
            doses[index] = dose
        }
        return dose
    }

    func deleteDose(_ id: String) throws {
        try throwIfNeeded()
        deleteDoseCalled = true
        doses.removeAll { $0.id == id }
    }

    // MARK: - Schedules

    func createSchedule(_ schedule: MedicationSchedule) throws -> MedicationSchedule {
        try throwIfNeeded()
        schedules.append(schedule)
        return schedule
    }

    func getSchedulesByMedicationId(_ medicationId: String) throws -> [MedicationSchedule] {
        try throwIfNeeded()
        return schedules.filter { $0.medicationId == medicationId }
    }

    func getSchedulesByMultipleMedicationIds(_ medicationIds: [String]) throws -> [String: [MedicationSchedule]] {
        try throwIfNeeded()
        var result: [String: [MedicationSchedule]] = [:]
        for id in medicationIds {
            result[id] = schedules.filter { $0.medicationId == id }
        }
        return result
    }

    func updateSchedule(_ schedule: MedicationSchedule) throws -> MedicationSchedule {
        try throwIfNeeded()
        if let index = schedules.firstIndex(where: { $0.id == schedule.id }) {
            schedules[index] = schedule
        }
        return schedule
    }

    func deleteSchedule(_ id: String) throws {
        try throwIfNeeded()
        schedules.removeAll { $0.id == id }
    }

    // MARK: - Notification Helpers

    func wasLoggedForScheduleToday(medicationId: String, date: String) throws -> Bool {
        try throwIfNeeded()
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        guard let dayStart = formatter.date(from: date) else { return false }
        guard let dayEnd = Calendar.current.date(byAdding: .day, value: 1, to: dayStart) else { return false }
        let startTs = TimestampHelper.fromDate(dayStart)
        let endTs = TimestampHelper.fromDate(dayEnd)
        return doses.contains { dose in
            dose.medicationId == medicationId &&
            dose.timestamp >= startTs &&
            dose.timestamp < endTs &&
            dose.status == .taken
        }
    }
}

// MARK: - Mock Daily Status Repository

final class MockDailyStatusRepository: DailyStatusRepositoryProtocol, @unchecked Sendable {
    // Storage
    var statuses: [DailyStatusLog] = []

    // Call tracking
    var createStatusCalled = false
    var updateStatusCalled = false
    var deleteStatusCalled = false
    var getStatusByDateCalled = false

    // Error injection
    var errorToThrow: Error?

    private func throwIfNeeded() throws {
        if let error = errorToThrow { throw error }
    }

    func createStatus(_ status: DailyStatusLog) throws -> DailyStatusLog {
        try throwIfNeeded()
        createStatusCalled = true
        statuses.append(status)
        return status
    }

    func getStatusById(_ id: String) throws -> DailyStatusLog? {
        try throwIfNeeded()
        return statuses.first { $0.id == id }
    }

    func getStatusByDate(_ date: String) throws -> DailyStatusLog? {
        try throwIfNeeded()
        getStatusByDateCalled = true
        return statuses.first { $0.date == date }
    }

    func getStatusesByDateRange(start: String, end: String) throws -> [DailyStatusLog] {
        try throwIfNeeded()
        return statuses.filter { $0.date >= start && $0.date <= end }
    }

    func getMonthStats(year: Int, month: Int) throws -> [DailyStatusLog] {
        try throwIfNeeded()
        let prefix = String(format: "%04d-%02d", year, month)
        return statuses.filter { $0.date.hasPrefix(prefix) }
    }

    func updateStatus(_ status: DailyStatusLog) throws -> DailyStatusLog {
        try throwIfNeeded()
        updateStatusCalled = true
        if let index = statuses.firstIndex(where: { $0.id == status.id }) {
            statuses[index] = status
        }
        return status
    }

    func deleteStatus(_ id: String) throws {
        try throwIfNeeded()
        deleteStatusCalled = true
        statuses.removeAll { $0.id == id }
    }
}

// MARK: - Mock Calendar Overlay Repository

final class MockCalendarOverlayRepository: CalendarOverlayRepositoryProtocol, @unchecked Sendable {
    var overlays: [CalendarOverlay] = []
    var errorToThrow: Error?

    private func throwIfNeeded() throws {
        if let error = errorToThrow { throw error }
    }

    func createOverlay(_ overlay: CalendarOverlay) throws -> CalendarOverlay {
        try throwIfNeeded()
        overlays.append(overlay)
        return overlay
    }

    func getAllOverlays() throws -> [CalendarOverlay] {
        try throwIfNeeded()
        return overlays
    }

    func getOverlaysByDateRange(start: String, end: String) throws -> [CalendarOverlay] {
        try throwIfNeeded()
        return overlays.filter { $0.startDate >= start && $0.startDate <= end }
    }

    func getOverlaysForDate(_ date: String) throws -> [CalendarOverlay] {
        try throwIfNeeded()
        return overlays.filter { overlay in
            overlay.startDate <= date && (overlay.endDate == nil || overlay.endDate! >= date)
        }
    }

    func updateOverlay(_ overlay: CalendarOverlay) throws -> CalendarOverlay {
        try throwIfNeeded()
        if let index = overlays.firstIndex(where: { $0.id == overlay.id }) {
            overlays[index] = overlay
        }
        return overlay
    }

    func deleteOverlay(_ id: String) throws {
        try throwIfNeeded()
        overlays.removeAll { $0.id == id }
    }
}

// MARK: - Mock Scheduled Notification Repository

final class MockScheduledNotificationRepository: ScheduledNotificationRepositoryProtocol, @unchecked Sendable {
    var notifications: [ScheduledNotification] = []
    var errorToThrow: Error?

    private func throwIfNeeded() throws {
        if let error = errorToThrow { throw error }
    }

    func createNotification(_ notification: ScheduledNotification) throws -> ScheduledNotification {
        try throwIfNeeded()
        notifications.append(notification)
        return notification
    }

    func getByEntity(entityType: NotificationSourceType, entityId: String) throws -> [ScheduledNotification] {
        try throwIfNeeded()
        return notifications.filter { n in
            n.sourceType == entityType && (entityType == .dailyCheckin || n.medicationId == entityId)
        }
    }

    func getAllPending() throws -> [ScheduledNotification] {
        try throwIfNeeded()
        let today = TimestampHelper.dateString()
        return notifications.filter { $0.date >= today }
    }

    func deleteByNotificationId(_ notificationId: String) throws {
        try throwIfNeeded()
        notifications.removeAll { $0.notificationId == notificationId }
    }

    func deleteByEntity(entityType: NotificationSourceType, entityId: String) throws {
        try throwIfNeeded()
        notifications.removeAll { n in
            n.sourceType == entityType && (entityType == .dailyCheckin || n.medicationId == entityId)
        }
    }

    func getByGroupKey(_ groupKey: String, date: String) throws -> [ScheduledNotification] {
        try throwIfNeeded()
        return notifications.filter { $0.groupKey == groupKey && $0.date == date }
            .sorted { ($0.medicationName ?? "") < ($1.medicationName ?? "") }
    }

    func getByNotificationId(_ notificationId: String) throws -> [ScheduledNotification] {
        try throwIfNeeded()
        return notifications.filter { $0.notificationId == notificationId }
            .sorted { ($0.medicationName ?? "") < ($1.medicationName ?? "") }
    }

    func getMapping(medicationId: String, scheduleId: String, date: String, notificationType: NotificationType) throws -> ScheduledNotification? {
        try throwIfNeeded()
        return notifications.first { n in
            n.medicationId == medicationId &&
            n.scheduleId == scheduleId &&
            n.date == date &&
            n.notificationType == notificationType
        }
    }

    func getMappingsBySchedule(medicationId: String, scheduleId: String) throws -> [ScheduledNotification] {
        try throwIfNeeded()
        return notifications.filter { $0.medicationId == medicationId && $0.scheduleId == scheduleId }
            .sorted { $0.date < $1.date }
    }

    func countBySchedule(medicationId: String, scheduleId: String) throws -> Int {
        try throwIfNeeded()
        return notifications.filter { $0.medicationId == medicationId && $0.scheduleId == scheduleId }.count
    }

    func getLastScheduledDate(medicationId: String, scheduleId: String) throws -> String? {
        try throwIfNeeded()
        return notifications.filter { $0.medicationId == medicationId && $0.scheduleId == scheduleId }
            .sorted { $0.date > $1.date }
            .first?.date
    }

    func deleteById(_ id: String) throws {
        try throwIfNeeded()
        notifications.removeAll { $0.id == id }
    }

    @discardableResult
    func deleteBeforeDate(_ date: String) throws -> Int {
        try throwIfNeeded()
        let before = notifications.count
        notifications.removeAll { $0.date < date }
        return before - notifications.count
    }

    @discardableResult
    func deleteAllMedication() throws -> Int {
        try throwIfNeeded()
        let before = notifications.count
        notifications.removeAll { $0.sourceType == .medication }
        return before - notifications.count
    }
}

// MARK: - Test Helpers

enum TestError: Error, LocalizedError {
    case mockError(String)

    var errorDescription: String? {
        switch self {
        case .mockError(let message): return message
        }
    }
}

enum TestFixtures {
    static let now = TimestampHelper.now

    static func makeEpisode(
        id: String = UUID().uuidString,
        startTime: Int64? = nil,
        endTime: Int64? = nil,
        locations: [PainLocation] = [],
        qualities: [PainQuality] = [],
        symptoms: [Symptom] = [],
        triggers: [Trigger] = []
    ) -> Episode {
        let ts = startTime ?? now
        return Episode(
            id: id,
            startTime: ts,
            endTime: endTime,
            locations: locations,
            qualities: qualities,
            symptoms: symptoms,
            triggers: triggers,
            notes: nil,
            latitude: nil,
            longitude: nil,
            locationAccuracy: nil,
            locationTimestamp: nil,
            createdAt: ts,
            updatedAt: ts
        )
    }

    static func makeReading(
        id: String = UUID().uuidString,
        episodeId: String,
        intensity: Double = 5.0,
        timestamp: Int64? = nil
    ) -> IntensityReading {
        let ts = timestamp ?? now
        return IntensityReading(
            id: id,
            episodeId: episodeId,
            timestamp: ts,
            intensity: intensity,
            createdAt: ts,
            updatedAt: ts
        )
    }

    static func makeMedication(
        id: String = UUID().uuidString,
        name: String = "Ibuprofen",
        type: MedicationType = .rescue,
        dosageAmount: Double = 400,
        dosageUnit: String = "mg",
        active: Bool = true,
        category: MedicationCategory? = .nsaid,
        scheduleFrequency: ScheduleFrequency? = nil,
        minIntervalHours: Double? = nil
    ) -> Medication {
        Medication(
            id: id,
            name: name,
            type: type,
            dosageAmount: dosageAmount,
            dosageUnit: dosageUnit,
            defaultQuantity: 1.0,
            scheduleFrequency: scheduleFrequency,
            photoUri: nil,
            active: active,
            notes: nil,
            category: category,
            minIntervalHours: minIntervalHours,
            createdAt: now,
            updatedAt: now
        )
    }

    static func makeSchedule(
        id: String = UUID().uuidString,
        medicationId: String,
        time: String = "08:00",
        dosage: Double = 1.0,
        enabled: Bool = true
    ) -> MedicationSchedule {
        MedicationSchedule(
            id: id,
            medicationId: medicationId,
            time: time,
            timezone: "America/New_York",
            dosage: dosage,
            enabled: enabled,
            notificationId: nil,
            reminderEnabled: true
        )
    }

    static func makeDose(
        id: String = UUID().uuidString,
        medicationId: String,
        timestamp: Int64? = nil,
        status: DoseStatus = .taken,
        quantity: Double = 1.0
    ) -> MedicationDose {
        let ts = timestamp ?? now
        return MedicationDose(
            id: id,
            medicationId: medicationId,
            timestamp: ts,
            quantity: quantity,
            dosageAmount: 400,
            dosageUnit: "mg",
            status: status,
            episodeId: nil,
            effectivenessRating: nil,
            timeToRelief: nil,
            sideEffects: [],
            notes: nil,
            createdAt: ts,
            updatedAt: ts
        )
    }

    static func makeDailyStatus(
        id: String = UUID().uuidString,
        date: String = "2025-01-15",
        status: DayStatus = .green,
        statusType: YellowDayType? = nil,
        notes: String? = nil
    ) -> DailyStatusLog {
        DailyStatusLog(
            id: id,
            date: date,
            status: status,
            statusType: statusType,
            notes: notes,
            prompted: false,
            createdAt: now,
            updatedAt: now
        )
    }
}
