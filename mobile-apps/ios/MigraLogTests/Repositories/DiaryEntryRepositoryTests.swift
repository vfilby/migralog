import XCTest
@testable import MigraLog

final class DiaryEntryRepositoryTests: XCTestCase {
    private var dbManager: DatabaseManager!
    private var repo: DiaryEntryRepository!

    override func setUpWithError() throws {
        dbManager = try DatabaseManager(inMemory: true)
        repo = DiaryEntryRepository(dbManager: dbManager)
    }

    override func tearDown() {
        dbManager = nil
        repo = nil
    }

    private func makeEntry(
        timestamp: Int64 = 1_700_000_000_000,
        note: String = "Slept badly, feeling foggy"
    ) -> DiaryEntry {
        DiaryEntry(
            id: UUID().uuidString,
            timestamp: timestamp,
            note: note,
            createdAt: TimestampHelper.now,
            updatedAt: TimestampHelper.now
        )
    }

    // MARK: - CRUD

    func test_createAndFetchById_roundTrips() throws {
        let entry = makeEntry()
        try repo.createEntry(entry)

        let fetched = try repo.getEntryById(entry.id)
        XCTAssertEqual(fetched, entry)
    }

    func test_getAllEntries_sortedByTimestamp() throws {
        let later = makeEntry(timestamp: 2_000, note: "later")
        let earlier = makeEntry(timestamp: 1_000, note: "earlier")
        try repo.createEntry(later)
        try repo.createEntry(earlier)

        XCTAssertEqual(try repo.getAllEntries().map(\.note), ["earlier", "later"])
    }

    func test_updateEntry_persistsChanges() throws {
        var entry = makeEntry()
        try repo.createEntry(entry)

        entry.note = "Edited note"
        entry.timestamp += 60_000
        entry.updatedAt = TimestampHelper.now + 1
        try repo.updateEntry(entry)

        XCTAssertEqual(try repo.getEntryById(entry.id), entry)
    }

    func test_deleteEntry_removesRow() throws {
        let entry = makeEntry()
        try repo.createEntry(entry)

        try repo.deleteEntry(entry.id)

        XCTAssertNil(try repo.getEntryById(entry.id))
        XCTAssertTrue(try repo.getAllEntries().isEmpty)
    }

    // MARK: - Range query

    func test_getEntriesByDateRange_startInclusiveEndExclusive() throws {
        try repo.createEntry(makeEntry(timestamp: 999, note: "before"))
        try repo.createEntry(makeEntry(timestamp: 1_000, note: "at start"))
        try repo.createEntry(makeEntry(timestamp: 1_500, note: "inside"))
        try repo.createEntry(makeEntry(timestamp: 2_000, note: "at end"))

        let entries = try repo.getEntriesByDateRange(start: 1_000, end: 2_000)
        XCTAssertEqual(entries.map(\.note), ["at start", "inside"])
    }

    // MARK: - Constraints

    func test_createEntry_rejectsEmptyNote() {
        XCTAssertThrowsError(try repo.createEntry(makeEntry(note: "")))
    }
}
