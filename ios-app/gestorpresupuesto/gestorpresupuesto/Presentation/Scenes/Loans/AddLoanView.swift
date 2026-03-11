import SwiftUI

struct AddLoanView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: LoansViewModel

    @State private var borrowerName = ""
    @State private var borrowerContact = ""
    @State private var principalAmount = ""
    @State private var currency = "DOP"
    @State private var interestMode: LoanInterestMode = .fixedTotal
    @State private var annualRate = ""
    @State private var termMonths = ""
    @State private var selectedAccountId = ""
    @State private var notes = ""
    @State private var shakeTrigger = false

    private var isValid: Bool {
        borrowerName.isNotBlank &&
        Double(principalAmount) != nil &&
        Int(termMonths) != nil &&
        !selectedAccountId.isEmpty
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: Spacing.lg.rawValue) {
                        FormField(title: "Nombre del prestatario", icon: "person", placeholder: "Nombre completo", text: $borrowerName, validation: { $0.isEmpty ? "El nombre es requerido" : nil })
                        FormField(title: "Contacto", icon: "phone", placeholder: "Teléfono o email (opcional)", text: $borrowerContact)

                        CurrencyField(title: "Monto del préstamo", amount: $principalAmount, currency: $currency)

                        DropdownPicker(
                            title: "Modo de interés",
                            selection: $interestMode,
                            options: LoanInterestMode.allCases,
                            labelForOption: { $0.displayName },
                            icon: "percent"
                        )

                        if interestMode == .fixedTotal {
                            FormField(title: "Tasa anual (%)", icon: "percent", placeholder: "0.00", text: $annualRate, keyboardType: .decimalPad)
                        }

                        FormField(title: "Plazo (meses)", icon: "calendar", placeholder: "12", text: $termMonths, keyboardType: .numberPad, validation: { value in
                            if value.isEmpty { return "Requerido" }
                            if Int(value) == nil { return "Número inválido" }
                            return nil
                        })

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

                        FormField(title: "Notas", icon: "text.alignleft", placeholder: "Notas (opcional)", text: $notes)
                    }
                    .padding(Spacing.lg.rawValue)
                }
                .shake(trigger: shakeTrigger)
            }
            .navigationTitle("Nuevo Préstamo")
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
        guard let principal = Double(principalAmount),
              let months = Int(termMonths) else { return }

        let request = CreateLoanRequest(
            borrowerName: borrowerName,
            borrowerContact: borrowerContact.isEmpty ? nil : borrowerContact,
            principalAmount: principal,
            currency: currency,
            interestMode: interestMode.rawValue,
            annualRate: Double(annualRate) ?? 0,
            termMonths: months,
            startDate: nil,
            sourceAccountId: selectedAccountId,
            notes: notes.isEmpty ? nil : notes
        )

        do {
            _ = try await viewModel.createLoan(request: request)
            dismiss()
        } catch {
            shakeTrigger = false
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                shakeTrigger = true
            }
            viewModel.showError(error.localizedDescription)
        }
    }
}
