import SwiftUI

struct MainTabView: View {
    @StateObject private var authViewModel = AuthViewModel()
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
                    
                    BudgetsListView()
                        .tag(3)
                        .tabItem {
                            Image(systemName: "chart.pie.fill")
                            Text("Presupuestos")
                        }
                    
                    CategoriesListView()
                        .tag(4)
                        .tabItem {
                            Image(systemName: "tag.fill")
                            Text("Categorías")
                        }
                    
                    SettingsView(authViewModel: authViewModel)
                        .tag(5)
                        .tabItem {
                            Image(systemName: "gear")
                            Text("Ajustes")
                        }
                }
                .tint(Color.app.accent)
            } else {
                LoginView()
            }
        }
    }
}

struct SettingsView: View {
    @ObservedObject var authViewModel: AuthViewModel
    @State private var showRecurringTransactions = false
    @AppStorage("isDarkMode") private var isDarkMode = false
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()
                
                List {
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
                    
                    Section("Apariencia") {
                        HStack(spacing: Spacing.md.rawValue) {
                            ZStack {
                                Circle()
                                    .fill(Color.app.accent.opacity(0.15))
                                    .frame(width: 36, height: 36)
                                
                                Image(systemName: isDarkMode ? "moon.fill" : "sun.max.fill")
                                    .font(.system(size: 16))
                                    .foregroundStyle(Color.app.accent)
                            }
                            
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
                    
                    Section("Herramientas") {
                        Button {
                            showRecurringTransactions = true
                        } label: {
                            HStack(spacing: Spacing.md.rawValue) {
                                ZStack {
                                    Circle()
                                        .fill(Color.app.success.opacity(0.15))
                                        .frame(width: 36, height: 36)
                                    
                                    Image(systemName: "arrow.clockwise")
                                        .font(.system(size: 16))
                                        .foregroundStyle(Color.app.success)
                                }
                                
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Transacciones Recurrentes")
                                        .font(.app(.subheadline))
                                        .foregroundStyle(Color.app.textPrimary)
                                    
                                    Text("Configura ingresos y gastos mensuales")
                                        .font(.caption2)
                                        .foregroundStyle(Color.app.textSecondary)
                                }
                                
                                Spacer()
                                
                                Image(systemName: "chevron.right")
                                    .font(.caption)
                                    .foregroundStyle(Color.app.textTertiary)
                            }
                        }
                    }
                    .listRowBackground(Color.app.surface)
                    .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 0, trailing: 16))
                    
                    Section {
                        Button(role: .destructive) {
                            Task {
                                await authViewModel.logout()
                            }
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
            .navigationTitle("Ajustes")
            .sheet(isPresented: $showRecurringTransactions) {
                NavigationStack {
                    RecurringTransactionsListView()
                }
                .presentationDetents([.large])
                .presentationDragIndicator(.visible)
            }
        }
    }
}

#Preview {
    MainTabView()
}
