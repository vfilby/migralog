import XCTest
@testable import MigraLog

final class TrackingOptionRepositoryTests: XCTestCase {
    private var dbManager: DatabaseManager!
    private var repo: TrackingOptionRepository!

    override func setUpWithError() throws {
        dbManager = try DatabaseManager(inMemory: true)
        repo = TrackingOptionRepository(dbManager: dbManager)
    }

    override func tearDown() {
        dbManager = nil
        repo = nil
    }

    // MARK: - Defaults

    func test_activeValues_defaultToBuiltIns_inCanonicalOrder() throws {
        XCTAssertEqual(
            try repo.getActiveValues(category: .trigger),
            Trigger.allCases.map(\.rawValue)
        )
        XCTAssertEqual(
            try repo.getActiveValues(category: .symptom),
            Symptom.allCases.map(\.rawValue)
        )
        XCTAssertEqual(
            try repo.getActiveValues(category: .painQuality),
            PainQuality.allCases.map(\.rawValue)
        )
    }

    // MARK: - Custom options

    func test_addCustomOption_appearsAfterBuiltIns() throws {
        // "Red Wine" matches the suggested catalog, so it stores canonically.
        try repo.addCustomOption(category: .trigger, value: "Red Wine")

        let values = try repo.getActiveValues(category: .trigger)
        XCTAssertEqual(values.last, "red_wine")
        XCTAssertEqual(values.count, Trigger.allCases.count + 1)
    }

    func test_addCustomOption_trimsWhitespace() throws {
        // A free-form value (no catalog match) is stored verbatim, trimmed.
        let option = try repo.addCustomOption(category: .symptom, value: "  Skipping Lunch  ")
        XCTAssertEqual(option.value, "Skipping Lunch")
    }

    func test_addCustomOption_rejectsEmptyValue() {
        XCTAssertThrowsError(try repo.addCustomOption(category: .trigger, value: "   ")) { error in
            XCTAssertEqual(error as? TrackingOptionError, .emptyValue)
        }
    }

    func test_addCustomOption_rejectsDuplicateOfCustom_caseInsensitive() throws {
        try repo.addCustomOption(category: .trigger, value: "Red Wine")
        XCTAssertThrowsError(try repo.addCustomOption(category: .trigger, value: "red wine")) { error in
            XCTAssertEqual(error as? TrackingOptionError, .duplicateValue)
        }
    }

    func test_addCustomOption_rejectsDuplicateOfBuiltInRawValue() {
        XCTAssertThrowsError(try repo.addCustomOption(category: .trigger, value: "stress")) { error in
            XCTAssertEqual(error as? TrackingOptionError, .duplicateValue)
        }
    }

    func test_addCustomOption_rejectsDuplicateOfBuiltInDisplayName() {
        // "Lack of Sleep" is the display name of built-in lack_of_sleep.
        XCTAssertThrowsError(try repo.addCustomOption(category: .trigger, value: "Lack of Sleep")) { error in
            XCTAssertEqual(error as? TrackingOptionError, .duplicateValue)
        }
    }

    func test_addCustomOption_allowsSameValueInDifferentCategories() throws {
        try repo.addCustomOption(category: .trigger, value: "Dehydration")
        XCTAssertNoThrow(try repo.addCustomOption(category: .symptom, value: "Dehydration"))
    }

    func test_deleteCustomOption_removesItFromActiveValues() throws {
        let option = try repo.addCustomOption(category: .trigger, value: "Red Wine")
        try repo.deleteCustomOption(id: option.id)

        XCTAssertFalse(try repo.getActiveValues(category: .trigger).contains("red_wine"))
        XCTAssertTrue(try repo.getAllOptions().isEmpty)
    }

    // MARK: - Hiding

    func test_hideBuiltIn_removesFromActiveValues_keepsOthersOrdered() throws {
        try repo.setHidden(category: .trigger, value: "stress", hidden: true)

        let values = try repo.getActiveValues(category: .trigger)
        XCTAssertFalse(values.contains("stress"))
        XCTAssertEqual(values, Trigger.allCases.map(\.rawValue).filter { $0 != "stress" })
    }

    func test_showBuiltIn_restoresDefault_andDropsOverrideRow() throws {
        try repo.setHidden(category: .trigger, value: "stress", hidden: true)
        try repo.setHidden(category: .trigger, value: "stress", hidden: false)

        XCTAssertEqual(
            try repo.getActiveValues(category: .trigger),
            Trigger.allCases.map(\.rawValue)
        )
        // Visible built-ins are the default state — no row should remain.
        XCTAssertTrue(try repo.getAllOptions().isEmpty)
    }

