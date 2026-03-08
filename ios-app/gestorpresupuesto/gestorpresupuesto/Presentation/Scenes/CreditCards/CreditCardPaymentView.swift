import SwiftUI

struct CreditCardPaymentView: View {
    @Environment(\.dismiss) private var dismiss
    let card: CreditCard
    @ObservedObject var viewModel: CreditCardsViewModel

    @State private var selectedAccountId = ""
    @State private var currency = "DOP"
    @State private var amount = ""
    @State private var exchangeRate = ""
    @State private var includesInterest = false
    @State private var interestAmount = ""
    @State private var notes = ""

    private var isValid: Bool {
        !selectedAccountId.isEmpty && Double(amount) != nil && (Double(amount) ?? 0) > 0
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: Spacing.lg.rawValue) {
                        if !viewModel.accounts.isEmpty {
                            DropdownPicker(
                                title: "Cuenta de origen",
                                selection: $selectedAccountId,
                                options: viewModel.accounts.map { $0.id },
                                labelForOption: { id in
                                    viewModel.accounts.first { $0.id == id }?.accountInfo.name ?? id
                                },
                                icon: "building.columns"
                            )
                        }

                        CurrencyField(title: "Monto del pago", amount: $amount, currency: $currency)

                        FormField(title: "Tasa de cambio", icon: "arrow.left.arrow.right", placeholder: "Opcional", text: $exchangeRate, keyboardType: .decimalPad)

                        Toggle(isOn: $includesInterest) {
                            HStack {
                                Image(systemName: "percent")
                                    .foregroundStyle(Color.app.accent)
                                Text("Incluye intereses")
                                    .font(.app(.subheadline))
                            }
                        }
                        .tint(Color.app.accent)
                        .padding(.horizontal, Spacing.md.rawValue)

                        if includesInterest {
                            FormField(title: "Monto de intereses", icon: "percent", placeholder: "0.00", text: $interestAmount, keyboardType: .decimalPad)
                        }

                        FormField(title: "Notas", icon: "text.alignleft", placeholder: "Notas (opcional)", text: $notes)
                    }
                    .padding(Spacing.lg.rawValue)
                }
            }
            .navigationTitle("Registrar Pago")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Pagar") { Task { await save() } }
                        .disabled(!isValid || viewModel.isLoading)
                }
            }
        }
    }

    private func save() async {
        guard let amountValue = Double(amount) else { return }

        let request = CreateCardPaymentRequest(
            fromAccountId: selectedAccountId,
            currency: currency,
            amount: amountValue,
            exchangeRate: Double(exchangeRate),
            includesInterest: includesInterest ? true : nil,
            interestAmount: includesInterest ? Double(interestAmount) : nil,
            notes: notes.isEmpty ? nil : notes
        )

        do {
            _ = try await viewModel.createPayment(cardId: card.id, request: request)
            dismiss()
        } catch {
            viewModel.showError(error.localizedDescription)
        }
    }
}
