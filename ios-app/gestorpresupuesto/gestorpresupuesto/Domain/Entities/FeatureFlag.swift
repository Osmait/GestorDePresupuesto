import Foundation

struct FeaturesResponse: Codable {
    let map: [String: Bool]
}

struct FeatureFlags {
    let flags: [String: Bool]

    func isEnabled(_ key: String) -> Bool {
        flags[key] ?? false
    }

    static let empty = FeatureFlags(flags: [:])
}
