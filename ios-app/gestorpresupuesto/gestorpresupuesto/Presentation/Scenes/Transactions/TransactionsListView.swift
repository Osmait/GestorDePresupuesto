import SwiftUI

struct TransactionsListView: View {
    @StateObject private var viewModel = TransactionsViewModel()
    @State private var showingAddTransaction = false
    @State private var showingFilters = false
    @State private var showingDocumentScanner = false
    @State private var showDeleteConfirmation = false
    @State private var transactionToDelete: Transaction?

    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()

                VStack(spacing: 0) {
                    // Filter bar
                    FilterBar(viewModel: viewModel, showingFilters: $showingFilters)

                    // Content
                    if viewModel.transactions.isEmpty && viewModel.isLoading {
                        VStack(spacing: Spacing.md.rawValue) {
                            ForEach(0..<5, id: \.self) { _ in CardSkeleton() }
                        }
                        .padding()
                    } else if viewModel.transactions.isEmpty {
                        EmptyStateView(
                            icon: "arrow.left.arrow.right",
                            title: "Sin transacciones",
                            message: viewModel.hasActiveFilters
                                ? "No hay transacciones con los filtros seleccionados."
                                : "Agrega tu primera transacción para empezar.",
                            actionTitle: viewModel.hasActiveFilters ? "Limpiar filtros" : "Agregar transacción",
                            action: {
                                if viewModel.hasActiveFilters {
                                    viewModel.clearFilters()
                                    Task { await viewModel.applyFilters() }
                                } else {
                                    showingAddTransaction = true
                                }
                            }
                        )
                    } else {
                        List {
                            // Summary header
                            summaryHeader
                                .listRowBackground(Color.clear)
                                .listRowInsets(EdgeInsets(top: 0, leading: 16, bottom: 8, trailing: 16))
                                .listRowSeparator(.hidden)

                            // Transactions
                            ForEach(viewModel.transactions) { transaction in
                                TransactionRow(transaction: transaction)
                                    .listRowBackground(Color.clear)
                                    .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                        Button(role: .destructive) {
                                            transactionToDelete = transaction
                                            showDeleteConfirmation = true
                                        } label: {
                                            Label("Eliminar", systemImage: "trash")
                                        }
                                    }
                            }

                            if viewModel.hasMorePages {
                                HStack {
                                    Spacer()
                                    ProgressView()
                                    Spacer()
                                }
                                .listRowBackground(Color.clear)
                                .task { await viewModel.loadTransactions() }
                            }
                        }
                        .listStyle(.plain)
                        .scrollContentBackground(.hidden)
                    }
                }
            }
            .navigationTitle("Transacciones")
            .notificationToolbar()
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    HStack(spacing: Spacing.sm.rawValue) {
                        Button { showingFilters = true } label: {
                            Image(systemName: "line.3.horizontal.decrease.circle")
                                .foregroundStyle(Color.app.textSecondary)
                        }

                        Menu {
                            Button {
                                showingAddTransaction = true
                            } label: {
                                Label("Agregar manual", systemImage: "square.and.pencil")
                            }
                            Button {
                                showingDocumentScanner = true
                            } label: {
                                Label("Escanear documento", systemImage: "doc.text.viewfinder")
                            }
                        } label: {
                            Image(systemName: "plus.circle.fill")
                                .font(.system(size: 24))
                                .foregroundStyle(Color.app.accent)
                        }
                    }
                }
            }
            .sheet(isPresented: $showingAddTransaction) {
                AddTransactionView(viewModel: viewModel, isPresented: $showingAddTransaction)
            }
            .sheet(isPresented: $showingFilters) {
                TransactionFilterView(viewModel: viewModel, isPresented: $showingFilters)
            }
            .sheet(isPresented: $showingDocumentScanner) {
                NavigationStack { DocumentScannerView() }
                    .presentationDetents([.large])
                    .presentationDragIndicator(.visible)
            }
            .task {
                await viewModel.loadInitialData()
                if viewModel.transactions.isEmpty {
                    await viewModel.loadTransactions()
                }
            }
            .refreshable { await viewModel.refresh() }
            .errorBanner(isPresented: $viewModel.showErrorBanner, message: viewModel.errorBannerMessage)
            .toast(isPresented: $viewModel.showToast, type: viewModel.toastType, message: viewModel.toastMessage)
            .deleteConfirmation(isPresented: $showDeleteConfirmation, itemName: "transacción") {
                if let transaction = transactionToDelete {
                    Task { await viewModel.deleteTransaction(transaction.id) }
                }
            }
        }
    }

    // MARK: - Summary Header

    private var summaryHeader: some View {
        VStack(spacing: Spacing.md.rawValue) {
            // Income & Expenses cards
            HStack(spacing: Spacing.sm.rawValue) {
                summaryCard(
                    title: "Ingresos",
                    amount: viewModel.totalIncome,
                    icon: "arrow.up.circle.fill",
                    color: .app.success
                )
                summaryCard(
                    title: "Gastos",
                    amount: viewModel.totalExpenses,
                    icon: "arrow.down.circle.fill",
                    color: .app.error
                )
            }

            // Net balance bar
            HStack {
                Text("Balance neto")
                    .font(.app(.caption))
                    .foregroundStyle(Color.app.textTertiary)
                Spacer()
                Text((viewModel.netAmount >= 0 ? "+" : "") + viewModel.netAmount.currencyFormatted)
                    .font(.app(.subheadline))
                    .fontWeight(.bold)
                    .foregroundStyle(viewModel.netAmount >= 0 ? Color.app.success : Color.app.error)
            }
            .padding(.horizontal, Spacing.md.rawValue)
            .padding(.vertical, Spacing.sm.rawValue)
            .background(
                RoundedRectangle(cornerRadius: Radius.md.rawValue)
                    .fill(Color.app.surface)
            )
        }
        .padding(.top, Spacing.sm.rawValue)
    }

    private func summaryCard(title: String, amount: Double, icon: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: Spacing.sm.rawValue) {
            HStack(spacing: Spacing.xs.rawValue) {
                Image(systemName: icon)
                    .font(.system(size: 14))
                    .foregroundStyle(color)
                Text(title)
                    .font(.app(.caption))
                    .foregroundStyle(Color.app.textSecondary)
            }

            Text(amount.currencyFormatted)
                .font(.app(.headline))
                .fontWeight(.bold)
                .foregroundStyle(Color.app.textPrimary)
                .minimumScaleFactor(0.7)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.md.rawValue)
        .background(
            RoundedRectangle(cornerRadius: Radius.lg.rawValue)
                .fill(color.opacity(0.08))
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radius.lg.rawValue)
                .stroke(color.opacity(0.15), lineWidth: 1)
        )
    }
}

