import SwiftUI

// MARK: - Sidebar Item

enum SidebarItem: String, Hashable {
    case dashboard
    case accounts
    case transactions
    case categories
    case budgets
    case investments
    case certificates
    case loans
    case creditCards
    case recurringTransactions
    case spendingAnalysis
    case reconciliation
    case savingsGoals
    case documentScanner
    case analytics

    var title: String {
        switch self {
        case .dashboard: "Dashboard"
        case .accounts: "Cuentas"
        case .transactions: "Transacciones"
        case .categories: "Categorías"
        case .budgets: "Presupuestos"
        case .investments: "Inversiones"
        case .certificates: "Certificados"
        case .loans: "Préstamos"
        case .creditCards: "Tarjetas de Crédito"
        case .recurringTransactions: "Recurrentes"
        case .spendingAnalysis: "Análisis de Gastos"
        case .reconciliation: "Conciliación"
        case .savingsGoals: "Metas de Ahorro"
        case .documentScanner: "Escáner"
        case .analytics: "Analíticas"
        }
    }

    var icon: String {
        switch self {
        case .dashboard: "square.grid.2x2.fill"
        case .accounts: "creditcard.fill"
        case .transactions: "arrow.up.arrow.down"
        case .categories: "tag.fill"
        case .budgets: "chart.pie.fill"
        case .investments: "chart.line.uptrend.xyaxis"
        case .certificates: "doc.text.fill"
        case .loans: "banknote.fill"
        case .creditCards: "creditcard.trianglebadge.exclamationmark"
        case .recurringTransactions: "arrow.clockwise"
        case .spendingAnalysis: "brain.head.profile.fill"
        case .reconciliation: "doc.text.magnifyingglass"
        case .savingsGoals: "target"
        case .documentScanner: "camera.fill"
        case .analytics: "chart.bar.fill"
        }
    }

    var featureFlag: String? {
        switch self {
        case .creditCards: "module_credit_cards"
        case .loans: "module_loans"
        case .certificates: "module_certificates"
        case .investments: "module_investments"
        case .spendingAnalysis, .reconciliation, .savingsGoals, .documentScanner: "ai_features"
        default: nil
        }
    }
}

/// Display order matching the web sidebar layout
private let sidebarDisplayOrder: [SidebarItem] = [
    .dashboard, .accounts, .transactions, .categories, .budgets,
    .investments, .certificates, .loans, .creditCards,
    .recurringTransactions,
    .spendingAnalysis, .reconciliation, .savingsGoals, .documentScanner,
    .analytics
]

// MARK: - Main View

struct MainTabView: View {
    @StateObject private var authViewModel = AuthViewModel()
    @EnvironmentObject private var featureFlagManager: FeatureFlagManager
    @AppStorage("isDarkMode") private var isDarkMode = false
    @State private var selectedItem: SidebarItem = .dashboard
    @State private var isSidebarOpen = false
    @State private var showSearch = false

    private let sidebarWidth: CGFloat = 300

