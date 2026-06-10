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
        try repo.addCustomOption(category: .trigger, value: "Red Wine")

        let values = try repo.getActiveValues(category: .trigger)
        XCTAssertEqual(values.last, "Red Wine")
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

        XCTAssertFalse(try repo.getActiveValues(category: .trigger).contains("Red Wine"))
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
        try repo.setHidden(category: .symptom, value: "Brain Fog", hidden: true)

        XCTAssertFalse(try repo.getActiveValues(category: .symptom).contains("Brain Fog"))
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
            let builtIn = Set(
                (category.builtInValues + category.builtInValues.map { category.displayName(forValue: $0) })
                    .map { $0.lowercased() }
            )
            let overlap = category.suggestedValues.filter { builtIn.contains($0.lowercased()) }
            XCTAssertTrue(overlap.isEmpty, "\(category) suggested values overlap built-ins: \(overlap)")
        }
    }

    func test_suggestedCatalog_hasNoDuplicates() {
        for category in TrackingOptionCategory.allCases {
            let values = category.suggestedValues
            XCTAssertEqual(values.count, Set(values).count, "\(category) suggested values contain duplicates")
        }
    }

    func test_addCustomOption_typedMatchAdoptsCatalogCasing() throws {
        // Typed input matching a catalog entry case-insensitively stores the
        // entry's exact text — no derived transformation, just its casing.
        let option = try repo.addCustomOption(category: .trigger, value: "red wine")
        XCTAssertEqual(option.value, "Red Wine")
        XCTAssertEqual(try repo.getActiveValues(category: .trigger).last, "Red Wine")
    }

    func test_addCustomOption_typedMatchAdoptsCatalogCasing_acronym() throws {
        let option = try repo.addCustomOption(category: .trigger, value: "msg")
        XCTAssertEqual(option.value, "MSG")
    }

    func test_addCustomOption_freeFormTextStoredVerbatim() throws {
        let option = try repo.addCustomOption(category: .trigger, value: "Grandma's Cooking")
        XCTAssertEqual(option.value, "Grandma's Cooking")
    }

    func test_addCustomOption_duplicateOfAddedSuggestion_rejected() throws {
        try repo.addCustomOption(category: .trigger, value: "Red Wine")
        XCTAssertThrowsError(try repo.addCustomOption(category: .trigger, value: "red wine")) { error in
            XCTAssertEqual(error as? TrackingOptionError, .duplicateValue)
        }
    }

    func test_displayNames_nonBuiltInsDisplayVerbatim() {
        // Only legacy snake_case built-ins are transformed for display;
        // suggested and free-form values show exactly as stored.
        XCTAssertEqual(Trigger(rawValue: "lack_of_sleep").displayName, "Lack of Sleep")
        XCTAssertEqual(Trigger(rawValue: "bright_lights").displayName, "Bright Lights")
        XCTAssertEqual(Trigger(rawValue: "Red Wine").displayName, "Red Wine")
        XCTAssertEqual(Trigger(rawValue: "MSG").displayName, "MSG")
        XCTAssertEqual(PainQuality(rawValue: "Band-like").displayName, "Band-like")
        XCTAssertEqual(Trigger(rawValue: "Grandma's Cooking").displayName, "Grandma's Cooking")
        // Unknown acronyms are never mangled by a casing transformation
        XCTAssertEqual(Trigger(rawValue: "TMJ flare-up").displayName, "TMJ flare-up")
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
