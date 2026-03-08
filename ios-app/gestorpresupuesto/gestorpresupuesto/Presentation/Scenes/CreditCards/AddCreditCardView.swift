import SwiftUI

struct AddCreditCardView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: CreditCardsViewModel

    @State private var name = ""
    @State private var bank = ""
    @State private var lastFourDigits = ""
    @State private var cutDay = "15"
    @State private var dueDay = "5"
    @State private var balanceCurrency = "DOP"
    @State private var creditLimit = ""
    @State private var initialDebt = ""

    private var isValid: Bool {
        name.isNotBlank && bank.isNotBlank &&
        Int(cutDay) != nil && Int(dueDay) != nil &&
        Double(creditLimit) != nil
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: Spacing.lg.rawValue) {
                        FormField(title: "Nombre", icon: "creditcard", placeholder: "Ej: Visa Gold", text: $name)
                        FormField(title: "Banco", icon: "building.2", placeholder: "Nombre del banco", text: $bank)
                        FormField(title: "Últimos 4 dígitos", icon: "number", placeholder: "1234", text: $lastFourDigits, keyboardType: .numberPad)

                        HStack(spacing: Spacing.md.rawValue) {
                            FormField(title: "Día de corte", icon: "calendar", placeholder: "15", text: $cutDay, keyboardType: .numberPad)
                            FormField(title: "Día de pago", icon: "calendar.badge.clock", placeholder: "5", text: $dueDay, keyboardType: .numberPad)
                        }

                        Text("Balance Inicial")
                            .font(.app(.headline))
                            .foregroundStyle(Color.app.textPrimary)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        CurrencyField(title: "Moneda y Límite", amount: $creditLimit, currency: $balanceCurrency)

                        FormField(title: "Deuda Inicial", icon: "dollarsign.circle", placeholder: "0.00 (opcional)", text: $initialDebt, keyboardType: .decimalPad)
                    }
                    .padding(Spacing.lg.rawValue)
                }
            }
            .navigationTitle("Nueva Tarjeta")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Crear") { Task { await save() } }
                        .disabled(!isValid || viewModel.isLoading)
                }
            }
        }
    }

    private func save() async {
        guard let cutDayInt = Int(cutDay),
              let dueDayInt = Int(dueDay),
              let limitValue = Double(creditLimit) else { return }

        let balance = CreateBalanceRequest(
            currency: balanceCurrency,
            creditLimit: limitValue,
            initialDebt: Double(initialDebt)
        )

        let request = CreateCreditCardRequest(
            name: name,
            bank: bank,
            lastFourDigits: lastFourDigits.isEmpty ? nil : lastFourDigits,
            cutDay: cutDayInt,
            dueDay: dueDayInt,
            balances: [balance]
        )

        do {
            _ = try await viewModel.createCreditCard(request: request)
            dismiss()
        } catch {
            viewModel.showError(error.localizedDescription)
        }
    }
}