    var body: some View {
        Group {
            if authViewModel.requiresBiometricUnlock {
                BiometricLockView(viewModel: authViewModel)
            } else if authViewModel.isAuthenticated {
                mainContent
                    .tint(Color.app.accent)
                    .task { await featureFlagManager.fetchFlags() }
                    .sheet(isPresented: $showSearch) { SearchView() }
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

    // MARK: - Main Content

    private var mainContent: some View {
        ZStack(alignment: .leading) {
            // Content
            detailView(for: selectedItem)
                .frame(maxWidth: .infinity, maxHeight: .infinity)

            // Dim overlay
            if isSidebarOpen {
                Color.black.opacity(0.4)
                    .ignoresSafeArea()
                    .onTapGesture { closeSidebar() }
                    .transition(.opacity)
                    .zIndex(1)
            }

            // Sidebar drawer
            HStack(spacing: 0) {
                sidebarDrawer
                    .frame(width: sidebarWidth)

                Spacer(minLength: 0)
            }
            .offset(x: isSidebarOpen ? 0 : -sidebarWidth - 20)
            .zIndex(2)
        }
        .gesture(edgeDragGesture)
        .overlay(alignment: .topLeading) {
            if !isSidebarOpen {
                hamburgerButton
                    .transition(.opacity)
            }
        }
    }

    // MARK: - Hamburger Button

    private var hamburgerButton: some View {
        Button { openSidebar() } label: {
            Image(systemName: "line.3.horizontal")
                .font(.system(size: 17, weight: .semibold))
                .foregroundStyle(Color.app.textPrimary)
                .frame(width: 40, height: 40)
                .background(.ultraThinMaterial, in: Circle())
                .shadow(color: .black.opacity(0.12), radius: 4, y: 2)
        }
        .padding(.leading, 16)
        .padding(.top, 6)
    }

    // MARK: - Sidebar Drawer

    private var sidebarDrawer: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack(spacing: 12) {
                Image(systemName: "dollarsign.circle.fill")
                    .font(.system(size: 32))
                    .foregroundStyle(Color.app.accent)

                VStack(alignment: .leading, spacing: 2) {
                    Text("SBFinance")
                        .font(.app(.headline))
                        .foregroundStyle(Color.app.textPrimary)
                    Text("Gestor Personal")
                        .font(.caption)
                        .foregroundStyle(Color.app.textSecondary)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
            .padding(.bottom, 16)

            Divider().overlay(Color.app.border)

            // Navigation items
            ScrollView {
                VStack(alignment: .leading, spacing: 2) {
                    ForEach(visibleItems, id: \.self) { item in
                        sidebarRow(item)
                    }
                }
                .padding(.vertical, 8)
                .padding(.horizontal, 12)
            }

            Divider().overlay(Color.app.border)

            // Footer
            VStack(spacing: 12) {
                // Dark mode toggle
                HStack(spacing: 12) {
                    Image(systemName: isDarkMode ? "moon.fill" : "sun.max.fill")
                        .font(.system(size: 16))
                        .foregroundStyle(Color.app.textSecondary)
                        .frame(width: 24)
                    Text("Modo Oscuro")
                        .font(.app(.subheadline))
                        .foregroundStyle(Color.app.textSecondary)
                    Spacer()
                    Toggle("", isOn: $isDarkMode)
                        .labelsHidden()
                        .tint(Color.app.accent)
                }

                // Biometric toggle
                if authViewModel.isBiometricAvailable {
                    HStack(spacing: 12) {
                        Image(systemName: authViewModel.biometricType == .faceID ? "faceid" : "touchid")
                            .font(.system(size: 16))
                            .foregroundStyle(Color.app.textSecondary)
                            .frame(width: 24)
                        Text(authViewModel.biometricType == .faceID ? "Face ID" : "Touch ID")
                            .font(.app(.subheadline))
                            .foregroundStyle(Color.app.textSecondary)
                        Spacer()
                        Toggle("", isOn: Binding(
                            get: { authViewModel.isBiometricEnabled },
                            set: { newValue in
                                if newValue {
                                    authViewModel.enableBiometric()
                                } else {
                                    authViewModel.disableBiometric()
                                }
                            }
                        ))
                        .labelsHidden()
                        .tint(Color.app.accent)
                    }
                }

                // Logout
                Button {
                    closeSidebar()
                    Task { await authViewModel.logout() }
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: "rectangle.portrait.and.arrow.right")
                            .font(.system(size: 16))
                            .frame(width: 24)
                        Text("Cerrar Sesión")
                            .font(.app(.subheadline))
                    }
                    .foregroundStyle(.red)
                }

                // Version
                Text("v\(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0")")
                    .font(.caption2)
                    .foregroundStyle(Color.app.textTertiary)
                    .frame(maxWidth: .infinity)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
        }
        .frame(maxHeight: .infinity, alignment: .top)
        .background(Color.app.surface.ignoresSafeArea())
    }

    // MARK: - Sidebar Row

    private func sidebarRow(_ item: SidebarItem) -> some View {
        Button {
            selectedItem = item
            closeSidebar()
        } label: {
            HStack(spacing: 0) {
                // Left accent bar
                RoundedRectangle(cornerRadius: 2)
                    .fill(selectedItem == item ? Color.app.accent : Color.clear)
                    .frame(width: 3, height: 24)
                    .padding(.trailing, 12)

                Image(systemName: item.icon)
                    .font(.system(size: 18))
                    .foregroundStyle(selectedItem == item ? Color.app.accent : Color.app.textSecondary)
                    .frame(width: 24)
                    .padding(.trailing, 14)

                Text(item.title)
                    .font(.app(.body))
                    .foregroundStyle(selectedItem == item ? Color.app.textPrimary : Color.app.textSecondary)
                    .lineLimit(1)

                Spacer()
            }
            .padding(.vertical, 10)
            .padding(.trailing, 12)
            .background(
                selectedItem == item
                    ? Color.app.accent.opacity(0.1)
                    : Color.clear,
                in: RoundedRectangle(cornerRadius: 8)
            )
        }
        .buttonStyle(.plain)
    }

    // MARK: - Helpers

    private var visibleItems: [SidebarItem] {
        sidebarDisplayOrder.filter { item in
            guard let flag = item.featureFlag else { return true }
            return featureFlagManager.isEnabled(flag)
        }
    }

    private var edgeDragGesture: some Gesture {
        DragGesture(minimumDistance: 20)
            .onEnded { value in
                let horizontal = value.translation.width
                if horizontal > 60 && value.startLocation.x < 40 {
                    openSidebar()
                } else if horizontal < -60 && isSidebarOpen {
                    closeSidebar()
                }
            }
    }

    private func openSidebar() {
        withAnimation(.spring(response: 0.35, dampingFraction: 0.86)) {
            isSidebarOpen = true
        }
    }

    private func closeSidebar() {
        withAnimation(.spring(response: 0.35, dampingFraction: 0.86)) {
            isSidebarOpen = false
        }
    }

    // MARK: - Detail View

    @ViewBuilder
    private func detailView(for item: SidebarItem) -> some View {
        switch item {
        case .dashboard:
            DashboardView()
        case .accounts:
            AccountsListView()
        case .transactions:
            TransactionsListView()
        case .categories:
            CategoriesListView()
        case .budgets:
            BudgetsListView()
        case .investments:
            InvestmentsListView()
        case .certificates:
            CertificatesListView()
        case .loans:
            LoansListView()
        case .creditCards:
            CreditCardsListView()
        case .recurringTransactions:
            RecurringTransactionsListView()
        case .spendingAnalysis:
            SpendingAnalysisView()
        case .reconciliation:
            ReconciliationView()
        case .savingsGoals:
            SavingsGoalsView()
        case .documentScanner:
            NavigationStack {
                DocumentScannerView()
            }
        case .analytics:
            AnalyticsView()
        }
    }
}

#Preview {
    MainTabView()
        .environmentObject(FeatureFlagManager.shared)
}
