import SwiftUI

struct TransactionsListView: View {
    @StateObject private var viewModel = TransactionsViewModel()
    @State private var showingAddTransaction = false
    @State private var showingFilters = false
    @State private var showingDocumentScanner = false
    
    var body: some View {
        NavigationStack {
            ZStack {
            Color.app.background.ignoresSafeArea()
            
            VStack(spacing: 0) {
                FilterBar(
                    viewModel: viewModel,
                    showingFilters: $showingFilters
                )
                
                Group {
                    if viewModel.transactions.isEmpty && viewModel.isLoading {
                        VStack(spacing: .md) {
                            ForEach(0..<5, id: \.self) { _ in CardSkeleton() }
                        }
                        .padding()
                    } else if viewModel.transactions.isEmpty {
                        EmptyStateView(
                            icon: "arrow.left.arrow.right",
                            title: "Sin transacciones",
                            message: viewModel.hasActiveFilters
                                ? "No hay transacciones con los filtros seleccionados."
                                : "Agrega tu primera transacción para empezar a controlar tus finanzas.",
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
                            ForEach(viewModel.transactions) { transaction in
                                TransactionRow(transaction: transaction)
                                    .listRowBackground(Color.clear)
                                    .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
                                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                                        Button(role: .destructive) {
                                            Task { await viewModel.deleteTransaction(transaction.id) }
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
                                .task {
                                    await viewModel.loadTransactions()
                                }
                            }
                        }
                        .listStyle(.plain)
                        .scrollContentBackground(.hidden)
                    }
                }
            }
        }
        .navigationTitle("Transacciones")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                HStack(spacing: Spacing.sm.rawValue) {
                    IconButton("line.3.horizontal.decrease.circle") {
                        showingFilters = true
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
            NavigationStack {
                DocumentScannerView()
            }
            .presentationDetents([.large])
            .presentationDragIndicator(.visible)
        }
        .task {
            await viewModel.loadInitialData()
            if viewModel.transactions.isEmpty {
                await viewModel.loadTransactions()
            }
        }
        .refreshable {
            await viewModel.refresh()
        }
        .errorBanner(isPresented: $viewModel.showErrorBanner, message: viewModel.errorBannerMessage)
        .toast(isPresented: $viewModel.showToast, type: viewModel.toastType, message: viewModel.toastMessage)
        }
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
    var icon: String? = nil
    var emoji: String? = nil
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
    @State private var selectedType: TransactionType = .expense
    @State private var selectedAccountId = ""
    @State private var selectedCategoryId = ""
    @State private var isLoading = false
    @State private var shakeTrigger = false
    
    private var isValid: Bool {
        !name.isEmpty && Double(amount) != nil && Double(amount)! > 0 && !selectedAccountId.isEmpty && !selectedCategoryId.isEmpty
    }
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()
                
                GlassCard(cornerRadius: .xl, padding: .lg) {
                    VStack(spacing: .md) {
                        Text("Nueva Transacción")
                            .font(.app(.title3))
                            .foregroundStyle(Color.app.textPrimary)
                        
                        VStack(spacing: .sm) {
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
                            
                            FormField(
                                icon: "dollarsign",
                                placeholder: "Monto",
                                text: $amount,
                                keyboardType: .decimalPad,
                                validation: { $0.amountError }
                            )
                            
                            Picker("Tipo", selection: $selectedType) {
                                ForEach(TransactionType.allCases, id: \.self) { type in
                                    Text(type.displayName).tag(type)
                                }
                            }
                            .pickerStyle(.segmented)
                            
                            if viewModel.accounts.isEmpty {
                                Text("No hay cuentas disponibles")
                                    .font(.caption)
                                    .foregroundStyle(Color.app.textSecondary)
                            } else {
                                Menu {
                                    ForEach(viewModel.accounts) { account in
                                        Button {
                                            selectedAccountId = account.accountInfo.id
                                        } label: {
                                            Text("\(account.accountInfo.name) - \(account.accountInfo.bank)")
                                        }
                                    }
                                } label: {
                                    HStack {
                                        Image(systemName: "creditcard")
                                            .foregroundStyle(Color.app.textTertiary)
                                        Text(selectedAccountId.isEmpty ? "Seleccionar cuenta" : viewModel.accounts.first(where: { $0.accountInfo.id == selectedAccountId })?.accountInfo.name ?? "")
                                            .foregroundStyle(selectedAccountId.isEmpty ? Color.app.textTertiary : Color.app.textPrimary)
                                        Spacer()
                                        Image(systemName: "chevron.down")
                                            .foregroundStyle(Color.app.textTertiary)
                                    }
                                    .padding()
                                    .background(Color.app.surfaceSecondary)
                                    .cornerRadius(Radius.md)
                                }
                            }
                            
                            if viewModel.categories.isEmpty {
                                Text("No hay categorías disponibles")
                                    .font(.caption)
                                    .foregroundStyle(Color.app.textSecondary)
                            } else {
                                Menu {
                                    ForEach(viewModel.categories) { category in
                                        Button {
                                            selectedCategoryId = category.id
                                        } label: {
                                            Text("\(category.icon) \(category.name)")
                                        }
                                    }
                                } label: {
                                    HStack {
                                        Image(systemName: "folder")
                                            .foregroundStyle(Color.app.textTertiary)
                                        Text(selectedCategoryId.isEmpty ? "Seleccionar categoría" : viewModel.categories.first(where: { $0.id == selectedCategoryId })?.name ?? "")
                                            .foregroundStyle(selectedCategoryId.isEmpty ? Color.app.textTertiary : Color.app.textPrimary)
                                        Spacer()
                                        Image(systemName: "chevron.down")
                                            .foregroundStyle(Color.app.textTertiary)
                                    }
                                    .padding()
                                    .background(Color.app.surfaceSecondary)
                                    .cornerRadius(Radius.md)
                                }
                            }
                        }
                        
                        HStack(spacing: .md) {
                            SecondaryButton("Cancelar") {
                                isPresented = false
                            }
                            
                            PrimaryButton(
                                "Guardar",
                                isLoading: isLoading
                            ) {
                                Task { await saveTransaction() }
                            }
                            .disabled(!isValid)
                        }
                    }
                }
                .padding()
                .shake(trigger: shakeTrigger)
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cerrar") {
                        isPresented = false
                    }
                }
            }
            .task {
                await viewModel.loadInitialData()
            }
        }
    }
    
    private func saveTransaction() async {
        guard let amountValue = Double(amount) else { return }
        
        isLoading = true
        
        let request = CreateTransactionRequest(
            name: name,
            description: description.isEmpty ? nil : description,
            amount: amountValue,
            typeTransaction: selectedType.rawValue,
            accountId: selectedAccountId,
            categoryId: selectedCategoryId,
            budgetId: nil,
            createdAt: nil
        )
        
        do {
            _ = try await viewModel.createTransaction(request: request)
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
