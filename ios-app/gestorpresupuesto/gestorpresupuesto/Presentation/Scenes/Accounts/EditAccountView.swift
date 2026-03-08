import SwiftUI

struct EditAccountView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: AccountsViewModel

    let account: AccountResponse

    @State private var name: String
    @State private var bank: String
    @State private var initialBalance: String

    init(viewModel: AccountsViewModel, account: AccountResponse) {
        self.viewModel = viewModel
        self.account = account
        _name = State(initialValue: account.accountInfo.name)
        _bank = State(initialValue: account.accountInfo.bank)
        _initialBalance = State(initialValue: String(format: "%.2f", account.accountInfo.initialBalance))
    }

    private var isValid: Bool {
        name.isNotBlank && bank.isNotBlank && Double(initialBalance) != nil
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: Spacing.lg.rawValue) {
                        FormField(
                            title: "Nombre",
                            icon: "building.columns",
                            placeholder: "Nombre de la cuenta",
                            text: $name
                        )

                        FormField(
                            title: "Banco",
                            icon: "building.2",
                            placeholder: "Nombre del banco",
                            text: $bank
                        )

                        FormField(
                            title: "Balance Inicial",
                            icon: "dollarsign.circle",
                            placeholder: "0.00",
                            text: $initialBalance,
                            keyboardType: .decimalPad
                        )
                    }
                    .padding(Spacing.lg.rawValue)
                }
            }
            .navigationTitle("Editar Cuenta")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Guardar") {
                        Task { await save() }
                    }
                    .disabled(!isValid || viewModel.isLoading)
                }
            }
        }
    }

    private func save() async {
        guard let balance = Double(initialBalance) else { return }
        let request = UpdateAccountRequest(name: name, bank: bank, initialBalance: balance)
        do {
            _ = try await viewModel.updateAccount(account.accountInfo.id, request: request)
            dismiss()
        } catch {
            viewModel.showError(error.localizedDescription)
        }
    }
}
