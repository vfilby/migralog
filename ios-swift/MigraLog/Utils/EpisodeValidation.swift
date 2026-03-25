import Foundation

enum EpisodeValidation {
    struct ValidationResult {
        let isValid: Bool
        let error: String?
    }

    static func validateEndTime(startTime: Int64, endTime: Int64?) -> ValidationResult {
        guard let endTime = endTime else {
            return ValidationResult(isValid: true, error: nil)
        }
        if endTime <= startTime {
            return ValidationResult(isValid: false, error: "End time must be after start time")
        }
        return ValidationResult(isValid: true, error: nil)
    }

    static func validateIntensity(_ intensity: Double) -> ValidationResult {
        if intensity < 0 || intensity > 10 {
            return ValidationResult(isValid: false, error: "Intensity must be between 0 and 10")
        }
        return ValidationResult(isValid: true, error: nil)
    }

    static func validateDoseQuantity(_ quantity: Double) -> ValidationResult {
        if quantity <= 0 {
            return ValidationResult(isValid: false, error: "Invalid Amount")
        }
        return ValidationResult(isValid: true, error: nil)
    }
}
