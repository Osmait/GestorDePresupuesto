import SwiftUI
import Combine

@MainActor
class TransactionsViewModel: ObservableObject {
    @Published var transactions: [Transaction] = []
    @Published var isLoading = false
    @Published var error: String?
    @Published var currentPage = 1
    @Published var hasMorePages = true
    
    @Published var selectedPeriod: FilterPeriod = .thisMonth
    @Published var selectedType: FilterType = .all
    @Published var selectedCategoryId: String?
    @Published var selectedAccountId: String?
    @Published var searchText: String = ""
    @Published var amountMin: String = ""
    @Published var amountMax: String = ""
    
    @Published var categories: [Category] = []
    @Published var accounts: [AccountResponse] = []
    
    @Published var showErrorBanner = false
    @Published var errorBannerMessage = ""
    @Published var showToast = false
    @Published var toastType: ToastType = .success
    @Published var toastMessage = ""
    
    var hasActiveFilters: Bool {
        selectedPeriod != .thisMonth ||
        selectedType != .all ||
        selectedCategoryId != nil ||
        selectedAccountId != nil ||
        !searchText.isEmpty ||
        !amountMin.isEmpty ||
        !amountMax.isEmpty
    }
    
    private let transactionRepository: TransactionRepository
    private let categoryRepository: CategoryRepository
    private let accountRepository: AccountRepository
    
    init(
        transactionRepository: TransactionRepository = TransactionRepositoryImpl(),
        categoryRepository: CategoryRepository = CategoryRepositoryImpl(),
        accountRepository: AccountRepository = AccountRepositoryImpl()
    ) {
        self.transactionRepository = transactionRepository
        self.categoryRepository = categoryRepository
        self.accountRepository = accountRepository
    }
    
    func loadInitialData() async {
        async let categoriesTask = categoryRepository.getAll()
        async let accountsTask = accountRepository.getAll()
        
        do {
            categories = try await categoriesTask
            accounts = try await accountsTask
        } catch {
            print("Error loading filter data: \(error)")
        }
    }
    
    func loadTransactions() async {
        guard !isLoading && hasMorePages else { return }
        
        isLoading = true
        error = nil
        
        var filter = buildFilter()
        filter.page = currentPage
        
        do {
            let response = try await transactionRepository.getAll(filter: filter)
            transactions.append(contentsOf: response.data)
            hasMorePages = response.pagination.hasNextPage
            currentPage = response.pagination.currentPage + 1
        } catch {
            showError(error.localizedDescription)
        }
        
        isLoading = false
    }
    
    func refresh() async {
        currentPage = 1
        hasMorePages = true
        transactions = []
        await loadTransactions()
    }
    
    func applyFilters() async {
        currentPage = 1
        hasMorePages = true
        transactions = []
        await loadTransactions()
    }
    
    func clearFilters() {
        selectedPeriod = .thisMonth
        selectedType = .all
        selectedCategoryId = nil
        selectedAccountId = nil
        searchText = ""
        amountMin = ""
        amountMax = ""
    }
    
    private func buildFilter() -> TransactionFilter {
        var filter = TransactionFilter()
        
        let dateRange = selectedPeriod.dateRange
        filter.dateFrom = dateRange.from
        filter.dateTo = dateRange.to
        
        filter.type = selectedType.apiValue
        filter.categoryId = selectedCategoryId
        filter.accountId = selectedAccountId
        filter.search = searchText.isEmpty ? nil : searchText
        filter.amountMin = Double(amountMin)
        filter.amountMax = Double(amountMax)
        
        return filter
    }
    
    func createTransaction(request: CreateTransactionRequest) async throws -> Transaction {
        let transaction = try await transactionRepository.create(request)
        showSuccess("Transacción creada")
        await refresh()
        return transaction
    }
    
    func deleteTransaction(_ id: String) async {
        do {
            try await transactionRepository.delete(id)
            transactions.removeAll { $0.id == id }
            showSuccess("Transacción eliminada")
        } catch {
            showError(error.localizedDescription)
        }
    }
    
    private func showError(_ message: String) {
        error = message
        errorBannerMessage = message
        showErrorBanner = true
        
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.error)
    }
    
    private func showSuccess(_ message: String) {
        toastType = .success
        toastMessage = message
        showToast = true
    }
}

enum FilterPeriod: String, CaseIterable {
    case today = "Hoy"
    case thisWeek = "Semana"
    case thisMonth = "Mes"
    case lastMonth = "Mes Ant."
    case all = "Todo"
    
    var dateRange: (from: String?, to: String?) {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let calendar = Calendar.current
        let now = Date()
        
        switch self {
        case .today:
            let today = formatter.string(from: now)
            return (today, today)
        case .thisWeek:
            let startOfWeek = calendar.date(from: calendar.dateComponents([.yearForWeekOfYear, .weekOfYear], from: now)) ?? now
            let endOfWeek = calendar.date(byAdding: .day, value: 6, to: startOfWeek) ?? now
            return (formatter.string(from: startOfWeek), formatter.string(from: endOfWeek))
        case .thisMonth:
            let startOfMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: now)) ?? now
            let endOfMonth = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: startOfMonth) ?? now
            return (formatter.string(from: startOfMonth), formatter.string(from: endOfMonth))
        case .lastMonth:
            let startOfLastMonth = calendar.date(byAdding: .month, value: -1, to: calendar.date(from: calendar.dateComponents([.year, .month], from: now)) ?? now) ?? now
            let endOfLastMonth = calendar.date(byAdding: DateComponents(month: 1, day: -1), to: startOfLastMonth) ?? now
            return (formatter.string(from: startOfLastMonth), formatter.string(from: endOfLastMonth))
        case .all:
            return (nil, nil)
        }
    }
}

enum FilterType: String, CaseIterable {
    case all = "Todos"
    case income = "Ingresos"
    case expense = "Gastos"
    
    var apiValue: String? {
        switch self {
        case .all: return nil
        case .income: return "income"
        case .expense: return "expense"
        }
    }
}
