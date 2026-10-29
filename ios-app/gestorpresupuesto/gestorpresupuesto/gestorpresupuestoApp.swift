import SwiftUI

@main
struct gestorpresupuestoApp: App {
    @AppStorage(AppAppearance.storageKey) private var appearance: AppAppearance = .system
    @StateObject private var networkMonitor = NetworkMonitor.shared
    @StateObject private var featureFlagManager = FeatureFlagManager.shared
    @StateObject private var notificationManager = NotificationManager.shared

    init() {
        AppAppearance.migrateLegacyPreference()
        DependencyContainer.shared.registerDefaults()
    }

    var body: some Scene {
        WindowGroup {
            MainTabView()
                .preferredColorScheme(appearance.colorScheme)
                .environmentObject(networkMonitor)
                .environmentObject(featureFlagManager)
                .environmentObject(notificationManager)
                .onAppear { notificationManager.requestNotificationPermission() }
        }
    }
}
