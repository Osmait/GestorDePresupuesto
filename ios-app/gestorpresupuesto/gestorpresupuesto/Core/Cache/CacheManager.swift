import Foundation

actor CacheManager {
    static let shared = CacheManager()

    private struct CacheEntry {
        let value: Any
        let expiry: Date
    }

    private var cache: [String: CacheEntry] = [:]
    private let defaultTTL: TimeInterval = 300 // 5 minutes

    private init() {}

    func get<T>(_ key: String) -> T? {
        guard let entry = cache[key] else { return nil }
        if Date() > entry.expiry {
            cache.removeValue(forKey: key)
            return nil
        }
        return entry.value as? T
    }

    func set<T>(_ key: String, value: T, ttl: TimeInterval? = nil) {
        let expiry = Date().addingTimeInterval(ttl ?? defaultTTL)
        cache[key] = CacheEntry(value: value, expiry: expiry)
    }

    func invalidate(_ key: String) {
        cache.removeValue(forKey: key)
    }

    func invalidateAll() {
        cache.removeAll()
    }

    func invalidatePrefix(_ prefix: String) {
        cache = cache.filter { !$0.key.hasPrefix(prefix) }
    }
}
