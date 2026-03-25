import Foundation

// MARK: - Pain & Symptom Enums

enum PainLocation: String, Codable, CaseIterable, Identifiable {
    case leftEye = "left_eye"
    case rightEye = "right_eye"
    case leftTemple = "left_temple"
    case rightTemple = "right_temple"
    case leftNeck = "left_neck"
    case rightNeck = "right_neck"
    case leftHead = "left_head"
    case rightHead = "right_head"
    case leftTeeth = "left_teeth"
    case rightTeeth = "right_teeth"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .leftEye: return "Left Eye"
        case .rightEye: return "Right Eye"
        case .leftTemple: return "Left Temple"
        case .rightTemple: return "Right Temple"
        case .leftNeck: return "Left Neck"
        case .rightNeck: return "Right Neck"
        case .leftHead: return "Left Head"
        case .rightHead: return "Right Head"
        case .leftTeeth: return "Left Teeth"
        case .rightTeeth: return "Right Teeth"
        }
    }
}

enum PainQuality: String, Codable, CaseIterable, Identifiable {
    case throbbing
    case sharp
    case dull
    case pressure
    case stabbing
    case burning

    var id: String { rawValue }

    var displayName: String { rawValue.capitalized }
}

enum Symptom: String, Codable, CaseIterable, Identifiable {
    case nausea
    case vomiting
    case visualDisturbances = "visual_disturbances"
    case aura
    case lightSensitivity = "light_sensitivity"
    case soundSensitivity = "sound_sensitivity"
    case smellSensitivity = "smell_sensitivity"
    case dizziness
    case confusion

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .visualDisturbances: return "Visual Disturbances"
        case .lightSensitivity: return "Light Sensitivity"
        case .soundSensitivity: return "Sound Sensitivity"
        case .smellSensitivity: return "Smell Sensitivity"
        default: return rawValue.capitalized
        }
    }
}

enum Trigger: String, Codable, CaseIterable, Identifiable {
    case stress
    case lackOfSleep = "lack_of_sleep"
    case weatherChange = "weather_change"
    case brightLights = "bright_lights"
    case loudSounds = "loud_sounds"
    case alcohol
    case caffeine
    case food
    case hormonal
    case exercise

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .lackOfSleep: return "Lack of Sleep"
        case .weatherChange: return "Weather Change"
        case .brightLights: return "Bright Lights"
        case .loudSounds: return "Loud Sounds"
        default: return rawValue.capitalized
        }
    }
}

// MARK: - Medication Enums

enum MedicationType: String, Codable, CaseIterable, Identifiable {
    case preventative
    case rescue
    case other

    var id: String { rawValue }

    var displayName: String { rawValue.capitalized }
}

enum ScheduleFrequency: String, Codable, CaseIterable, Identifiable {
    case daily
    case monthly
    case quarterly

    var id: String { rawValue }

    var displayName: String { rawValue.capitalized }
}

enum MedicationCategory: String, Codable, CaseIterable, Identifiable {
    case otc
    case nsaid
    case triptan
    case cgrp
    case preventive
    case supplement
    case other

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .otc: return "OTC"
        case .nsaid: return "NSAID"
        case .triptan: return "Triptan"
        case .cgrp: return "CGRP"
        case .preventive: return "Preventive"
        case .supplement: return "Supplement"
        case .other: return "Other"
        }
    }
}

// MARK: - Daily Status Enums

enum DayStatus: String, Codable, CaseIterable, Identifiable {
    case green
    case yellow
    case red

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .green: return "Clear"
        case .yellow: return "Not Clear"
        case .red: return "Migraine"
        }
    }
}

enum YellowDayType: String, Codable, CaseIterable, Identifiable {
    case prodrome
    case postdrome
    case anxiety
    case other

    var id: String { rawValue }

    var displayName: String { rawValue.capitalized }
}

// MARK: - Dose Status

enum DoseStatus: String, Codable, CaseIterable, Identifiable {
    case taken
    case skipped

    var id: String { rawValue }

    var displayName: String { rawValue.capitalized }
}

// MARK: - Notification Types

enum NotificationType: String, Codable {
    case reminder
    case followUp = "follow_up"
    case dailyCheckin = "daily_checkin"
}

enum NotificationSourceType: String, Codable {
    case medication
    case dailyCheckin = "daily_checkin"
}

// MARK: - Time Range

enum TimeRangeDays: Int, CaseIterable, Identifiable {
    case sevenDays = 7
    case fourteenDays = 14
    case thirtyDays = 30
    case sixtyDays = 60
    case ninetyDays = 90

    var id: Int { rawValue }

    var displayName: String { "\(rawValue)d" }
}
