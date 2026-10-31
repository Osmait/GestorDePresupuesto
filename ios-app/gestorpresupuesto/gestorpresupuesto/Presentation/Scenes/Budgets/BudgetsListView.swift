import SwiftUI

struct BudgetsListView: View {
    @StateObject private var viewModel = BudgetsViewModel()
    @State private var showingAddBudget = false
    @State private var showDeleteConfirmation = false
    @State private var budgetToDelete: BudgetResponse?

    var body: some View {
        Group { // The tab or the "Más" stack provides the NavigationStack
            ZStack {
            Color.app.background.ignoresSafeArea()

            Group {
                if viewModel.budgets.isEmpty && viewModel.isLoading {
                    VStack(spacing: .md) {
                        ForEach(0..<3, id: \.self) { _ in CardSkeleton() }
                    }
                    .padding()
                } else if viewModel.budgets.isEmpty {
                    EmptyStateView(
                        icon: "chart.pie",
                        title: "Sin presupuestos",
                        message: "Crea tu primer presupuesto para controlar tus gastos por categoría.",
                        actionTitle: "Crear presupuesto",
                        action: { showingAddBudget = true }
                    )
                } else {
                    List {
                        ForEach(viewModel.budgets) { budget in
                            BudgetRowView(budget: budget)
                                .listRowBackground(Color.clear)
                                .listRowSeparator(.hidden)
                                .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                                .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                    Button(role: .destructive) {
                                        budgetToDelete = budget
                                        showDeleteConfirmation = true
                                    } label: {
                                        Label("Eliminar", systemImage: "trash")
                                    }
                                }
                        }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                    .refreshable {
                        await viewModel.loadBudgets()
                    }
                }
            }
        }
        .navigationTitle("Presupuestos")
        .notificationToolbar()
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Nuevo presupuesto", systemImage: "plus") { showingAddBudget = true }
            }
        }
        .sheet(isPresented: $showingAddBudget) {
            AddBudgetView(viewModel: viewModel, isPresented: $showingAddBudget)
                .formSheet()
        }
        .task {
            if viewModel.budgets.isEmpty {
                await viewModel.loadBudgets()
            }
        }
        .errorBanner(isPresented: $viewModel.showErrorBanner, message: viewModel.errorBannerMessage)
        .toast(isPresented: $viewModel.showToast, type: viewModel.toastType, message: viewModel.toastMessage)
        .deleteConfirmation(isPresented: $showDeleteConfirmation, itemName: "presupuesto") {
            if let budget = budgetToDelete {
                Task { await viewModel.deleteBudget(budget.id) }
            }
        }
        }
    }
}

struct BudgetRowView: View {
    let budget: BudgetResponse

    var body: some View {
        GlassCard(cornerRadius: .lg, padding: .lg) {
            VStack(spacing: .md) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(budget.displayName)
                            .font(.caption)
                            .foregroundStyle(Color.app.textSecondary)

                        Text(budget.amount.currencyFormatted)
                            .font(.app(.title3))
                            .fontWeight(.bold)
                            .foregroundStyle(Color.app.textPrimary)
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: 2) {
                        Text("Gastado")
                            .font(.caption)
                            .foregroundStyle(Color.app.textSecondary)

                        Text(budget.spent.currencyFormatted)
                            .font(.app(.headline))
                            .foregroundStyle(budget.isOverBudget ? Color.app.error : Color.app.textPrimary)
                    }
                }

                GradientProgressBar(
                    progress: budget.progress,
                    height: 10,
                    showLabel: false,
                    isCritical: budget.isCritical,
                    isWarning: budget.isWarning
                )

                HStack {
                    Text("\(budget.percentageUsed)% usado")
                        .font(.caption)
                        .foregroundStyle(Color.app.textTertiary)

                    Spacer()

                    if budget.isOverBudget {
                        Text("Excedido por \(abs(budget.remaining).currencyFormatted)")
                            .font(.caption)
                            .foregroundStyle(Color.app.error)
                    } else {
                        Text("Disponible: \(budget.remaining.currencyFormatted)")
                            .font(.caption)
                            .foregroundStyle(Color.app.textTertiary)
                    }
                }
            }
        }
    }
}

struct AddBudgetView: View {
    @ObservedObject var viewModel: BudgetsViewModel
    @Binding var isPresented: Bool

    @State private var amount = ""
    @State private var selectedCategoryId = ""
    @State private var isLoading = false
    @State private var shakeTrigger = false

    @StateObject private var categoriesViewModel = CategoriesViewModel()

    private var isValid: Bool {
        Double(amount) != nil && Double(amount)! > 0 && !selectedCategoryId.isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Categoría", selection: $selectedCategoryId) {
                        Text("Elegir").tag("")
                        ForEach(categoriesViewModel.categories) { category in
                            Text("\(category.icon) \(category.name)").tag(category.id)
                        }
                    }
                    TextField("Monto mensual", text: $amount)
                        .keyboardType(.decimalPad)
                } footer: {
                    if categoriesViewModel.categories.isEmpty && !categoriesViewModel.isLoading {
                        Text("Crea una categoría primero en Más › Categorías.")
                    } else {
                        Text("El límite se compara con los gastos de esa categoría en el mes.")
                    }
                }
            }
            .shake(trigger: shakeTrigger)
            .navigationTitle("Nuevo presupuesto")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { isPresented = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if isLoading {
                        ProgressView()
                    } else {
                        Button("Guardar") { Task { await saveBudget() } }
                            .disabled(!isValid)
                    }
                }
            }
            .task {
                await categoriesViewModel.loadCategories()
            }
        }
    }

    private func saveBudget() async {
        guard let amountValue = Double(amount) else { return }

        isLoading = true

        let request = CreateBudgetRequest(
            categoryId: selectedCategoryId,
            amount: amountValue
        )

        do {
            try await viewModel.createBudget(request: request)
            isPresented = false
        } catch {
            shakeTrigger = false
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
                shakeTrigger = true
            }
        }

        isLoading = false
    }
}

#Preview {
    BudgetsListView()
}
