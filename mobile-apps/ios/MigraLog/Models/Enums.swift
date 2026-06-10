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

    /// Short region name without Left/Right prefix (for the grid where columns are labeled)
    var regionName: String {
        switch self {
        case .leftEye, .rightEye: return "Eye"
        case .leftTemple, .rightTemple: return "Temple"
        case .leftNeck, .rightNeck: return "Neck"
        case .leftHead, .rightHead: return "Head"
        case .leftTeeth, .rightTeeth: return "Teeth"
        }
    }
}

/// Pain qualities, symptoms and triggers are open value sets: the built-in
/// values ship enabled, a larger suggested catalog is offered via
/// autocomplete when adding options, and users can also add free-form
/// values (stored in the `tracking_options` table). They are structs
/// wrapping a raw string — not closed enums — so custom values and values
/// synced from a newer app version survive decoding instead of being
/// silently dropped.
///
/// Raw-value conventions: the built-ins use snake_case identifiers (a
/// holdover from when these were closed enums — existing episodes already
/// store them); everything added later — suggested-catalog picks and
/// free-form custom values — stores human-readable text exactly as shown
/// in the UI ("Red Wine", "MSG"), with no derived transformation. Display
/// transformations are risky on text we don't control (unknown acronyms,
/// hyphenation), so values display verbatim; mapping to canonical
/// identifiers is deliberately deferred to whatever layer actually shares
/// or aggregates data. The stable identity is the raw value, so renaming
/// an option is intentionally unsupported (delete + re-add creates a new
/// identity without rewriting history).
protocol TrackableOptionValue: RawRepresentable, Codable, Hashable, Identifiable, CaseIterable, Sendable
where RawValue == String, AllCases == [Self] {
    init(rawValue: String)
    /// The built-in values that ship enabled, in display order.
    static var allCases: [Self] { get }
    /// The suggested catalog: well-known values offered via autocomplete,
    /// in display order. Raw values are display-ready text, stored as-is.
    /// Disjoint from `allCases`.
    static var suggested: [Self] { get }
    /// Built-in display names that the default snake_case → Title Case
    /// formatting gets wrong (e.g. "lack_of_sleep" → "Lack of Sleep").
    static var displayNameOverrides: [String: String] { get }
}

extension TrackableOptionValue {
    var id: String { rawValue }

    init(from decoder: Decoder) throws {
        self.init(rawValue: try decoder.singleValueContainer().decode(String.self))
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(rawValue)
    }

    var isBuiltIn: Bool { Self.allCases.contains(self) }

    /// Only the snake_case built-ins need formatting; every other value is
    /// display-ready text and shows verbatim.
    var displayName: String {
        if let override = Self.displayNameOverrides[rawValue] { return override }
        guard isBuiltIn else { return rawValue }
        return rawValue.split(separator: "_")
            .map { String($0).capitalized }
            .joined(separator: " ")
    }

    /// The catalog value (built-in or suggested) whose raw value or display
    /// name matches `text` case-insensitively, if any. Lets typed input
    /// adopt the catalog entry's exact casing ("red wine" → "Red Wine")
    /// instead of becoming a near-duplicate, and routes built-in matches
    /// into duplicate detection.
    static func known(matching text: String) -> Self? {
        (allCases + suggested).first {
            $0.rawValue.caseInsensitiveCompare(text) == .orderedSame
                || $0.displayName.caseInsensitiveCompare(text) == .orderedSame
        }
    }
}

struct PainQuality: TrackableOptionValue {
    let rawValue: String

    static let throbbing = PainQuality(rawValue: "throbbing")
    static let sharp = PainQuality(rawValue: "sharp")
    static let dull = PainQuality(rawValue: "dull")
    static let pressure = PainQuality(rawValue: "pressure")
    static let stabbing = PainQuality(rawValue: "stabbing")
    static let burning = PainQuality(rawValue: "burning")

    static let allCases: [PainQuality] = [
        .throbbing, .sharp, .dull, .pressure, .stabbing, .burning
    ]

    static let suggested: [PainQuality] = [
        "Pounding", "Piercing", "Squeezing", "Band-like", "Vise-like",
        "Shooting", "Electric", "Aching", "Splitting", "Drilling", "Radiating"
    ].map(PainQuality.init(rawValue:))

