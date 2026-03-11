import SwiftUI

struct RecurringTransactionsListView: View {
    @StateObject private var viewModel = RecurringTransactionsViewModel()
    @State private var showingAddRecurring = false
    @State private var showDeleteConfirmation = false
    @State private var transactionToDelete: RecurringTransaction?

    var body: some View {
        NavigationStack {
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
                IconButton("plus") {
                    showingAddRecurring = true
                }
            }
        }
        .sheet(isPresented: $showingAddRecurring) {
            AddRecurringTransactionView(viewModel: viewModel, isPresented: $showingAddRecurring)
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
                        .font(.system(size: 18, weight: .semibold))
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
                    Text(transaction.amount.currencyFormatted)
                        .font(.app(.headline))
                        .foregroundStyle(color)

                    Text("Día \(transaction.dayOfMonth)")
                        .font(.caption2)
                        .foregroundStyle(Color.app.textTertiary)
                }
            }
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
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
            ZStack {
                Color.app.background.ignoresSafeArea()

                ScrollView {
                    GlassCard(cornerRadius: .xl, padding: .lg) {
                        VStack(spacing: .md) {
                            Text("Nueva Transacción Recurrente")
                                .font(.app(.title3))
                                .foregroundStyle(Color.app.textPrimary)

                            VStack(spacing: .sm) {
                                FormField(
                                    icon: "tag",
                                    placeholder: "Nombre",
                                    text: $name,
                                    validation: { value in
                                        value.isEmpty ? "El nombre es requerido" : nil
                                    }
                                )

                                FormField(
                                    icon: "text.alignleft",
                                    placeholder: "Descripción (opcional)",
                                    text: $description
                                )

                                FormField(
                                    icon: "dollarsign",
                                    placeholder: "Monto",
                                    text: $amount,
                                    keyboardType: .decimalPad,
                                    validation: { value in
                                        if value.isEmpty { return "El monto es requerido" }
                                        if let doubleValue = Double(value), doubleValue <= 0 {
                                            return "El monto debe ser mayor a 0"
                                        }
                                        if Double(value) == nil { return "Ingresa un número válido" }
                                        return nil
                                    }
                                )

                                VStack(alignment: .leading, spacing: .xs) {
                                    Text("Tipo")
                                        .font(.caption)
                                        .foregroundStyle(Color.app.textSecondary)

                                    HStack(spacing: .sm) {
                                        TypeChip(
                                            title: "Gasto",
                                            icon: "arrow.up.circle.fill",
                                            isSelected: selectedType == .bill,
                                            color: .app.error
                                        ) {
                                            selectedType = .bill
                                        }

                                        TypeChip(
                                            title: "Ingreso",
                                            icon: "arrow.down.circle.fill",
                                            isSelected: selectedType == .income,
                                            color: .app.success
                                        ) {
                                            selectedType = .income
                                        }
                                    }
                                }

                                DayOfMonthPicker(dayOfMonth: $dayOfMonth)

                                AccountPicker(
                                    accounts: accountsViewModel.accounts,
                                    selectedAccountId: $selectedAccountId
                                )

                                CategoryPicker(
                                    categories: categoriesViewModel.categories,
                                    selectedCategoryId: $selectedCategoryId
                                )
                            }

                            HStack(spacing: .md) {
                                SecondaryButton("Cancelar") {
                                    isPresented = false
                                }

                                PrimaryButton(
                                    "Guardar",
                                    isLoading: isLoading
                                ) {
                                    Task { await saveRecurringTransaction() }
                                }
                                .disabled(!isValid)
                            }
                        }
                    }
                    .padding()
                    .shake(trigger: shakeTrigger)
                }
            }
            .navigationBarTitleDisplayMode(.inline)
            .task {
                await accountsViewModel.loadAccounts()
                await categoriesViewModel.loadCategories()
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
            _ = try await viewModel.createRecurringTransaction(request: request)
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

struct TypeChip: View {
    let title: String
    let icon: String
    let isSelected: Bool
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: .xs) {
                Image(systemName: icon)
                    .font(.system(size: 14))
                Text(title)
                    .font(.app(.subheadline))
            }
            .padding(.horizontal, Spacing.md)
            .padding(.vertical, Spacing.sm)
            .background(isSelected ? color.opacity(0.2) : Color.app.surfaceSecondary)
            .foregroundStyle(isSelected ? color : Color.app.textSecondary)
            .cornerRadius(Radius.md)
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md.rawValue)
                    .stroke(isSelected ? color : Color.clear, lineWidth: 1)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

struct DayOfMonthPicker: View {
    @Binding var dayOfMonth: Int

