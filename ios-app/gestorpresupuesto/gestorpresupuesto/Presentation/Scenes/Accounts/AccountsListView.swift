import SwiftUI

struct AccountsListView: View {
    @StateObject private var viewModel = AccountsViewModel()
    @State private var showingAddAccount = false
    
    var body: some View {
        NavigationStack {
            ZStack {
            Color.app.background.ignoresSafeArea()
            
            Group {
                if viewModel.accounts.isEmpty && viewModel.isLoading {
                    VStack(spacing: .md) {
                        ForEach(0..<3, id: \.self) { _ in CardSkeleton() }
                    }
                    .padding()
                } else if viewModel.accounts.isEmpty {
                    EmptyStateView(
                        icon: "creditcard",
                        title: "Sin cuentas",
                        message: "Agrega tu primera cuenta para empezar a registrar transacciones.",
                        actionTitle: "Agregar cuenta",
                        action: { showingAddAccount = true }
                    )
                } else {
                    List {
                        ForEach(Array(viewModel.accounts.enumerated()), id: \.element.accountInfo.id) { index, account in
                            AccountRowView(account: account)
                                .listRowBackground(Color.clear)
                                .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                    Button(role: .destructive) {
                                        Task { await viewModel.deleteAccount(account.accountInfo.id) }
                                    } label: {
                                        Label("Eliminar", systemImage: "trash")
                                    }
                                }
                        }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                    .refreshable {
                        await viewModel.loadAccounts()
                    }
                }
            }
        }
        .navigationTitle("Cuentas")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                IconButton("plus") {
                    showingAddAccount = true
                }
            }
        }
        .sheet(isPresented: $showingAddAccount) {
            AddAccountView(viewModel: viewModel, isPresented: $showingAddAccount)
        }
        .task {
            if viewModel.accounts.isEmpty {
                await viewModel.loadAccounts()
            }
        }
        .errorBanner(isPresented: $viewModel.showErrorBanner, message: viewModel.errorBannerMessage)
        .toast(isPresented: $viewModel.showToast, type: viewModel.toastType, message: viewModel.toastMessage)
        }
    }
}

struct AccountRowView: View {
    let account: AccountResponse
    
    var body: some View {
        GradientCard(colors: account.currentBalance >= 0 ? Color.app.gradientPrimary : Color.app.gradientExpense, cornerRadius: .lg, padding: .lg) {
            HStack(spacing: .md) {
                ZStack {
                    Circle()
                        .fill(.white.opacity(0.2))
                        .frame(width: 48, height: 48)
                    
                    Image(systemName: "building.columns")
                        .font(.title2)
                        .foregroundStyle(.white)
                }
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(account.accountInfo.name)
                        .font(.app(.headline))
                        .foregroundStyle(.white)
                    
                    Text(account.accountInfo.bank)
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.8))
                }
                
                Spacer()
                
                VStack(alignment: .trailing, spacing: 2) {
                    Text(account.currentBalance.currencyFormatted)
                        .font(.app(.title3))
                        .fontWeight(.bold)
                        .foregroundStyle(.white)
                    
                    Text("Balance actual")
                        .font(.caption2)
                        .foregroundStyle(.white.opacity(0.7))
                }
            }
        }
    }
}

struct AddAccountView: View {
    @ObservedObject var viewModel: AccountsViewModel
    @Binding var isPresented: Bool
    
    @State private var name = ""
    @State private var bank = ""
    @State private var initialBalance = ""
    @State private var isLoading = false
    @State private var shakeOffset: CGFloat = 0
    
    private var isValid: Bool {
        !name.isEmpty && !bank.isEmpty && Double(initialBalance) != nil
    }
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()
                
                GlassCard(cornerRadius: .xl, padding: .lg) {
                    VStack(spacing: .md) {
                        Text("Nueva Cuenta")
                            .font(.app(.title3))
                            .foregroundStyle(Color.app.textPrimary)
                        
                        VStack(spacing: .sm) {
                            FormField(
                                icon: "tag",
                                placeholder: "Nombre de la cuenta",
                                text: $name,
                                validation: { value in
                                    value.isEmpty ? "El nombre es requerido" : nil
                                }
                            )
                            
                            FormField(
                                icon: "building.columns",
                                placeholder: "Banco",
                                text: $bank,
                                validation: { value in
                                    value.isEmpty ? "El banco es requerido" : nil
                                }
                            )
                            
                            FormField(
                                icon: "dollarsign",
                                placeholder: "Balance inicial",
                                text: $initialBalance,
                                keyboardType: .decimalPad,
                                validation: { value in
                                    if value.isEmpty { return "El balance es requerido" }
                                    if Double(value) == nil { return "Ingresa un número válido" }
                                    return nil
                                }
                            )
                        }
                        
                        HStack(spacing: .md) {
                            SecondaryButton("Cancelar") {
                                isPresented = false
                            }
                            
                            PrimaryButton(
                                "Guardar",
                                isLoading: isLoading
                            ) {
                                Task { await saveAccount() }
                            }
                            .disabled(!isValid)
                        }
                    }
                }
                .padding()
                .offset(x: shakeOffset)
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }
    
    private func saveAccount() async {
        guard let balance = Double(initialBalance) else { return }
        
        isLoading = true
        
        let request = CreateAccountRequest(
            name: name,
            bank: bank,
            initialBalance: balance
        )
        
        do {
            _ = try await viewModel.createAccount(request: request)
            isPresented = false
        } catch {
            withAnimation(.default) {
                shakeOffset = -10
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                withAnimation(.default) {
                    shakeOffset = 10
                }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                withAnimation(.default) {
                    shakeOffset = -5
                }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                withAnimation(.default) {
                    shakeOffset = 0
                }
            }
        }
        
        isLoading = false
    }
}

#Preview {
    AccountsListView()
}