    static let displayNameOverrides: [String: String] = [:]
}

struct Symptom: TrackableOptionValue {
    let rawValue: String

    static let nausea = Symptom(rawValue: "nausea")
    static let vomiting = Symptom(rawValue: "vomiting")
    static let visualDisturbances = Symptom(rawValue: "visual_disturbances")
    static let aura = Symptom(rawValue: "aura")
    static let lightSensitivity = Symptom(rawValue: "light_sensitivity")
    static let soundSensitivity = Symptom(rawValue: "sound_sensitivity")
    static let smellSensitivity = Symptom(rawValue: "smell_sensitivity")
    static let dizziness = Symptom(rawValue: "dizziness")
    static let confusion = Symptom(rawValue: "confusion")

    static let allCases: [Symptom] = [
        .nausea, .vomiting, .visualDisturbances, .aura, .lightSensitivity,
        .soundSensitivity, .smellSensitivity, .dizziness, .confusion
    ]

    static let suggested: [Symptom] = [
        "Neck Pain", "Neck Stiffness", "Brain Fog", "Fatigue", "Yawning",
        "Food Cravings", "Irritability", "Mood Changes", "Euphoria",
        "Tinnitus", "Vertigo", "Numbness", "Tingling", "Weakness",
        "Speech Difficulty", "Scalp Tenderness", "Eye Watering",
        "Nasal Congestion", "Droopy Eyelid", "Restlessness",
        "Frequent Urination", "Diarrhea", "Constipation",
        "Difficulty Concentrating"
    ].map(Symptom.init(rawValue:))

    static let displayNameOverrides: [String: String] = [:]
}

struct Trigger: TrackableOptionValue {
    let rawValue: String

    static let stress = Trigger(rawValue: "stress")
    static let lackOfSleep = Trigger(rawValue: "lack_of_sleep")
    static let weatherChange = Trigger(rawValue: "weather_change")
    static let brightLights = Trigger(rawValue: "bright_lights")
    static let loudSounds = Trigger(rawValue: "loud_sounds")
    static let alcohol = Trigger(rawValue: "alcohol")
    static let caffeine = Trigger(rawValue: "caffeine")
    static let food = Trigger(rawValue: "food")
    static let hormonal = Trigger(rawValue: "hormonal")
    static let exercise = Trigger(rawValue: "exercise")

    static let allCases: [Trigger] = [
        .stress, .lackOfSleep, .weatherChange, .brightLights, .loudSounds,
        .alcohol, .caffeine, .food, .hormonal, .exercise
    ]

    static let suggested: [Trigger] = [
        "Dehydration", "Skipped Meals", "Red Wine", "Chocolate",
        "Aged Cheese", "MSG", "Artificial Sweeteners", "Processed Meat",
        "Citrus", "Oversleeping", "Jet Lag", "Screen Time", "Strong Smells",
        "Smoke", "Neck Tension", "Poor Posture", "Allergies",
        "High Altitude", "Heat", "Humidity", "Menstruation", "Anxiety",
        "Crying", "Motion Sickness"
    ].map(Trigger.init(rawValue:))

    static let displayNameOverrides: [String: String] = [
        "lack_of_sleep": "Lack of Sleep"
    ]
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

extension MedicationCategory {
    /// Common MOH (medication overuse headache) guideline defaults used to pre-fill
    /// the Add Limit sheet. Informational only — not medical advice.
    var mohPreset: (maxDays: Int, windowDays: Int)? {
        switch self {
        case .nsaid:   return (15, 30)
        case .triptan: return (10, 30)
        case .otc, .cgrp, .preventive, .supplement, .other:
            return nil
        }
    }
}

extension MedicationCategory {
    /// Common cooldown-guideline defaults used to pre-fill the Add Cooldown
    /// sheet. Informational only — not medical advice. Nil for categories
    /// without a well-established single guideline.
    var cooldownPreset: Double? {
        switch self {
        case .triptan: return 2.0
        case .otc, .nsaid, .cgrp, .preventive, .supplement, .other:
            return nil
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
    case fourteenDays = 14
    case thirtyDays = 30
    case sixtyDays = 60
    case ninetyDays = 90

    var id: Int { rawValue }

    var displayName: String { "\(rawValue)d" }
}