    func test_hideCustomOption_keepsRowButRemovesFromActiveValues() throws {
        try repo.addCustomOption(category: .symptom, value: "Brain Fog")
        // The catalog match stores canonically; hide by the stored value.
        try repo.setHidden(category: .symptom, value: "brain_fog", hidden: true)

        XCTAssertFalse(try repo.getActiveValues(category: .symptom).contains("brain_fog"))
        let options = try repo.getAllOptions()
        XCTAssertEqual(options.count, 1)
        XCTAssertTrue(options[0].isHidden)
        XCTAssertFalse(options[0].isBuiltIn)
    }

    func test_hideBuiltIn_isIdempotent() throws {
        try repo.setHidden(category: .painQuality, value: "dull", hidden: true)
        XCTAssertNoThrow(try repo.setHidden(category: .painQuality, value: "dull", hidden: true))
        XCTAssertEqual(try repo.getAllOptions().count, 1)
    }

    // MARK: - Suggested catalog & canonicalization

    func test_suggestedCatalog_isDisjointFromBuiltIns() {
        for category in TrackingOptionCategory.allCases {
            let overlap = Set(category.suggestedValues).intersection(category.builtInValues)
            XCTAssertTrue(overlap.isEmpty, "\(category) suggested values overlap built-ins: \(overlap)")
        }
    }

    func test_suggestedCatalog_hasNoDuplicates() {
        for category in TrackingOptionCategory.allCases {
            let values = category.suggestedValues
            XCTAssertEqual(values.count, Set(values).count, "\(category) suggested values contain duplicates")
        }
    }

    func test_addCustomOption_canonicalizesSuggestedDisplayName() throws {
        // Typing the display name of a catalog entry stores the canonical
        // snake_case value, so shared data stays consistent across users.
        let option = try repo.addCustomOption(category: .trigger, value: "red wine")
        XCTAssertEqual(option.value, "red_wine")
        XCTAssertEqual(try repo.getActiveValues(category: .trigger).last, "red_wine")
    }

    func test_addCustomOption_canonicalizesSuggestedRawValue() throws {
        let option = try repo.addCustomOption(category: .symptom, value: "BRAIN_FOG")
        XCTAssertEqual(option.value, "brain_fog")
    }

    func test_addCustomOption_freeFormTextStoredVerbatim() throws {
        let option = try repo.addCustomOption(category: .trigger, value: "Grandma's Cooking")
        XCTAssertEqual(option.value, "Grandma's Cooking")
    }

    func test_addCustomOption_duplicateOfAddedSuggestion_rejected() throws {
        try repo.addCustomOption(category: .trigger, value: "Red Wine")
        XCTAssertThrowsError(try repo.addCustomOption(category: .trigger, value: "red_wine")) { error in
            XCTAssertEqual(error as? TrackingOptionError, .duplicateValue)
        }
    }

    func test_displayNames_forSuggestedValues() {
        XCTAssertEqual(Trigger(rawValue: "red_wine").displayName, "Red Wine")
        XCTAssertEqual(Trigger(rawValue: "msg").displayName, "MSG")
        XCTAssertEqual(Symptom(rawValue: "brain_fog").displayName, "Brain Fog")
        XCTAssertEqual(PainQuality(rawValue: "band_like").displayName, "Band-like")
        // Free-form custom values display verbatim
        XCTAssertEqual(Trigger(rawValue: "Grandma's Cooking").displayName, "Grandma's Cooking")
    }

    // MARK: - Episode round-trip with custom values

    func test_episodeWithCustomValues_roundTrips() throws {
        let episodeRepo = EpisodeRepository(dbManager: dbManager)
        let now = TimestampHelper.now
        let episode = Episode(
            id: UUID().uuidString,
            startTime: now,
            endTime: nil,
            locations: [.leftTemple],
            qualities: [.throbbing, PainQuality(rawValue: "Vise-like")],
            symptoms: [.nausea, Symptom(rawValue: "Brain Fog")],
            triggers: [Trigger(rawValue: "Red Wine")],
            notes: nil,
            latitude: nil,
            longitude: nil,
            locationAccuracy: nil,
            locationTimestamp: nil,
            createdAt: now,
            updatedAt: now
        )
        _ = try episodeRepo.createEpisode(episode)

        let fetched = try episodeRepo.getEpisodeById(episode.id)
        XCTAssertEqual(fetched?.qualities, [.throbbing, PainQuality(rawValue: "Vise-like")])
        XCTAssertEqual(fetched?.symptoms, [.nausea, Symptom(rawValue: "Brain Fog")])
        XCTAssertEqual(fetched?.triggers, [Trigger(rawValue: "Red Wine")])
        XCTAssertEqual(fetched?.triggers.first?.displayName, "Red Wine")
    }
}
