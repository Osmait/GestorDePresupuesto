import SwiftUI

struct AccountsListView: View {
    @StateObject private var viewModel = AccountsViewModel()
    @State private var showingAddAccount = false

    private var totalBalance: Double {
        viewModel.accounts.reduce(0) { $0 + $1.currentBalance }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()

                Group {
                    if viewModel.accounts.isEmpty && viewModel.isLoading {
                        VStack(spacing: Spacing.md.rawValue) {
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
                        ScrollView {
                            VStack(spacing: 0) {
                                // Total balance header
                                balanceHeader
                                    .padding(.bottom, Spacing.lg.rawValue)

                                // Account list
                                VStack(spacing: Spacing.sm.rawValue) {
                                    ForEach(Array(viewModel.accounts.enumerated()), id: \.element.accountInfo.id) { index, account in
                                        accountCard(account, index: index)
                                            .contextMenu {
                                                Button(role: .destructive) {
                                                    Task { await viewModel.deleteAccount(account.accountInfo.id) }
                                                } label: {
                                                    Label("Eliminar", systemImage: "trash")
                                                }
                                            }
                                    }
                                }
                            }
                            .padding(.horizontal, Spacing.lg.rawValue)
                            .padding(.bottom, Spacing.xl.rawValue)
                        }
                        .refreshable {
                            await viewModel.loadAccounts()
                        }
                    }
                }
            }
            .navigationTitle("Cuentas")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showingAddAccount = true } label: {
                        ZStack {
                            Circle()
                                .fill(Color.app.accent.opacity(0.15))
                                .frame(width: 32, height: 32)
                            Image(systemName: "plus")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundStyle(Color.app.accent)
                        }
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

    // MARK: - Balance Header

    private var balanceHeader: some View {
        VStack(spacing: Spacing.sm.rawValue) {
            Text("Balance total")
                .font(.app(.caption))
                .foregroundStyle(Color.app.textTertiary)

            Text(totalBalance.currencyFormatted)
                .font(.system(size: 36, weight: .bold, design: .rounded))
                .foregroundStyle(Color.app.textPrimary)
                .minimumScaleFactor(0.6)

            HStack(spacing: 4) {
                Image(systemName: totalBalance >= 0 ? "arrow.up.right" : "arrow.down.right")
                    .font(.caption2)
                Text("\(viewModel.accounts.count) cuenta\(viewModel.accounts.count == 1 ? "" : "s")")
                    .font(.app(.caption))
            }
            .foregroundStyle(totalBalance >= 0 ? Color.app.success : Color.app.error)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.lg.rawValue)
    }

    // MARK: - Account Card

    private func accountCard(_ account: AccountResponse, index: Int) -> some View {
        let isPositive = account.currentBalance >= 0
        let iconInfo = Self.accountIcon(for: account, index: index)

        return HStack(spacing: Spacing.md.rawValue) {
            // Icon
            ZStack {
                Circle()
                    .fill(iconInfo.color.opacity(0.15))
                    .frame(width: 44, height: 44)
                Image(systemName: iconInfo.icon)
                    .font(.system(size: 18))
                    .foregroundStyle(iconInfo.color)
            }

            // Name & Bank
            VStack(alignment: .leading, spacing: 2) {
                Text(account.accountInfo.name)
                    .font(.app(.subheadline))
                    .fontWeight(.semibold)
                    .foregroundStyle(Color.app.textPrimary)
                    .lineLimit(1)
                Text(account.accountInfo.bank)
                    .font(.caption2)
                    .foregroundStyle(Color.app.textTertiary)
            }

            Spacer()

            // Balance
            VStack(alignment: .trailing, spacing: 2) {
                Text(account.currentBalance.currencyFormatted)
                    .font(.app(.subheadline))
                    .fontWeight(.bold)
                    .foregroundStyle(isPositive ? Color.app.textPrimary : Color.app.error)
                Text("Balance actual")
                    .font(.caption2)
                    .foregroundStyle(Color.app.textTertiary)
            }
        }
        .padding(Spacing.md.rawValue)
        .background(
            RoundedRectangle(cornerRadius: Radius.lg.rawValue)
                .fill(Color.app.surface)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.lg.rawValue)
                .stroke(Color.app.border.opacity(0.2), lineWidth: 1)
        )
    }

    // MARK: - Icon Helper

    static func accountIcon(for account: AccountResponse, index: Int) -> (icon: String, color: Color) {
        let name = account.accountInfo.name.lowercased()

        if name.contains("ahorro") || name.contains("saving") {
            return ("leaf.fill", .green)
        } else if name.contains("inversion") || name.contains("invest") {
            return ("chart.line.uptrend.xyaxis", .purple)
        } else if name.contains("gasto") || name.contains("expense") {
            return ("dollarsign.square.fill", .orange)
        } else if name.contains("credit") || name.contains("tarjeta") {
            return ("creditcard.fill", .blue)
        } else if name.contains("principal") || name.contains("main") {
            return ("building.columns.fill", .indigo)
        }

        let icons: [(String, Color)] = [
            ("building.columns.fill", .indigo),
            ("banknote.fill", .teal),
            ("wallet.bifold.fill", .mint),
            ("chart.bar.fill", .cyan),
        ]
        return icons[index % icons.count]
    }
}

// MARK: - Add Account View

struct AddAccountView: View {
    @ObservedObject var viewModel: AccountsViewModel
    @Binding var isPresented: Bool

    @State private var name = ""
    @State private var bank = ""
    @State private var initialBalance = ""
    @State private var isLoading = false
    @State private var shakeTrigger = false

    private var isValid: Bool {
        !name.isEmpty && !bank.isEmpty && Double(initialBalance) != nil
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: Spacing.lg.rawValue) {
                        FormField(
                            icon: "tag",
                            placeholder: "Nombre de la cuenta",
                            text: $name,
                            validation: { $0.isEmpty ? "Requerido" : nil }
                        )

                        FormField(
                            icon: "building.columns",
                            placeholder: "Banco",
                            text: $bank,
                            validation: { $0.isEmpty ? "Requerido" : nil }
                        )

                        FormField(
                            icon: "dollarsign",
                            placeholder: "Balance inicial",
                            text: $initialBalance,
                            keyboardType: .decimalPad,
                            validation: {
                                if $0.isEmpty { return "Requerido" }
                                if Double($0) == nil { return "Número inválido" }
                                return nil
                            }
                        )

                        PrimaryButton(
                            "Crear Cuenta",
                            icon: "checkmark",
                            isLoading: isLoading
                        ) {
                            Task { await saveAccount() }
                        }
                        .disabled(!isValid)
                    }
                    .padding(Spacing.lg.rawValue)
                }
                .shake(trigger: shakeTrigger)
            }
            .navigationTitle("Nueva Cuenta")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { isPresented = false }
                }
            }
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
            shakeTrigger = false
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                shakeTrigger = true
            }
        }

        isLoading = false
    }
}

#Preview {
    AccountsListView()
}
