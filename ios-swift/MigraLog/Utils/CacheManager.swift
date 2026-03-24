import Foundation

/// Simple in-memory cache with TTL expiration
final class CacheManager {
    static let shared = CacheManager()

    private var cache: [String: CacheEntry] = [:]
    private let lock = NSLock()

    struct CacheEntry {
        let value: Any
        let expiry: Date
    }

    func get<T>(_ key: String) -> T? {
        lock.lock()
        defer { lock.unlock() }
        guard let entry = cache[key],
              entry.expiry > Date() else {
            cache.removeValue(forKey: key)
            return nil
        }
        return entry.value as? T
    }

    func set<T>(_ key: String, value: T, ttl: TimeInterval) {
        lock.lock()
        defer { lock.unlock() }
        cache[key] = CacheEntry(value: value, expiry: Date().addingTimeInterval(ttl))
    }

    func invalidate(_ key: String) {
        lock.lock()
        defer { lock.unlock() }
        cache.removeValue(forKey: key)
    }

    func invalidateByPattern(_ pattern: String) {
        lock.lock()
        defer { lock.unlock() }
        let keysToRemove = cache.keys.filter { $0.contains(pattern) }
        keysToRemove.forEach { cache.removeValue(forKey: $0) }
    }

    func clearAll() {
        lock.lock()
        defer { lock.unlock() }
        cache.removeAll()
    }
}
