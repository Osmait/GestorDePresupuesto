import SwiftUI

struct MainTabView: View {
    @StateObject private var authViewModel = AuthViewModel()
    @EnvironmentObject private var featureFlagManager: FeatureFlagManager
    @State private var selectedTab = 0

    var body: some View {
        Group {
            if authViewModel.isAuthenticated {
                TabView(selection: $selectedTab) {
                    DashboardView()
                        .tag(0)
                        .tabItem {
                            Image(systemName: "house.fill")
                            Text("Inicio")
                        }

                    TransactionsListView()
                        .tag(1)
                        .tabItem {
                            Image(systemName: "arrow.left.arrow.right")
                            Text("Transacciones")
                        }

                    AccountsListView()
                        .tag(2)
                        .tabItem {
                            Image(systemName: "creditcard.fill")
                            Text("Cuentas")
                        }

                    AnalyticsView()
                        .tag(3)
                        .tabItem {
                            Image(systemName: "chart.bar.fill")
                            Text("Analíticas")
                        }

                    MoreView(authViewModel: authViewModel)
                        .tag(4)
                        .tabItem {
                            Image(systemName: "ellipsis.circle.fill")
                            Text("Más")
                        }
                }
                .tint(Color.app.accent)
                .task {
                    await featureFlagManager.fetchFlags()
                }
            } else {
                LoginView(viewModel: authViewModel)
            }
        }
    }
}

// MARK: - More View (Hub for all features)

struct MoreView: View {
    @ObservedObject var authViewModel: AuthViewModel
    @EnvironmentObject private var featureFlagManager: FeatureFlagManager
    @AppStorage("isDarkMode") private var isDarkMode = false
    @State private var showSearch = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()

