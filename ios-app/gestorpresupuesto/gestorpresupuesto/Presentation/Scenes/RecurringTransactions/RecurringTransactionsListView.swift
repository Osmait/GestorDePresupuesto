import SwiftUI

struct RecurringTransactionsListView: View {
    @StateObject private var viewModel = RecurringTransactionsViewModel()
    @State private var showingAddRecurring = false
    @State private var showDeleteConfirmation = false
    @State private var transactionToDelete: RecurringTransaction?

    var body: some View {
        Group { // The tab or the "Más" stack provides the NavigationStack
        ZStack {
            Color.app.background.ignoresSafeArea()

            Group {
                if viewModel.recurringTransactions.isEmpty && viewModel.isLoading {
                    VStack(spacing: .md) {
                        ForEach(0..<3, id: \.self) { _ in CardSkeleton() }
                    }
                    .padding()
                } else if viewModel.recurringTransactions.isEmpty {
                    EmptyStateView(
                        icon: "arrow.clockwise",
                        title: "Sin transacciones recurrentes",
                        message: "Configura ingresos o gastos que se repiten mensualmente.",
                        actionTitle: "Agregar recurrente",
                        action: { showingAddRecurring = true }
                    )
                } else {
                    ScrollView {
                        VStack(spacing: .lg) {
                            SummaryCardsSection(
                                totalIncome: viewModel.totalIncome,
                                totalBills: viewModel.totalBills
                            )

                            if !viewModel.incomeTransactions.isEmpty {
                                RecurringSection(
                                    title: "Ingresos recurrentes",
                                    icon: "arrow.down.circle.fill",
                                    color: .app.success,
                                    transactions: viewModel.incomeTransactions
                                ) { transaction in
                                    transactionToDelete = transaction
                                    showDeleteConfirmation = true
                                }
                            }

                            if !viewModel.billTransactions.isEmpty {
                                RecurringSection(
                                    title: "Gastos recurrentes",
                                    icon: "arrow.up.circle.fill",
                                    color: .app.error,
                                    transactions: viewModel.billTransactions
                                ) { transaction in
                                    transactionToDelete = transaction
                                    showDeleteConfirmation = true
                                }
                            }
                        }
                        .padding()
                    }
                    .refreshable {
                        await viewModel.loadRecurringTransactions()
                    }
                }
            }
        }
        .navigationTitle("Recurrentes")
        .notificationToolbar()
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Nueva recurrente", systemImage: "plus") { showingAddRecurring = true }
            }
        }
        .sheet(isPresented: $showingAddRecurring) {
            AddRecurringTransactionView(viewModel: viewModel, isPresented: $showingAddRecurring)
                .formSheet()
        }
        .task {
            if viewModel.recurringTransactions.isEmpty {
                await viewModel.loadRecurringTransactions()
            }
        }
        .errorBanner(isPresented: $viewModel.showErrorBanner, message: viewModel.errorBannerMessage)
        .toast(isPresented: $viewModel.showToast, type: viewModel.toastType, message: viewModel.toastMessage)
        .deleteConfirmation(isPresented: $showDeleteConfirmation, itemName: "transacción recurrente") {
            if let transaction = transactionToDelete {
                Task { await viewModel.deleteRecurringTransaction(transaction.id) }
            }
        }
        } // NavigationStack
    }
}

struct SummaryCardsSection: View {
    let totalIncome: Double
    let totalBills: Double

    var body: some View {
        HStack(spacing: .md) {
            StatCard(
                title: "Ingresos",
                value: totalIncome.currencyFormatted,
                icon: "arrow.down.circle.fill",
                colors: Color.app.gradientSuccess
            )

            StatCard(
                title: "Gastos",
                value: totalBills.currencyFormatted,
                icon: "arrow.up.circle.fill",
                colors: Color.app.gradientError
            )
        }
    }
}

struct RecurringSection: View {
    let title: String
    let icon: String
    let color: Color
    let transactions: [RecurringTransaction]
    let onDelete: (RecurringTransaction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: .sm) {
            HStack(spacing: .sm) {
                Image(systemName: icon)
                    .foregroundStyle(color)
                Text(title)
                    .font(.app(.headline))
                    .foregroundStyle(Color.app.textPrimary)
            }
            .padding(.horizontal)

            VStack(spacing: .sm) {
                ForEach(transactions) { transaction in
                    RecurringTransactionRow(
                        transaction: transaction,
                        color: color,
                        onDelete: { onDelete(transaction) }
                    )
                }
            }
        }
    }
}

