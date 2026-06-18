import Foundation
import Sentry

enum SentrySetup {
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
            options.configureProfiling = {
                $0.sessionSampleRate = 1.0
                $0.lifecycle = .trace
            }
            options.enableAutoSessionTracking = true
            // HIPAA: never attach screenshots. The visible screen routinely
            // contains PHI (medication names/doses, intensity/symptoms, notes)
            // and the key-based beforeSend scrubber cannot redact image content.
            options.attachScreenshot = false
            options.enableUserInteractionTracing = true

            // App Hangs V2 (default-on since sentry-cocoa 9.0) reports app
            // suspension as fully-blocked hangs — including unfilterable
            // "fatal" hangs when iOS terminates the suspended app (#489).
            // Watchdog termination tracking stays enabled and still catches
            // real severe hangs.
            options.enableAppHangTracking = false

            // HIPAA: Scrub sensitive health data before sending
            options.beforeSend = { event in
                return scrubSensitiveData(from: event)
            }
        }
    }

    // MARK: - Privacy Scrubbing

    /// Keys that may contain PHI/sensitive health data.
    ///
    /// Compared case-insensitively (see `isSensitiveKey`), so list the
    /// canonical form once.
    private static let sensitiveKeys: Set<String> = [
        // Medication fields
        "medication", "medicationname", "medication_name",
        "dose", "dosage", "units", "medicationid",
        // Episode fields
        "intensity", "pain_location", "painlocation",
        "symptom", "symptoms", "trigger", "triggers",
        // User data
        "notes", "note", "usernotes", "user_notes",
        "name", "username", "email",
        // Location
        "latitude", "longitude", "location",
        "locationaccuracy", "locationtimestamp",
        // Dates/times. A specific episode/dose date is PHI on its own
        // (it reveals when a person had a migraine or took medication),
        // so any date-bearing key is redacted. Sentry's own automatic
        // event/breadcrumb timestamps are separate fields and unaffected.
        "date", "datestring", "timestamp", "createdat", "created_at",
        "updatedat", "updated_at", "loggedat", "logged_at",
        "starttime", "start_time", "endtime", "end_time",
        "occurredat", "occurred_at", "onset", "onsetdate",
    ]

    /// Substrings that mark any containing key as sensitive (case-insensitive),
    /// so newly-introduced variants (e.g. `medicationLogId`, `symptomNotes`,
    /// `episodeDate`) are caught without an exact match.
    private static let sensitiveSubstrings: [String] = [
        "medication", "symptom", "date",
    ]

    /// Whether a dictionary key should be redacted. Case-insensitive, with a
    /// substring fallback for un-enumerated variants.
    private static func isSensitiveKey(_ key: String) -> Bool {
        let lowered = key.lowercased()
        if sensitiveKeys.contains(lowered) { return true }
        return sensitiveSubstrings.contains { lowered.contains($0) }
    }

    private static let redacted = "[REDACTED]"

    /// Scrub sensitive data from Sentry events (HIPAA compliance).
    ///
    /// Walks every event field where caller-supplied PHI can land:
    /// `extra`, `breadcrumbs[].data`, `tags`, and custom `context` values.
    /// Sentry-maintained fields (message/exception strings, stack traces,
    /// auto-populated contexts like device/os/app) are not key:value PHI
    /// carriers; we deliberately do not attempt free-text redaction there.
    ///
    /// Internal (not private) so the HIPAA regression test can exercise it
    /// directly via `@testable import`.
    static func scrubSensitiveData(from event: Event) -> Event {
        // Scrub extra data
        if let extra = event.extra {
            event.extra = redactSensitiveValues(in: extra)
        }

        // Scrub breadcrumb data
        if let breadcrumbs = event.breadcrumbs {
            for breadcrumb in breadcrumbs {
                if let data = breadcrumb.data {
                    breadcrumb.data = redactSensitiveValues(in: data)
                }
            }
        }

        // Scrub tags (String:String) — callers can attach arbitrary tags.
        if let tags = event.tags {
            var scrubbed = tags
            for key in tags.keys where isSensitiveKey(key) {
                scrubbed[key] = redacted
            }
            event.tags = scrubbed
        }

        // Scrub custom contexts. `context` is a dict of named context
        // dictionaries; redact sensitive keys inside each one.
        if let context = event.context {
            var scrubbedContext = context
            for (name, values) in context {
                scrubbedContext[name] = redactSensitiveValues(in: values)
            }
            event.context = scrubbedContext
        }

        return event
    }

    /// Returns a copy of `dictionary` with sensitive keys' values replaced by
    /// `[REDACTED]`.
    private static func redactSensitiveValues(in dictionary: [String: Any]) -> [String: Any] {
        var result = dictionary
        for key in dictionary.keys where isSensitiveKey(key) {
            result[key] = redacted
        }
        return result
    }
}
