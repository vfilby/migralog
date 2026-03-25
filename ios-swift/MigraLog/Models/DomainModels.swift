import Foundation

// MARK: - Episode

struct Episode: Identifiable, Equatable, Sendable {
    let id: String
    var startTime: Int64
    var endTime: Int64?
    var locations: [PainLocation]
    var qualities: [PainQuality]
    var symptoms: [Symptom]
    var triggers: [Trigger]
    var notes: String?
    var latitude: Double?
    var longitude: Double?
    var locationAccuracy: Double?
    var locationTimestamp: Int64?
    let createdAt: Int64
    var updatedAt: Int64

    var isActive: Bool { endTime == nil }

    var startDate: Date {
        Date(timeIntervalSince1970: Double(startTime) / 1000.0)
    }

    var endDate: Date? {
        endTime.map { Date(timeIntervalSince1970: Double($0) / 1000.0) }
    }

    var durationMillis: Int64? {
        guard let end = endTime else { return nil }
        return end - startTime
    }
}

// MARK: - Intensity Reading

struct IntensityReading: Identifiable, Equatable, Sendable {
    let id: String
    let episodeId: String
    var timestamp: Int64
    var intensity: Double
    let createdAt: Int64
    var updatedAt: Int64

    var date: Date {
        Date(timeIntervalSince1970: Double(timestamp) / 1000.0)
    }
}

// MARK: - Symptom Log

struct SymptomLog: Identifiable, Equatable, Sendable {
    let id: String
    let episodeId: String
    var symptom: Symptom
    var onsetTime: Int64
    var resolutionTime: Int64?
    var severity: Double?
    let createdAt: Int64
}

// MARK: - Pain Location Log

struct PainLocationLog: Identifiable, Equatable, Sendable {
    let id: String
    let episodeId: String
    var timestamp: Int64
    var painLocations: [PainLocation]
    let createdAt: Int64
    var updatedAt: Int64
}

// MARK: - Episode Note

struct EpisodeNote: Identifiable, Equatable, Sendable {
    let id: String
    let episodeId: String
    var timestamp: Int64
    var note: String
    let createdAt: Int64

    var date: Date {
        Date(timeIntervalSince1970: Double(timestamp) / 1000.0)
    }
}

// MARK: - Medication

struct Medication: Identifiable, Equatable, Sendable {
    let id: String
    var name: String
    var type: MedicationType
    var dosageAmount: Double
    var dosageUnit: String
    var defaultQuantity: Double?
    var scheduleFrequency: ScheduleFrequency?
    var photoUri: String?
    var active: Bool
    var notes: String?
    var category: MedicationCategory?
    let createdAt: Int64
    var updatedAt: Int64
}

// MARK: - Medication Schedule

struct MedicationSchedule: Identifiable, Equatable, Sendable {
    let id: String
    let medicationId: String
    var time: String // HH:mm format
    var timezone: String
    var dosage: Double
    var enabled: Bool
    var notificationId: String?
    var reminderEnabled: Bool

    var timeComponents: (hour: Int, minute: Int)? {
        let parts = time.split(separator: ":")
        guard parts.count == 2,
              let hour = Int(parts[0]),
              let minute = Int(parts[1]) else { return nil }
        return (hour, minute)
    }
}

// MARK: - Medication Dose

struct MedicationDose: Identifiable, Equatable, Sendable {
    let id: String
    let medicationId: String
    var timestamp: Int64
    var quantity: Double
    var dosageAmount: Double?
    var dosageUnit: String?
    var status: DoseStatus
    var episodeId: String?
    var effectivenessRating: Double?
    var timeToRelief: Int?
    var sideEffects: [String]
    var notes: String?
    let createdAt: Int64
    var updatedAt: Int64

    var date: Date {
        Date(timeIntervalSince1970: Double(timestamp) / 1000.0)
    }
}

// MARK: - Medication Reminder

struct MedicationReminder: Identifiable, Equatable, Sendable {
    let id: String
    let medicationId: String
    var scheduledTime: Int64
    var completed: Bool
    var snoozedUntil: Int64?
    var completedAt: Int64?
}

// MARK: - Daily Status Log

struct DailyStatusLog: Identifiable, Equatable, Sendable {
    let id: String
    var date: String // YYYY-MM-DD
    var status: DayStatus
    var statusType: YellowDayType?
    var notes: String?
    var prompted: Bool
    let createdAt: Int64
    var updatedAt: Int64
}

// MARK: - Calendar Overlay

struct CalendarOverlay: Identifiable, Equatable, Sendable {
    let id: String
    var startDate: String // YYYY-MM-DD
    var endDate: String? // YYYY-MM-DD, nil = ongoing
    var label: String
    var notes: String?
    var excludeFromStats: Bool
    let createdAt: Int64
    var updatedAt: Int64
}