struct RecurringTransactionRow: View {
    let transaction: RecurringTransaction
    let color: Color
    let onDelete: () -> Void

    var body: some View {
        GlassCard(cornerRadius: .lg, padding: .md) {
            HStack(spacing: .md) {
                ZStack {
                    Circle()
                        .fill(color.opacity(0.15))
                        .frame(width: 44, height: 44)

                    Image(systemName: transaction.isIncome ? "arrow.down" : "arrow.up")
                        .font(.system(.body, weight: .semibold))
                        .foregroundStyle(color)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(transaction.name)
                        .font(.app(.headline))
                        .foregroundStyle(Color.app.textPrimary)

                    if let days = transaction.daysUntilNextExecution {
                        Text("En \(days) días")
                            .font(.caption)
                            .foregroundStyle(Color.app.textSecondary)
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                    Text(transaction.amount.currencyFormatted).singleLineAmount()
                        .font(.app(.headline))
                        .foregroundStyle(color)

                    Text("Día \(transaction.dayOfMonth)")
                        .font(.caption2)
                        .foregroundStyle(Color.app.textTertiary)
                }
            }
        }
        // The rows live in a ScrollView, where swipe actions never fire.
        .contextMenu {
            Button(role: .destructive, action: onDelete) {
                Label("Eliminar", systemImage: "trash")
            }
        }
    }
}

struct AddRecurringTransactionView: View {
    @ObservedObject var viewModel: RecurringTransactionsViewModel
    @Binding var isPresented: Bool

    @State private var name = ""
    @State private var description = ""
    @State private var amount = ""
    @State private var selectedType: RecurringType = .bill
    @State private var selectedAccountId = ""
    @State private var selectedCategoryId = ""
    @State private var dayOfMonth = 1
    @State private var isLoading = false
    @State private var shakeTrigger = false

    @StateObject private var accountsViewModel = AccountsViewModel()
    @StateObject private var categoriesViewModel = CategoriesViewModel()

    private var isValid: Bool {
        !name.isEmpty && Double(amount) != nil && Double(amount)! > 0 && !selectedAccountId.isEmpty && !selectedCategoryId.isEmpty && dayOfMonth >= 1 && dayOfMonth <= 31
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Picker("Tipo", selection: $selectedType) {
                        Text("Gasto").tag(RecurringType.bill)
                        Text("Ingreso").tag(RecurringType.income)
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                }

                Section {
                    TextField("Nombre", text: $name)
                    TextField("Descripción (opcional)", text: $description)
                    TextField("Monto", text: $amount)
                        .keyboardType(.decimalPad)
                }

                Section {
                    Picker("Día del mes", selection: $dayOfMonth) {
                        ForEach(1...31, id: \.self) { day in
                            Text("Día \(day)").tag(day)
                        }
                    }
                    Picker("Cuenta", selection: $selectedAccountId) {
                        Text("Elegir").tag("")
                        ForEach(accountsViewModel.accounts) { account in
                            Text(account.accountInfo.name).tag(account.accountInfo.id)
                        }
                    }
                    Picker("Categoría", selection: $selectedCategoryId) {
                        Text("Elegir").tag("")
                        ForEach(categoriesViewModel.categories) { category in
                            Text("\(category.icon) \(category.name)").tag(category.id)
                        }
                    }
                } footer: {
                    Text("Se registra automáticamente cada mes en el día elegido.")
                }
            }
            .shake(trigger: shakeTrigger)
            .navigationTitle("Nueva recurrente")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { isPresented = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if isLoading {
                        ProgressView()
                    } else {
                        Button("Guardar") { Task { await saveRecurringTransaction() } }
                            .disabled(!isValid)
                    }
                }
            }
            .task {
                async let accounts: Void = accountsViewModel.loadAccounts()
                async let categories: Void = categoriesViewModel.loadCategories()
                _ = await (accounts, categories)
            }
        }
    }

    private func saveRecurringTransaction() async {
        guard let amountValue = Double(amount) else { return }

        isLoading = true

        let request = CreateRecurringTransactionRequest(
            name: name,
            description: description.isEmpty ? nil : description,
            amount: amountValue,
            type: selectedType.rawValue,
            accountId: selectedAccountId,
            categoryId: selectedCategoryId,
            budgetId: nil,
            dayOfMonth: dayOfMonth
        )

        do {
            try await viewModel.createRecurringTransaction(request: request)
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
    RecurringTransactionsListView()
}
