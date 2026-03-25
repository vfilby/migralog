import Foundation
import Sentry

enum SentrySetup {
    /// The same project DSN used by the React Native app
    private static let dsn = "https://15bd8c3b6589a60a5e10f2703923db39@o4510275950608384.ingest.us.sentry.io/4510275952312320"

    /// Initialize Sentry. Call once at app startup.
    static func start() {
        #if DEBUG
        // Only enable in debug if explicitly requested
        guard ProcessInfo.processInfo.environment["SENTRY_ENABLED"] == "true" else { return }
        #endif

        SentrySDK.start { options in
            options.dsn = dsn
            options.tracesSampleRate = 1.0  // 100% for small user base
            options.profilesSampleRate = 1.0
            options.enableAutoSessionTracking = true
            options.attachScreenshot = true
            options.enableUserInteractionTracing = true

            // HIPAA: Scrub sensitive health data before sending
            options.beforeSend = { event in
                return scrubSensitiveData(from: event)
            }
        }
    }

    // MARK: - Privacy Scrubbing

    /// Keys that may contain PHI/sensitive health data
    private static let sensitiveKeys: Set<String> = [
        // Medication fields
        "medication", "medicationName", "medication_name",
        "dose", "dosage", "units", "medicationId",
        // Episode fields
        "intensity", "pain_location", "painLocation",
        "symptom", "symptoms", "trigger", "triggers",
        // User data
        "notes", "note", "userNotes", "user_notes",
        "name", "userName", "email",
        // Location
        "latitude", "longitude", "location",
        "locationAccuracy", "locationTimestamp",
    ]

    /// Scrub sensitive data from Sentry events (HIPAA compliance)
    private static func scrubSensitiveData(from event: Event) -> Event {
        // Scrub extra data
        if var extra = event.extra {
            for key in extra.keys {
                if sensitiveKeys.contains(key) || key.lowercased().contains("medication") || key.lowercased().contains("symptom") {
                    extra[key] = "[REDACTED]"
                }
            }
            event.extra = extra
        }

        // Scrub breadcrumb data
        if let breadcrumbs = event.breadcrumbs {
            for breadcrumb in breadcrumbs {
                if var data = breadcrumb.data {
                    for key in data.keys {
                        if sensitiveKeys.contains(key) || key.lowercased().contains("medication") || key.lowercased().contains("symptom") {
                            data[key] = "[REDACTED]"
                        }
                    }
                    breadcrumb.data = data
                }
            }
        }

        return event
    }
}
