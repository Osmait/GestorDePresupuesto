import SwiftUI

struct FundBrokerView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: InvestmentsViewModel

    @State private var selectedAccountId = ""
    @State private var sourceAmount = ""
    @State private var targetCurrency = "USD"
    @State private var exchangeRate = ""
    @State private var notes = ""

    private var isValid: Bool {
        !selectedAccountId.isEmpty && Double(sourceAmount) != nil && (Double(sourceAmount) ?? 0) > 0
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

                        FormField(title: "Monto", icon: "dollarsign.circle", placeholder: "0.00", text: $sourceAmount, keyboardType: .decimalPad)

                        DropdownPicker(
                            title: "Moneda destino",
                            selection: $targetCurrency,
                            options: ["USD", "DOP"],
                            labelForOption: { $0 },
                            icon: "dollarsign"
                        )

                        FormField(title: "Tasa de cambio", icon: "arrow.left.arrow.right", placeholder: "Opcional", text: $exchangeRate, keyboardType: .decimalPad)
                        FormField(title: "Notas", icon: "text.alignleft", placeholder: "Notas (opcional)", text: $notes)
                    }
                    .padding(Spacing.lg.rawValue)
                }
            }
            .navigationTitle("Fondear Broker")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fondear") { Task { await save() } }
                        .disabled(!isValid || viewModel.isLoading)
                }
            }
        }
    }

    private func save() async {
        guard let amount = Double(sourceAmount) else { return }

        let request = FundBrokerRequest(
            sourceAccountId: selectedAccountId,
            sourceAmount: amount,
            targetCurrency: targetCurrency,
            exchangeRate: Double(exchangeRate),
            feeAmount: nil,
            notes: notes.isEmpty ? nil : notes
        )

        do {
            try await viewModel.fundBroker(request: request)
            dismiss()
        } catch {
            viewModel.showError(error.localizedDescription)
        }
    }
}
