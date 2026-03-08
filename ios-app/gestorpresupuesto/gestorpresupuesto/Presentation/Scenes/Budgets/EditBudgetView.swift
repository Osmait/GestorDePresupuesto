import SwiftUI

struct EditBudgetView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var viewModel: BudgetsViewModel

    let budget: BudgetResponse
    let categories: [Category]

    @State private var selectedCategoryId: String
    @State private var amount: String

    init(viewModel: BudgetsViewModel, budget: BudgetResponse, categories: [Category]) {
        self.viewModel = viewModel
        self.budget = budget
        self.categories = categories
        _selectedCategoryId = State(initialValue: budget.categoryId)
        _amount = State(initialValue: String(format: "%.2f", budget.amount))
    }

    private var isValid: Bool {
        !selectedCategoryId.isEmpty && Double(amount) != nil && (Double(amount) ?? 0) > 0
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: Spacing.lg.rawValue) {
                        if !categories.isEmpty {
                            DropdownPicker(
                                title: "Categoría",
                                selection: $selectedCategoryId,
                                options: categories.map { $0.id },
                                labelForOption: { id in
                                    categories.first { $0.id == id }?.name ?? id
                                },
                                icon: "tag"
                            )
                        }

                        FormField(
                            title: "Monto",
                            icon: "dollarsign.circle",
                            placeholder: "0.00",
                            text: $amount,
                            keyboardType: .decimalPad
                        )
                    }
                    .padding(Spacing.lg.rawValue)
                }
            }
            .navigationTitle("Editar Presupuesto")
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
        guard let amountValue = Double(amount) else { return }
        let request = UpdateBudgetRequest(categoryId: selectedCategoryId, amount: amountValue)
        do {
            _ = try await viewModel.updateBudget(budget.id, request: request)
            dismiss()
        } catch {
            viewModel.showError(error.localizedDescription)
        }
    }
}
