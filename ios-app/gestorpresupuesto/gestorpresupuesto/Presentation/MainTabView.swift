import SwiftUI

// MARK: - Tabs

enum AppTab: String, Hashable {
    case dashboard
    case transactions
    case monthlyPlan
    case analytics
    case more
}

// MARK: - Main View

struct MainTabView: View {
    @StateObject private var authViewModel = AuthViewModel()
    @EnvironmentObject private var featureFlagManager: FeatureFlagManager
    @EnvironmentObject private var notificationManager: NotificationManager
    @EnvironmentObject private var networkMonitor: NetworkMonitor
    @State private var selectedTab: AppTab = .dashboard

    var body: some View {
        Group {
            if authViewModel.requiresBiometricUnlock {
                BiometricLockView(viewModel: authViewModel)
            } else if authViewModel.isAuthenticated {
                tabs
                    .tint(Color.app.accent)
                    .task { await featureFlagManager.fetchFlags() }
                    .task { notificationManager.start(networkMonitor: networkMonitor) }
                    .sheet(isPresented: $notificationManager.showNotificationCenter) {
                        NotificationCenterView()
                            .environmentObject(notificationManager)
                    }
                    .notificationBanner(
                        isPresented: $notificationManager.showBanner,
                        event: notificationManager.bannerNotification,
                        onTap: { notificationManager.showNotificationCenter = true }
                    )
                    .biometricEnrollmentAlert(
                        isPresented: $authViewModel.showBiometricEnrollment,
                        biometricType: authViewModel.biometricType,
                        onEnable: { authViewModel.enableBiometric() },
                        onSkip: { authViewModel.disableBiometric() }
                    )
            } else {
                LoginView(viewModel: authViewModel)
            }
        }
    }

    // MARK: - Tabs

    private var tabs: some View {
        TabView(selection: $selectedTab) {
            Tab("Inicio", systemImage: "house", value: AppTab.dashboard) {
                NavigationStack {
                    DashboardView(onOpenMonthlyPlan: { selectedTab = .monthlyPlan })
                }
            }

            Tab("Movimientos", systemImage: "arrow.up.arrow.down", value: AppTab.transactions) {
                NavigationStack {
                    TransactionsListView()
                }
            }

            Tab("Plan", systemImage: "calendar", value: AppTab.monthlyPlan) {
                NavigationStack {
                    MonthlyPlanView()
                }
            }

            Tab("Análisis", systemImage: "chart.bar", value: AppTab.analytics) {
                NavigationStack {
                    AnalyticsView()
                }
            }

            Tab("Más", systemImage: "square.grid.2x2", value: AppTab.more) {
                NavigationStack {
                    MoreView(authViewModel: authViewModel)
                }
            }
        }
    }
}

#Preview {
    MainTabView()
        .environmentObject(FeatureFlagManager.shared)
        .environmentObject(NotificationManager.shared)
        .environmentObject(NetworkMonitor.shared)
}
