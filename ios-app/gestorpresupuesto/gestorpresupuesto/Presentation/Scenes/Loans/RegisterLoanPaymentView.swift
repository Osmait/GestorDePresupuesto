import SwiftUI

struct RegisterLoanPaymentView: View {
    @Environment(\.dismiss) private var dismiss
    let loan: Loan
    @ObservedObject var viewModel: LoansViewModel

    @State private var selectedAccountId = ""
    @State private var amount = ""
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
                        SurfaceCard {
                            VStack(spacing: Spacing.sm.rawValue) {
                                Text(loan.borrowerName)
                                    .font(.app(.headline))
                                Text("Pendiente: \(loan.pendingAmount.currencyFormatted)")
                                    .font(.app(.caption))
                                    .foregroundStyle(Color.app.textSecondary)
                            }
                        }

                        if !viewModel.accounts.isEmpty {
                            DropdownPicker(
                                title: "Cuenta destino",
                                selection: $selectedAccountId,
                                options: viewModel.accounts.map { $0.id },
                                labelForOption: { id in
                                    viewModel.accounts.first { $0.id == id }?.accountInfo.name ?? id
                                },
                                icon: "building.columns"
                            )
                        }

                        FormField(title: "Monto", icon: "dollarsign.circle", placeholder: "0.00", text: $amount, keyboardType: .decimalPad)
                        FormField(title: "Notas", icon: "text.alignleft", placeholder: "Notas (opcional)", text: $notes)
                    }
                    .padding(Spacing.lg.rawValue)
                }
            }
            .navigationTitle("Registrar Cobro")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Registrar") { Task { await save() } }
                        .disabled(!isValid || viewModel.isLoading)
                }
            }
        }
    }

    private func save() async {
        guard let amountValue = Double(amount) else { return }

        let request = RegisterLoanPaymentRequest(
            destinationAccountId: selectedAccountId,
            amount: amountValue,
            paymentDate: nil,
            notes: notes.isEmpty ? nil : notes
        )

        do {
            _ = try await viewModel.registerPayment(loanId: loan.id, request: request)
            dismiss()
        } catch {
            viewModel.showError(error.localizedDescription)
        }
    }
}
