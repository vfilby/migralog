import XCTest
import Sentry
@testable import MigraLog

/// HIPAA regression tests for the Sentry PHI scrubber (issue #528).
///
/// The scrubber is the last line of defense keeping health data out of crash
/// reports. These tests construct synthetic `Event`s with sensitive keys in
/// every caller-writable field and assert they come out `[REDACTED]`.
final class SentrySetupTests: XCTestCase {

    private static let redacted = "[REDACTED]"

    // Representative sensitive keys we expect the scrubber to catch. `date` is
    // the key #528 was filed for; the rest cover the categories of PHI we emit.
    private static let sensitiveKeys: [String] = [
        // The headline regression: a bare date is PHI on its own.
        "date", "dateString", "timestamp", "occurredAt", "onsetDate",
        "createdAt", "loggedAt", "startTime", "endTime",
        // Medication
        "medication", "medicationName", "dose", "dosage", "medicationId",
        // Episode / symptoms
        "intensity", "painLocation", "symptom", "symptoms", "trigger",
        // Notes / identity
        "notes", "note", "userNotes", "name", "userName", "email",
        // Location
        "latitude", "longitude", "location", "locationTimestamp",
        // Substring-fallback variants that are NOT exact matches but must
        // still be caught (these guard the substring rule).
        "episodeDate", "medicationLogId", "symptomSeverity",
    ]

    // A non-sensitive key that must survive scrubbing untouched, so we know the
    // scrubber isn't just redacting everything.
    private static let safeKey = "deviationCount"
    private static let safeValue = 42

    private func sensitivePayload() -> [String: Any] {
        var payload: [String: Any] = [:]
        for key in Self.sensitiveKeys {
            payload[key] = "sensitive-value-for-\(key)"
        }
        payload[Self.safeKey] = Self.safeValue
        return payload
    }

    private func assertScrubbed(_ dict: [String: Any]?, field: String) {
        guard let dict else {
            XCTFail("\(field) was nil after scrubbing")
            return
        }
        for key in Self.sensitiveKeys {
            XCTAssertEqual(
                dict[key] as? String,
                Self.redacted,
                "Sensitive key '\(key)' in \(field) was NOT redacted — PHI would leak to Sentry"
            )
        }
        XCTAssertEqual(
            dict[Self.safeKey] as? Int,
            Self.safeValue,
            "Non-sensitive key '\(Self.safeKey)' in \(field) was incorrectly altered"
        )
    }

    // MARK: - extra

    func testExtraSensitiveKeysAreRedacted() {
        let event = Event()
        event.extra = sensitivePayload()

        let scrubbed = SentrySetup.scrubSensitiveData(from: event)

        assertScrubbed(scrubbed.extra, field: "extra")
    }

    // MARK: - breadcrumbs

    func testBreadcrumbDataSensitiveKeysAreRedacted() {
        let event = Event()
        let breadcrumb = Breadcrumb()
        breadcrumb.data = sensitivePayload()
        event.breadcrumbs = [breadcrumb]

        let scrubbed = SentrySetup.scrubSensitiveData(from: event)

        assertScrubbed(scrubbed.breadcrumbs?.first?.data, field: "breadcrumb.data")
    }

    // MARK: - tags

    func testTagSensitiveKeysAreRedacted() {
        let event = Event()
        var tags: [String: String] = [:]
        for key in Self.sensitiveKeys {
            tags[key] = "sensitive-tag-\(key)"
        }
        tags[Self.safeKey] = "safe"
        event.tags = tags

        let scrubbed = SentrySetup.scrubSensitiveData(from: event)

        guard let scrubbedTags = scrubbed.tags else {
            return XCTFail("tags were nil after scrubbing")
        }
        for key in Self.sensitiveKeys {
            XCTAssertEqual(
                scrubbedTags[key],
                Self.redacted,
                "Sensitive tag '\(key)' was NOT redacted — PHI would leak to Sentry"
            )
        }
        XCTAssertEqual(scrubbedTags[Self.safeKey], "safe", "Safe tag was altered")
    }

    // MARK: - custom contexts

    func testCustomContextSensitiveKeysAreRedacted() {
        let event = Event()
        event.context = ["episode": sensitivePayload()]

        let scrubbed = SentrySetup.scrubSensitiveData(from: event)

        assertScrubbed(scrubbed.context?["episode"], field: "context.episode")
    }

    // MARK: - the #528 headline case, explicit

    func testBareDateKeyIsRedacted() {
        let event = Event()
        event.extra = ["date": "2026-06-18T09:30:00Z"]

        let scrubbed = SentrySetup.scrubSensitiveData(from: event)

        XCTAssertEqual(
            scrubbed.extra?["date"] as? String,
            Self.redacted,
            "A 'date' key must be redacted (issue #528)"
        )
    }

    func testBareDateBreadcrumbKeyIsRedacted() {
        let event = Event()
        let breadcrumb = Breadcrumb()
        breadcrumb.data = ["date": "2026-06-18"]
        event.breadcrumbs = [breadcrumb]

        let scrubbed = SentrySetup.scrubSensitiveData(from: event)

        XCTAssertEqual(
            scrubbed.breadcrumbs?.first?.data?["date"] as? String,
            Self.redacted,
            "A 'date' breadcrumb key must be redacted (issue #528)"
        )
    }

    // MARK: - regression guard

    /// Canary: if a new sensitive key is introduced into the scrubber's key
    /// list but the matching logic regresses, this fails. Every key declared
    /// sensitive here must be redacted when present in `extra`.
    func testEverySensitiveKeyIsRedactedInExtra() {
        for key in Self.sensitiveKeys {
            let event = Event()
            event.extra = [key: "value", Self.safeKey: Self.safeValue]

            let scrubbed = SentrySetup.scrubSensitiveData(from: event)

            XCTAssertEqual(
                scrubbed.extra?[key] as? String,
                Self.redacted,
                "Scrubber missed sensitive key '\(key)' — would leak PHI to Sentry"
            )
            XCTAssertEqual(
                scrubbed.extra?[Self.safeKey] as? Int,
                Self.safeValue,
                "Scrubber over-redacted: safe key removed alongside '\(key)'"
            )
        }
    }
}
