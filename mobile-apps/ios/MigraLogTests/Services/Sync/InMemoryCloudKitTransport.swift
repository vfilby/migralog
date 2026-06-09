import Foundation
@testable import MigraLog

/// In-memory `CloudKitTransport` for unit tests. Models a single zone as a
/// record store plus a monotonic change log, so incremental `fetchChanges` behaves
/// like the real zone-token mechanism: a token is just the sequence number of the
/// last change the caller has seen.
final class InMemoryCloudKitTransport: CloudKitTransport, @unchecked Sendable {
    private let lock = NSLock()
    private var storage: [String: SyncRecord] = [:]
    /// recordName → sequence number of its latest change.
    private var changeSeq: [String: Int] = [:]
    private var seq = 0
    private(set) var zoneCreated = false
    private(set) var pushCount = 0

    /// When set, the next `push` throws this and clears it (for error-path tests).
    var failNextPush: Error?
    /// When set, the next `fetchChanges` throws this and clears it (for error-path tests).
    var failNextFetch: Error?
    /// Controls `accountAvailable()` for precondition tests.
    var accountIsAvailable = true

    func accountAvailable() async throws -> Bool {
        lock.lock(); defer { lock.unlock() }
        return accountIsAvailable
    }

    func ensureZone() async throws {
        lock.lock(); defer { lock.unlock() }
        zoneCreated = true
    }

    @discardableResult
    func push(_ records: [SyncRecord]) async throws -> [SyncRecord] {
        lock.lock(); defer { lock.unlock() }
        if let error = failNextPush {
            failNextPush = nil
            throw error
        }
        pushCount += 1
        var serverWon: [SyncRecord] = []
        for record in records {
            // Optimistic concurrency: only overwrite when our version wins LWW against
            // whatever the zone currently holds (#461). A newer server version is kept and
            // returned so the engine can converge locally.
            if let existing = storage[record.recordName] {
                let winner = LWWResolver.resolve(
                    localUpdatedAt: record.updatedAt, localPayload: record.payload,
                    remoteUpdatedAt: existing.updatedAt, remotePayload: existing.payload
                )
                if winner == .remote {
                    serverWon.append(existing)
                    continue
                }
            }
            seq += 1
            storage[record.recordName] = record
            changeSeq[record.recordName] = seq
        }
        return serverWon
    }

    /// Test helper: seed a record directly into the zone as if another device had pushed
    /// it, bypassing `push`'s conflict resolution.
    func seed(_ record: SyncRecord) {
        lock.lock(); defer { lock.unlock() }
        seq += 1
        storage[record.recordName] = record
        changeSeq[record.recordName] = seq
    }

    func fetchChanges(since token: Data?) async throws -> SyncChangeBatch {
        lock.lock(); defer { lock.unlock() }
        if let error = failNextFetch {
            failNextFetch = nil
            throw error
        }
        let sinceSeq = token
            .flatMap { String(bytes: $0, encoding: .utf8) }
            .flatMap { Int($0) } ?? 0
        let changedNames = changeSeq
            .filter { $0.value > sinceSeq }
            .sorted { $0.value < $1.value }
            .map { $0.key }
        let records = changedNames.compactMap { storage[$0] }
        let newSeq = changeSeq.values.max() ?? sinceSeq
        return SyncChangeBatch(records: records, newToken: Data(String(newSeq).utf8), moreComing: false)
    }

    /// Test helper: the current stored record for a recordName, if any.
    func record(named recordName: String) -> SyncRecord? {
        lock.lock(); defer { lock.unlock() }
        return storage[recordName]
    }
}
