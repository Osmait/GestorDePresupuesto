import SwiftUI

struct AddCertificateView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: CertificatesViewModel

    @State private var bank = ""
    @State private var baseCapital = ""
    @State private var currency = "DOP"
    @State private var interestType: InterestType = .simple
    @State private var interestRate = ""
    @State private var taxRate = ""
    @State private var cutDay = "15"
    @State private var reinvestInterest = false
    @State private var selectedPayoutAccountId = ""

    private var isValid: Bool {
        bank.isNotBlank && Double(baseCapital) != nil &&
        Double(interestRate) != nil && Double(taxRate) != nil &&
        Int(cutDay) != nil
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: Spacing.lg.rawValue) {
                        FormField(title: "Banco", icon: "building.2", placeholder: "Nombre del banco", text: $bank)
                        CurrencyField(title: "Capital base", amount: $baseCapital, currency: $currency)

                        DropdownPicker(
                            title: "Tipo de interés",
                            selection: $interestType,
                            options: InterestType.allCases,
                            labelForOption: { $0.displayName },
                            icon: "percent"
                        )

                        HStack(spacing: Spacing.md.rawValue) {
                            FormField(title: "Tasa de interés (%)", icon: "percent", placeholder: "0.00", text: $interestRate, keyboardType: .decimalPad)
                            FormField(title: "Tasa impositiva (%)", icon: "dollarsign.circle", placeholder: "0.00", text: $taxRate, keyboardType: .decimalPad)
                        }

                        FormField(title: "Día de corte", icon: "calendar", placeholder: "15", text: $cutDay, keyboardType: .numberPad)

                        Toggle(isOn: $reinvestInterest) {
                            HStack {
                                Image(systemName: "arrow.clockwise")
                                    .foregroundStyle(Color.app.accent)
                                Text("Reinvertir intereses")
                                    .font(.app(.subheadline))
                            }
                        }
                        .tint(Color.app.accent)
                        .padding(.horizontal, Spacing.md.rawValue)

                        if !reinvestInterest && !viewModel.accounts.isEmpty {
                            DropdownPicker(
                                title: "Cuenta de pago",
                                selection: $selectedPayoutAccountId,
                                options: viewModel.accounts.map { $0.id },
                                labelForOption: { id in
                                    viewModel.accounts.first { $0.id == id }?.accountInfo.name ?? id
                                },
                                icon: "building.columns"
                            )
                        }
                    }
                    .padding(Spacing.lg.rawValue)
                }
            }
            .navigationTitle("Nuevo Certificado")
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
        guard let capital = Double(baseCapital),
              let rate = Double(interestRate),
              let tax = Double(taxRate),
              let day = Int(cutDay) else { return }

        let request = CreateCertificateRequest(
            bank: bank,
            baseCapital: capital,
            interestType: interestType.rawValue,
            currentInterestRate: rate,
            currentTaxRate: tax,
            cutDay: day,
            reinvestInterest: reinvestInterest,
            payoutAccountId: selectedPayoutAccountId.isEmpty ? nil : selectedPayoutAccountId,
            maturityDate: nil,
            currency: currency
        )

        do {
            _ = try await viewModel.createCertificate(request: request)
            dismiss()
        } catch {
            viewModel.showError(error.localizedDescription)
        }
    }
}