struct FilterBar: View {
    @ObservedObject var viewModel: TransactionsViewModel
    @Binding var showingFilters: Bool

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: .sm) {
                FilterChip(
                    title: viewModel.selectedPeriod.rawValue,
                    icon: "calendar",
                    isActive: true
                ) {
                    showingFilters = true
                }

                if viewModel.selectedType != .all {
                    FilterChip(
                        title: viewModel.selectedType.rawValue,
                        icon: viewModel.selectedType == .income ? "arrow.up.circle" : "arrow.down.circle",
                        isActive: true,
                        color: viewModel.selectedType == .income ? .app.success : .app.error
                    ) {
                        viewModel.selectedType = .all
                        Task { await viewModel.applyFilters() }
                    }
                }

                if let categoryId = viewModel.selectedCategoryId,
                   let category = viewModel.categories.first(where: { $0.id == categoryId }) {
                    FilterChip(
                        title: category.name,
                        icon: nil,
                        emoji: category.icon,
                        isActive: true,
                        color: category.colorValue
                    ) {
                        viewModel.selectedCategoryId = nil
                        Task { await viewModel.applyFilters() }
                    }
                }

                if let accountId = viewModel.selectedAccountId,
                   let account = viewModel.accounts.first(where: { $0.accountInfo.id == accountId }) {
                    FilterChip(
                        title: account.accountInfo.name,
                        icon: "creditcard",
                        isActive: true
                    ) {
                        viewModel.selectedAccountId = nil
                        Task { await viewModel.applyFilters() }
                    }
                }

                if !viewModel.searchText.isEmpty {
                    FilterChip(
                        title: "\"\(viewModel.searchText)\"",
                        icon: "magnifyingglass",
                        isActive: true
                    ) {
                        viewModel.searchText = ""
                        Task { await viewModel.applyFilters() }
                    }
                }
            }
            .padding(.horizontal)
            .padding(.vertical, .sm)
        }
        .background(Color.app.surface.opacity(0.5))
    }
}

struct FilterChip: View {
    let title: String
    var icon: String?
    var emoji: String?
    let isActive: Bool
    var color: Color = .app.accent
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: .xs) {
                if let emoji = emoji {
                    Text(emoji)
                        .font(.caption)
                } else if let icon = icon {
                    Image(systemName: icon)
                        .font(.caption)
                }

                Text(title)
                    .font(.caption)
                    .fontWeight(.medium)
                    .lineLimit(1)

                if isActive {
                    Image(systemName: "xmark")
                        .font(.caption2)
                }
            }
            .foregroundStyle(isActive ? .white : Color.app.textPrimary)
            .padding(.horizontal, .sm)
            .padding(.vertical, .xs)
            .background(
                Capsule()
                    .fill(isActive ? color : Color.app.surfaceSecondary)
            )
        }
        .buttonStyle(PlainButtonStyle())
    }
}

struct AddTransactionView: View {
    @ObservedObject var viewModel: TransactionsViewModel
    @Binding var isPresented: Bool

