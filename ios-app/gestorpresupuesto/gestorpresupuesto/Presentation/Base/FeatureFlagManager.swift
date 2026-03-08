import Combine
import SwiftUI

@MainActor
final class FeatureFlagManager: ObservableObject {
    static let shared = FeatureFlagManager()

    @Published var flags: FeatureFlags = .empty
    @Published var isLoading = false

    private let apiClient: APIClient

    private init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func isEnabled(_ key: String) -> Bool {
        flags.isEnabled(key)
    }

    func fetchFlags() async {
        isLoading = true
        do {
            let response: FeaturesResponse = try await apiClient.request(Endpoints.features())
            flags = FeatureFlags(flags: response.map)
            await CacheManager.shared.set("feature_flags", value: flags, ttl: 600)
        } catch {
            if let cached: FeatureFlags = await CacheManager.shared.get("feature_flags") {
                flags = cached
            }
            print("Error fetching feature flags: \(error)")
        }
        isLoading = false
    }
}
