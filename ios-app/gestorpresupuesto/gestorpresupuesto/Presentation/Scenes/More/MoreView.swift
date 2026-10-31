import SwiftUI

/// "Más" tab: every section that is not a tab, grouped like the web sidebar,
/// plus settings. Modules behind a feature flag only show when enabled.
struct MoreView: View {
    @ObservedObject var authViewModel: AuthViewModel
    @EnvironmentObject private var featureFlagManager: FeatureFlagManager
    @EnvironmentObject private var notificationManager: NotificationManager
    @AppStorage(AppAppearance.storageKey) private var appearance: AppAppearance = .system
    @State private var showLogoutConfirmation = false

    var body: some View {
        List {
            if let user = authViewModel.user {
                Section {
                    HStack(spacing: .md) {
                        Text(initials(of: user))
                            .font(.app(.headline))
                            .foregroundStyle(Color.app.onAccent)
                            .frame(width: 44, height: 44)
                            .background(Color.app.accent, in: Circle())
                            .accessibilityHidden(true)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(user.fullName)
                                .font(.app(.headline))
                                .foregroundStyle(Color.app.textPrimary)
                            Text(user.email)
                                .font(.app(.footnote))
                                .foregroundStyle(Color.app.textSecondary)
                        }
                    }
                    .padding(.vertical, .xxs)
                }
                .listRowBackground(Color.app.surface)
            }

            Section("Dinero") {
                link("Cuentas", icon: "creditcard") { AccountsListView() }
                link("Presupuestos", icon: "chart.pie") { BudgetsListView() }
                link("Categorías", icon: "tag") { CategoriesListView() }
                link("Recurrentes", icon: "arrow.clockwise") { RecurringTransactionsListView() }
            }
            .listRowBackground(Color.app.surface)

            if hasModules {
                Section {
                    if isEnabled("module_credit_cards") {
                        link("Tarjetas de crédito", icon: "creditcard.and.123") { CreditCardsListView() }
                    }
                    if isEnabled("module_investments") {
                        link("Inversiones", icon: "chart.line.uptrend.xyaxis") { InvestmentsListView() }
                    }
                    if isEnabled("module_certificates") {
                        link("Certificados", icon: "doc.text") { CertificatesListView() }
                    }
                    if isEnabled("module_loans") {
                        link("Préstamos", icon: "banknote") { LoansListView() }
                    }
                } header: {
                    Text("Módulos")
                }
                .listRowBackground(Color.app.surface)
            }

            // Each item uses the flag that guards its endpoint in the backend
            // (internal/platform/server/routes/ai_routes.go).
            if hasAssistant {
                Section("Asistente") {
                    if isEnabled("ai_extraction") {
                        link("Análisis de gastos", icon: "sparkles") { SpendingAnalysisView() }
                        link("Escanear recibo", icon: "doc.viewfinder") { DocumentScannerView() }
                    }
                    if isEnabled("ai_reconciliation") {
                        link("Conciliación", icon: "doc.text.magnifyingglass") { ReconciliationView() }
                    }
                    if isEnabled("ai_savings_goals_crud") {
                        link("Metas de ahorro", icon: "target") { SavingsGoalsView() }
                    }
                }
                .listRowBackground(Color.app.surface)
            }

            Section("Ajustes") {
                Picker(selection: $appearance) {
                    ForEach(AppAppearance.allCases) { option in
                        Text(option.title).tag(option)
                    }
                } label: {
                    Label("Apariencia", systemImage: "circle.lefthalf.filled")
                }

                if authViewModel.isBiometricAvailable {
                    Toggle(isOn: Binding(
                        get: { authViewModel.isBiometricEnabled },
                        set: { enabled in
                            if enabled {
                                authViewModel.enableBiometric()
                            } else {
                                authViewModel.disableBiometric()
                            }
                        }
                    )) {
                        Label(
                            authViewModel.biometricType == .faceID ? "Face ID" : "Touch ID",
                            systemImage: authViewModel.biometricType == .faceID ? "faceid" : "touchid"
                        )
                    }
                    .tint(Color.app.accent)
                }

                Button(role: .destructive) {
                    showLogoutConfirmation = true
                } label: {
                    Label("Cerrar sesión", systemImage: "rectangle.portrait.and.arrow.right")
                        .foregroundStyle(Color.app.error)
                }
            }
            .listRowBackground(Color.app.surface)

            Section {
            } footer: {
                Text("SBFinance v\(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0")")
                    .frame(maxWidth: .infinity)
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Color.app.background.ignoresSafeArea())
        .navigationTitle("Más")
        .notificationToolbar()
        .confirmationDialog("¿Cerrar sesión?", isPresented: $showLogoutConfirmation, titleVisibility: .visible) {
            Button("Cerrar sesión", role: .destructive) {
                notificationManager.stop()
                Task { await authViewModel.logout() }
            }
        }
    }

    // MARK: - Helpers

    private var hasModules: Bool {
        ["module_credit_cards", "module_investments", "module_certificates", "module_loans"].contains(where: isEnabled)
    }

    private var hasAssistant: Bool {
        ["ai_extraction", "ai_reconciliation", "ai_savings_goals_crud"].contains(where: isEnabled)
    }

    private func isEnabled(_ flag: String) -> Bool {
        featureFlagManager.isEnabled(flag)
    }

    private func link<Destination: View>(
        _ title: String,
        icon: String,
        @ViewBuilder destination: @escaping () -> Destination
    ) -> some View {
        NavigationLink {
            destination()
                .readableWidth()
        } label: {
            Label {
                Text(title)
                    .foregroundStyle(Color.app.textPrimary)
            } icon: {
                Image(systemName: icon)
                    .foregroundStyle(Color.app.textSecondary)
            }
        }
    }

    private func initials(of user: User) -> String {
        let first = user.name.first.map(String.init) ?? ""
        let last = user.lastName.first.map(String.init) ?? ""
        return (first + last).uppercased()
    }
}