    @State private var name = ""
    @State private var description = ""
    @State private var amount = ""
    @State private var isIncome = false
    @State private var selectedAccountId = ""
    @State private var selectedCategoryId = ""
    @State private var transactionDate = Date()
    @State private var isLoading = false
    @State private var shakeTrigger = false

    private var isValid: Bool {
        !name.isEmpty && Double(amount) != nil && (Double(amount) ?? 0) > 0
            && !selectedAccountId.isEmpty && !selectedCategoryId.isEmpty
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: Spacing.lg.rawValue) {
                        // Type toggle
                        typeToggle

                        // Amount
                        amountSection

                        // Details
                        VStack(spacing: Spacing.md.rawValue) {
                            FormField(
                                icon: "tag",
                                placeholder: "Nombre",
                                text: $name,
                                validation: { $0.nameError }
                            )

                            FormField(
                                icon: "text.alignleft",
                                placeholder: "Descripción (opcional)",
                                text: $description,
                                showSuccessIndicator: false
                            )
                        }

                        // Account & Category
                        VStack(spacing: Spacing.md.rawValue) {
                            DropdownPicker(
                                title: "Cuenta",
                                selection: $selectedAccountId,
                                options: viewModel.accounts.map { $0.accountInfo.id },
                                labelForOption: { id in
                                    if let account = viewModel.accounts.first(where: { $0.accountInfo.id == id }) {
                                        return "\(account.accountInfo.name) – \(account.accountInfo.bank)"
                                    }
                                    return id
                                },
                                icon: "creditcard"
                            )

                            DropdownPicker(
                                title: "Categoría",
                                selection: $selectedCategoryId,
                                options: viewModel.categories.map { $0.id },
                                labelForOption: { id in
                                    if let cat = viewModel.categories.first(where: { $0.id == id }) {
                                        return "\(cat.icon) \(cat.name)"
                                    }
                                    return id
                                },
                                icon: "folder"
                            )
                        }

                        // Date
                        DatePickerField(title: "Fecha", date: $transactionDate)

                        // Save
                        PrimaryButton(
                            "Guardar Transacción",
                            icon: "checkmark",
                            isLoading: isLoading
                        ) {
                            Task { await saveTransaction() }
                        }
                        .disabled(!isValid)
                    }
                    .padding(Spacing.lg.rawValue)
                }
                .shake(trigger: shakeTrigger)
            }
            .navigationTitle("Nueva Transacción")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancelar") { isPresented = false }
                }
            }
            .task {
                await viewModel.loadInitialData()
            }
        }
    }

    // MARK: - Type Toggle

    private var typeToggle: some View {
        HStack(spacing: 0) {
            typeButton(title: "Gasto", icon: "arrow.down.circle.fill", active: !isIncome, color: .app.error) {
                withAnimation(.spring(response: 0.3)) { isIncome = false }
            }
            typeButton(title: "Ingreso", icon: "arrow.up.circle.fill", active: isIncome, color: .app.success) {
                withAnimation(.spring(response: 0.3)) { isIncome = true }
            }
        }
        .background(Color.app.surfaceSecondary)
        .clipShape(RoundedRectangle(cornerRadius: Radius.lg.rawValue))
    }

    private func typeButton(title: String, icon: String, active: Bool, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: Spacing.xs.rawValue) {
                Image(systemName: icon)
                    .font(.system(size: 18))
                Text(title)
                    .font(.app(.subheadline))
                    .fontWeight(.semibold)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.md.rawValue)
            .foregroundStyle(active ? .white : Color.app.textTertiary)
            .background(active ? color : .clear)
            .clipShape(RoundedRectangle(cornerRadius: Radius.lg.rawValue))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Amount

    private var amountSection: some View {
        VStack(spacing: Spacing.xs.rawValue) {
            Text(isIncome ? "¿Cuánto recibiste?" : "¿Cuánto gastaste?")
                .font(.app(.caption))
                .foregroundStyle(Color.app.textSecondary)

            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text("RD$")
                    .font(.app(.title3))
                    .foregroundStyle(Color.app.textTertiary)

                TextField("0.00", text: $amount)
                    .font(.system(size: 40, weight: .bold, design: .rounded))
                    .foregroundStyle(isIncome ? Color.app.success : Color.app.textPrimary)
                    .keyboardType(.decimalPad)
                    .multilineTextAlignment(.center)
                    .minimumScaleFactor(0.5)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, Spacing.md.rawValue)
        }
    }

    // MARK: - Save

    private func saveTransaction() async {
        guard let amountValue = Double(amount) else { return }

        isLoading = true

        let request = CreateTransactionRequest(
            name: name,
            description: description.isEmpty ? nil : description,
            amount: amountValue,
            typeTransaction: isIncome ? "income" : "bill",
            accountId: selectedAccountId,
            categoryId: selectedCategoryId,
            budgetId: nil,
            currency: nil,
            createdAt: transactionDate
        )

        do {
            try await viewModel.createTransaction(request: request)
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
    TransactionsListView()
}
