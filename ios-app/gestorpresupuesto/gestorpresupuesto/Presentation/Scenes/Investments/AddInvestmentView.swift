import SwiftUI

struct AddInvestmentView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: InvestmentsViewModel

    @State private var name = ""
    @State private var symbol = ""
    @State private var type: InvestmentType = .stock
    @State private var quantity = ""
    @State private var purchasePrice = ""
    @State private var currentPrice = ""
    @State private var settlementCurrency = "USD"

    private var isValid: Bool {
        name.isNotBlank && symbol.isNotBlank &&
        Double(quantity) != nil && Double(purchasePrice) != nil &&
        Double(currentPrice) != nil
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: Spacing.lg.rawValue) {
                        DropdownPicker(
                            title: "Tipo",
                            selection: $type,
                            options: InvestmentType.allCases,
                            labelForOption: { $0.displayName },
                            icon: "chart.line.uptrend.xyaxis"
                        )

                        FormField(title: "Nombre", icon: "textformat", placeholder: "Ej: Apple Inc.", text: $name)
                        FormField(title: "Símbolo", icon: "number", placeholder: "Ej: AAPL", text: $symbol)

                        HStack(spacing: Spacing.md.rawValue) {
                            FormField(title: "Cantidad", icon: "number.circle", placeholder: "0", text: $quantity, keyboardType: .decimalPad)
                            FormField(title: "Precio Compra", icon: "dollarsign.circle", placeholder: "0.00", text: $purchasePrice, keyboardType: .decimalPad)
                        }

                        FormField(title: "Precio Actual", icon: "chart.line.uptrend.xyaxis", placeholder: "0.00", text: $currentPrice, keyboardType: .decimalPad)

                        DropdownPicker(
                            title: "Moneda de liquidación",
                            selection: $settlementCurrency,
                            options: ["USD", "DOP"],
                            labelForOption: { $0 },
                            icon: "dollarsign"
                        )
                    }
                    .padding(Spacing.lg.rawValue)
                }
            }
            .navigationTitle("Nueva Inversión")
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
        guard let qty = Double(quantity),
              let purchase = Double(purchasePrice),
              let current = Double(currentPrice) else { return }

        let request = CreateInvestmentRequest(
            name: name,
            symbol: symbol.uppercased(),
            type: type.rawValue,
            quantity: qty,
            purchasePrice: purchase,
            currentPrice: current,
            settlementCurrency: settlementCurrency
        )

        do {
            _ = try await viewModel.createInvestment(request: request)
            dismiss()
        } catch {
            viewModel.showError(error.localizedDescription)
        }
    }
}
