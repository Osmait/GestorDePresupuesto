import SwiftUI

@main
struct gestorpresupuestoApp: App {
    @AppStorage("isDarkMode") private var isDarkMode = false
    @StateObject private var networkMonitor = NetworkMonitor.shared
    @StateObject private var featureFlagManager = FeatureFlagManager.shared

    init() {
        DependencyContainer.shared.registerDefaults()
    }

    var body: some Scene {
        WindowGroup {
            MainTabView()
                .preferredColorScheme(isDarkMode ? .dark : .light)
                .environmentObject(networkMonitor)
                .environmentObject(featureFlagManager)
        }
    }
}
