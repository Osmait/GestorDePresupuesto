import Foundation

struct FeaturesResponse: Codable {
    /// The backend omits `map` when the user has no features.
    let map: [String: Bool]?
}

struct FeatureFlags {
    let flags: [String: Bool]

    func isEnabled(_ key: String) -> Bool {
        flags[key] ?? false
    }

    static let empty = FeatureFlags(flags: [:])
}
