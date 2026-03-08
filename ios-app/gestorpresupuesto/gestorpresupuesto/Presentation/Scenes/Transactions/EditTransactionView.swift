import SwiftUI

struct EditTransactionView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: TransactionsViewModel

    let transaction: Transaction

    @State private var name: String
    @State private var description: String
    @State private var amount: String
    @State private var typeTransaction: String
    @State private var selectedCategoryId: String
    @State private var selectedAccountId: String

    init(viewModel: TransactionsViewModel, transaction: Transaction) {
        self.viewModel = viewModel
        self.transaction = transaction
        _name = State(initialValue: transaction.name)
        _description = State(initialValue: transaction.description ?? "")
        _amount = State(initialValue: String(format: "%.2f", transaction.amount))
        _typeTransaction = State(initialValue: transaction.typeTransaction)
        _selectedCategoryId = State(initialValue: transaction.categoryId)
        _selectedAccountId = State(initialValue: transaction.accountId)
    }

    private var isValid: Bool {
        name.isNotBlank && Double(amount) != nil && !selectedCategoryId.isEmpty && !selectedAccountId.isEmpty
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: Spacing.lg.rawValue) {
                        FormField(
                            title: "Nombre",
                            icon: "pencil",
                            placeholder: "Nombre de la transacción",
                            text: $name
                        )

                        FormField(
                            title: "Descripción",
                            icon: "text.alignleft",
                            placeholder: "Descripción (opcional)",
                            text: $description
                        )

                        FormField(
                            title: "Monto",
                            icon: "dollarsign.circle",
                            placeholder: "0.00",
                            text: $amount,
                            keyboardType: .decimalPad
                        )

                        DropdownPicker(
                            title: "Tipo",
                            selection: $typeTransaction,
                            options: ["income", "expense", "bill"],
                            labelForOption: { type in
                                TransactionType(rawValue: type)?.displayName ?? type
                            },
                            icon: "arrow.left.arrow.right"
                        )

                        if !viewModel.categories.isEmpty {
                            DropdownPicker(
                                title: "Categoría",
                                selection: $selectedCategoryId,
                                options: viewModel.categories.map { $0.id },
                                labelForOption: { id in
                                    viewModel.categories.first { $0.id == id }?.name ?? id
                                },
                                icon: "tag"
                            )
                        }

                        if !viewModel.accounts.isEmpty {
                            DropdownPicker(
                                title: "Cuenta",
                                selection: $selectedAccountId,
                                options: viewModel.accounts.map { $0.id },
                                labelForOption: { id in
                                    viewModel.accounts.first { $0.id == id }?.accountInfo.name ?? id
                                },
                                icon: "creditcard"
                            )
                        }
                    }
                    .padding(Spacing.lg.rawValue)
                }
            }
            .navigationTitle("Editar Transacción")
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
            .task {
                if viewModel.categories.isEmpty || viewModel.accounts.isEmpty {
                    await viewModel.loadInitialData()
                }
            }
        }
    }

    private func save() async {
        guard let amountValue = Double(amount) else { return }
        let request = UpdateTransactionRequest(
            name: name,
            description: description.isEmpty ? nil : description,
            amount: amountValue,
            typeTransaction: typeTransaction,
            accountId: selectedAccountId,
            categoryId: selectedCategoryId,
            budgetId: nil,
            currency: transaction.currency
        )
        do {
            try await viewModel.updateTransaction(transaction.id, request: request)
            dismiss()
        } catch {
            viewModel.showError(error.localizedDescription)
        }
    }
}
