import Foundation
@testable import MigraLog

// MARK: - Mock Diary Entry Repository

final class MockDiaryEntryRepository: DiaryEntryRepositoryProtocol, @unchecked Sendable {
    // Storage
    var entries: [DiaryEntry] = []

    // Call tracking
    var createEntryCalled = false
    var updateEntryCalled = false
    var deleteEntryCalled = false

    // Error injection
    var errorToThrow: Error?

    private func throwIfNeeded() throws {
        if let error = errorToThrow { throw error }
    }

    @discardableResult
    func createEntry(_ entry: DiaryEntry) throws -> DiaryEntry {
        try throwIfNeeded()
        createEntryCalled = true
        entries.append(entry)
        return entry
    }

    func getEntryById(_ id: String) throws -> DiaryEntry? {
        try throwIfNeeded()
        return entries.first { $0.id == id }
    }

    func getAllEntries() throws -> [DiaryEntry] {
        try throwIfNeeded()
        return entries.sorted { $0.timestamp < $1.timestamp }
    }

    func getEntriesByDateRange(start: Int64, end: Int64) throws -> [DiaryEntry] {
        try throwIfNeeded()
        return entries
            .filter { $0.timestamp >= start && $0.timestamp < end }
            .sorted { $0.timestamp < $1.timestamp }
    }

    @discardableResult
    func updateEntry(_ entry: DiaryEntry) throws -> DiaryEntry {
        try throwIfNeeded()
        updateEntryCalled = true
        if let index = entries.firstIndex(where: { $0.id == entry.id }) {
            entries[index] = entry
        }
        return entry
    }

    func deleteEntry(_ id: String) throws {
        try throwIfNeeded()
        deleteEntryCalled = true
        entries.removeAll { $0.id == id }
    }
}