// MARK: - Scheduled Notification

struct ScheduledNotification: Identifiable, Equatable, Sendable {
    let id: String
    var medicationId: String?
    var scheduleId: String?
    var date: String
    var notificationId: String
    var notificationType: NotificationType
    var isGrouped: Bool
    var groupKey: String?
    var sourceType: NotificationSourceType
    var medicationName: String?
    var scheduledTriggerTime: String?
    var notificationTitle: String?
    var notificationBody: String?
    var categoryIdentifier: String?
    let createdAt: Int64
}

// MARK: - Composite Types

struct EpisodeWithDetails: Identifiable, Equatable, Sendable {
    let episode: Episode
    var intensityReadings: [IntensityReading]
    var symptomLogs: [SymptomLog]
    var painLocationLogs: [PainLocationLog]
    var episodeNotes: [EpisodeNote]

    var id: String { episode.id }
}

struct MedicationWithDetails: Identifiable, Equatable, Sendable {
    let medication: Medication
    var schedules: [MedicationSchedule]
    var recentDoses: [MedicationDose]

    var id: String { medication.id }
}

struct DoseWithMedication: Identifiable, Equatable, Sendable {
    let dose: MedicationDose
    let medication: Medication

    var id: String { dose.id }
}

// MARK: - Export Types

struct ExportMetadata: Codable, Sendable {
    let id: String
    let timestamp: Int64
    let version: String
    let schemaVersion: Int
    let episodeCount: Int
    let medicationCount: Int
    var overlayCount: Int?
}

struct ExportData: Codable, Sendable {
    let metadata: ExportMetadata
    var episodes: [ExportEpisode]
    var episodeNotes: [ExportEpisodeNote]?
    var intensityReadings: [ExportIntensityReading]?
    var dailyStatusLogs: [ExportDailyStatusLog]?
    var calendarOverlays: [ExportCalendarOverlay]?
    var medications: [ExportMedication]
    var medicationDoses: [ExportMedicationDose]
    var medicationSchedules: [ExportMedicationSchedule]
}

// MARK: - Export Codable Models (matching JSON schema exactly)

struct ExportEpisode: Codable, Sendable {
    let id: String
    let startTime: Int64
    var endTime: Int64?
    let locations: [String]
    let qualities: [String]
    let symptoms: [String]
    let triggers: [String]
    var notes: String?
    var location: ExportEpisodeLocation?
    let createdAt: Int64
    let updatedAt: Int64
}

struct ExportEpisodeLocation: Codable, Sendable {
    let latitude: Double
    let longitude: Double
    var accuracy: Double?
    let timestamp: Int64
}

struct ExportEpisodeNote: Codable, Sendable {
    let id: String
    let episodeId: String
    let timestamp: Int64
    let note: String
    let createdAt: Int64
}

struct ExportIntensityReading: Codable, Sendable {
    let id: String
    let episodeId: String
    let timestamp: Int64
    let intensity: Double
    let createdAt: Int64
    let updatedAt: Int64
}

struct ExportDailyStatusLog: Codable, Sendable {
    let id: String
    let date: String
    let status: String
    var statusType: String?
    var notes: String?
    let prompted: Bool
    let createdAt: Int64
    let updatedAt: Int64
}

struct ExportCalendarOverlay: Codable, Sendable {
    let id: String
    let startDate: String
    var endDate: String?
    let label: String
    var notes: String?
    let excludeFromStats: Bool
    let createdAt: Int64
    let updatedAt: Int64
}

struct ExportMedication: Codable, Sendable {
    let id: String
    let name: String
    let type: String
    let dosageAmount: Double
    let dosageUnit: String
    var defaultQuantity: Double?
    var scheduleFrequency: String?
    var photoUri: String?
    let active: Bool
    var notes: String?
    var category: String?
    let createdAt: Int64
    let updatedAt: Int64
}

struct ExportMedicationDose: Codable, Sendable {
    let id: String
    let medicationId: String
    let timestamp: Int64
    let quantity: Double
    var dosageAmount: Double?
    var dosageUnit: String?
    var status: String?
    var episodeId: String?
    var effectivenessRating: Double?
    var timeToRelief: Int?
    var sideEffects: [String]?
    var notes: String?
    let createdAt: Int64
    let updatedAt: Int64
}

struct ExportMedicationSchedule: Codable, Sendable {
    let id: String
    let medicationId: String
    let time: String
    let timezone: String
    let dosage: Double
    let enabled: Bool
    var notificationId: String?
    var reminderEnabled: Bool?
}

// MARK: - Backup Types

struct BackupMetadata: Codable, Sendable {
    let id: String
    let timestamp: Int64
    let version: String
    let schemaVersion: Int
    let episodeCount: Int
    let medicationCount: Int
    var fileSize: Int64?
    var fileName: String?
    var backupType: String?
}