    var body: some View {
        VStack(alignment: .leading, spacing: .xs) {
            Text("Día del mes")
                .font(.caption)
                .foregroundStyle(Color.app.textSecondary)

            HStack {
                ForEach([1, 5, 10, 15, 20, 25, 28], id: \.self) { day in
                    Button {
                        dayOfMonth = day
                    } label: {
                        Text("\(day)")
                            .font(.app(.caption))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, Spacing.sm)
                            .background(dayOfMonth == day ? Color.app.accent : Color.app.surfaceSecondary)
                            .foregroundStyle(dayOfMonth == day ? .white : Color.app.textSecondary)
                            .cornerRadius(Radius.sm)
                    }
                    .buttonStyle(PlainButtonStyle())
                }
            }

            HStack(spacing: .sm) {
                Text("Otro día:")
                    .font(.caption)
                    .foregroundStyle(Color.app.textSecondary)

                TextField("1-31", value: $dayOfMonth, formatter: NumberFormatter())
                    .font(.app(.body))
                    .keyboardType(.numberPad)
                    .multilineTextAlignment(.center)
                    .frame(width: 60)
                    .padding(Spacing.sm)
                    .background(Color.app.surfaceSecondary)
                    .cornerRadius(Radius.sm)
            }
        }
    }
}

struct AccountPicker: View {
    let accounts: [AccountResponse]
    @Binding var selectedAccountId: String

    var body: some View {
        VStack(alignment: .leading, spacing: .xs) {
            Text("Cuenta")
                .font(.caption)
                .foregroundStyle(Color.app.textSecondary)

            if accounts.isEmpty {
                HStack {
                    Image(systemName: "exclamationmark.triangle")
                        .foregroundStyle(Color.app.warning)
                    Text("No hay cuentas disponibles")
                        .font(.caption)
                        .foregroundStyle(Color.app.textSecondary)
                }
            } else {
                Menu {
                    ForEach(accounts, id: \.accountInfo.id) { account in
                        Button {
                            selectedAccountId = account.accountInfo.id
                        } label: {
                            Text("\(account.accountInfo.name) - \(account.accountInfo.bank)")
                        }
                    }
                } label: {
                    HStack {
                        Image(systemName: "building.columns")
                            .foregroundStyle(selectedAccountId.isEmpty ? Color.app.textTertiary : Color.app.accent)
                        Text(selectedAccountId.isEmpty ? "Seleccionar cuenta" : accounts.first(where: { $0.accountInfo.id == selectedAccountId })?.accountInfo.name ?? "")
                            .foregroundStyle(selectedAccountId.isEmpty ? Color.app.textTertiary : Color.app.textPrimary)
                        Spacer()
                        Image(systemName: "chevron.down")
                            .foregroundStyle(Color.app.textTertiary)
                    }
                    .padding()
                    .background(Color.app.surfaceSecondary)
                    .cornerRadius(Radius.md)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.md.rawValue)
                            .stroke(!selectedAccountId.isEmpty ? Color.app.success : Color.app.border, lineWidth: 1)
                    )
                }
            }
        }
    }
}

struct CategoryPicker: View {
    let categories: [Category]
    @Binding var selectedCategoryId: String

    var body: some View {
        VStack(alignment: .leading, spacing: .xs) {
            Text("Categoría")
                .font(.caption)
                .foregroundStyle(Color.app.textSecondary)

            if categories.isEmpty {
                HStack {
                    Image(systemName: "exclamationmark.triangle")
                        .foregroundStyle(Color.app.warning)
                    Text("No hay categorías disponibles")
                        .font(.caption)
                        .foregroundStyle(Color.app.textSecondary)
                }
            } else {
                Menu {
                    ForEach(categories) { category in
                        Button {
                            selectedCategoryId = category.id
                        } label: {
                            Text("\(category.icon) \(category.name)")
                        }
                    }
                } label: {
                    HStack {
                        Image(systemName: "folder")
                            .foregroundStyle(selectedCategoryId.isEmpty ? Color.app.textTertiary : Color.app.accent)
                        Text(selectedCategoryId.isEmpty ? "Seleccionar categoría" : categories.first(where: { $0.id == selectedCategoryId })?.name ?? "")
                            .foregroundStyle(selectedCategoryId.isEmpty ? Color.app.textTertiary : Color.app.textPrimary)
                        Spacer()
                        Image(systemName: "chevron.down")
                            .foregroundStyle(Color.app.textTertiary)
                    }
                    .padding()
                    .background(Color.app.surfaceSecondary)
                    .cornerRadius(Radius.md)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radius.md.rawValue)
                            .stroke(!selectedCategoryId.isEmpty ? Color.app.success : Color.app.border, lineWidth: 1)
                    )
                }
            }
        }
    }
}

#Preview {
    RecurringTransactionsListView()
}