                List {
                    // Profile
                    Section {
                        if let user = authViewModel.user {
                            HStack(spacing: Spacing.md.rawValue) {
                                ZStack {
                                    Circle()
                                        .fill(
                                            LinearGradient(
                                                colors: Color.app.gradientPrimary,
                                                startPoint: .topLeading,
                                                endPoint: .bottomTrailing
                                            )
                                        )
                                        .frame(width: 56, height: 56)

                                    Text(String(user.name.prefix(1)))
                                        .font(.title2)
                                        .fontWeight(.bold)
                                        .foregroundStyle(.white)
                                }

                                VStack(alignment: .leading, spacing: 2) {
                                    Text(user.fullName)
                                        .font(.app(.headline))
                                        .foregroundStyle(Color.app.textPrimary)

                                    Text(user.email)
                                        .font(.caption)
                                        .foregroundStyle(Color.app.textSecondary)
                                }
                            }
                            .padding(.vertical, Spacing.sm.rawValue)
                        }
                    }
                    .listRowBackground(Color.app.surface)
                    .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 16))

                    // Finance
                    Section("Finanzas") {
                        settingsNavLink(icon: "chart.pie.fill", color: .app.accent, title: "Presupuestos", subtitle: "Control de gastos por categoría") {
                            BudgetsListView()
                        }

                        settingsNavLink(icon: "tag.fill", color: .app.warning, title: "Categorías", subtitle: "Organiza tus transacciones") {
                            CategoriesListView()
                        }

                        settingsNavLink(icon: "arrow.clockwise", color: .app.success, title: "Transacciones Recurrentes", subtitle: "Ingresos y gastos automáticos") {
                            RecurringTransactionsListView()
                        }
                    }
                    .listRowBackground(Color.app.surface)
                    .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 16))

                    // Products (feature-flagged)
                    if featureFlagManager.isEnabled("credit_cards") || featureFlagManager.isEnabled("loans") ||
                       featureFlagManager.isEnabled("certificates") || featureFlagManager.isEnabled("investments") {
                        Section("Productos") {
                            if featureFlagManager.isEnabled("credit_cards") {
                                settingsNavLink(icon: "creditcard.trianglebadge.exclamationmark", color: .purple, title: "Tarjetas de Crédito", subtitle: "Gestión de tarjetas y pagos") {
                                    CreditCardsListView()
                                }
                            }

                            if featureFlagManager.isEnabled("loans") {
                                settingsNavLink(icon: "doc.text.fill", color: .orange, title: "Préstamos", subtitle: "Préstamos otorgados y cobros") {
                                    LoansListView()
                                }
                            }

                            if featureFlagManager.isEnabled("certificates") {
                                settingsNavLink(icon: "building.columns.fill", color: .teal, title: "Certificados", subtitle: "Certificados financieros") {
                                    CertificatesListView()
                                }
                            }

                            if featureFlagManager.isEnabled("investments") {
                                settingsNavLink(icon: "chart.line.uptrend.xyaxis", color: .green, title: "Inversiones", subtitle: "Portafolio de inversiones") {
                                    InvestmentsListView()
                                }
                            }
                        }
                        .listRowBackground(Color.app.surface)
                        .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 16))
                    }

                    // AI Features
                    if featureFlagManager.isEnabled("ai_features") {
                        Section("Inteligencia Artificial") {
                            settingsNavLink(icon: "brain.head.profile.fill", color: .pink, title: "Análisis de Gastos", subtitle: "Patrones y recomendaciones con IA") {
                                SpendingAnalysisView()
                            }

                            settingsNavLink(icon: "doc.text.magnifyingglass", color: .indigo, title: "Conciliación Bancaria", subtitle: "Concilia estados de cuenta automáticamente") {
                                ReconciliationView()
                            }

                            settingsNavLink(icon: "target", color: .mint, title: "Metas de Ahorro", subtitle: "Define y rastrea metas con IA") {
                                SavingsGoalsView()
                            }

                            settingsNavLink(icon: "camera.fill", color: .cyan, title: "Escáner de Documentos", subtitle: "Escanea recibos y facturas") {
                                DocumentScannerView()
                            }
                        }
                        .listRowBackground(Color.app.surface)
                        .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 16))
                    }

                    // Appearance
                    Section("Apariencia") {
                        HStack(spacing: Spacing.md.rawValue) {
                            settingsIcon(systemName: isDarkMode ? "moon.fill" : "sun.max.fill", color: .app.accent)

                            Text("Modo Oscuro")
                                .font(.app(.subheadline))
                                .foregroundStyle(Color.app.textPrimary)

                            Spacer()

                            Toggle("", isOn: $isDarkMode)
                                .labelsHidden()
                                .tint(Color.app.accent)
                        }
                    }
                    .listRowBackground(Color.app.surface)
                    .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 16))

                    // App Info
                    Section {
                        HStack {
                            Spacer()
                            VStack(spacing: 4) {
                                Text("SBFinance")
                                    .font(.app(.caption))
                                    .fontWeight(.semibold)
                                    .foregroundStyle(Color.app.textSecondary)
                                Text("v\(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0")")
                                    .font(.caption2)
                                    .foregroundStyle(Color.app.textTertiary)
                            }
                            Spacer()
                        }
                    }
                    .listRowBackground(Color.clear)

                    // Logout
                    Section {
                        Button(role: .destructive) {
                            Task { await authViewModel.logout() }
                        } label: {
                            HStack {
                                Spacer()
                                Text("Cerrar Sesión")
                                    .fontWeight(.medium)
                                Spacer()
                            }
                        }
                    }
                    .listRowBackground(Color.app.surface)
                    .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 16))
                }
                .scrollContentBackground(.hidden)
            }
            .navigationTitle("Más")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showSearch = true } label: {
                        Image(systemName: "magnifyingglass")
                    }
                }
            }
            .sheet(isPresented: $showSearch) {
                SearchView()
            }
        }
    }

    // MARK: - Helpers

    @ViewBuilder
    private func settingsNavLink<Destination: View>(
        icon: String,
        color: Color,
        title: String,
        subtitle: String,
        @ViewBuilder destination: () -> Destination
    ) -> some View {
        NavigationLink {
            destination()
        } label: {
            HStack(spacing: Spacing.md.rawValue) {
                settingsIcon(systemName: icon, color: color)

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.app(.subheadline))
                        .foregroundStyle(Color.app.textPrimary)

                    Text(subtitle)
                        .font(.caption2)
                        .foregroundStyle(Color.app.textSecondary)
                }
            }
        }
    }

    private func settingsIcon(systemName: String, color: Color) -> some View {
        ZStack {
            Circle()
                .fill(color.opacity(0.15))
                .frame(width: 36, height: 36)

            Image(systemName: systemName)
                .font(.system(size: 16))
                .foregroundStyle(color)
        }
    }
}

#Preview {
    MainTabView()
        .environmentObject(FeatureFlagManager.shared)
}
