import Foundation
import UIKit
import Combine

@MainActor
class DashboardViewModel: ObservableObject {
    @Published var accounts: [AccountResponse] = []
    @Published var recentTransactions: [Transaction] = []
    @Published var budgets: [BudgetResponse] = []
    @Published var categoryExpenses: [CategoryExpense] = []
    @Published var totalBalance: Double = 0
    @Published var totalIncome: Double = 0
    @Published var totalExpenses: Double = 0
    @Published var isLoading = false
    @Published var error: String?
    
    @Published var showErrorBanner = false
    @Published var errorBannerMessage = ""
    
    private let accountRepository: AccountRepository
    private let transactionRepository: TransactionRepository
    private let budgetRepository: BudgetRepository
    private let analyticsRepository: AnalyticsRepository
    
    init(
        accountRepository: AccountRepository = AccountRepositoryImpl(),
        transactionRepository: TransactionRepository = TransactionRepositoryImpl(),
        budgetRepository: BudgetRepository = BudgetRepositoryImpl(),
        analyticsRepository: AnalyticsRepository = AnalyticsRepositoryImpl()
    ) {
        self.accountRepository = accountRepository
        self.transactionRepository = transactionRepository
        self.budgetRepository = budgetRepository
        self.analyticsRepository = analyticsRepository
    }
    
    func loadAll() async {
        isLoading = true
        error = nil
        
        async let accountsTask = accountRepository.getAll()
        async let transactionsTask = transactionRepository.getAll(filter: TransactionFilter(limit: 10))
        async let budgetsTask = budgetRepository.getAll()
        async let expensesTask = analyticsRepository.getCategoryExpenses(dateFrom: nil, dateTo: nil)
        
        do {
            accounts = try await accountsTask
            let transactionsResponse = try await transactionsTask
            recentTransactions = transactionsResponse.data
            budgets = try await budgetsTask
            categoryExpenses = try await expensesTask
            
            totalBalance = accounts.reduce(0) { $0 + $1.currentBalance }
            
            let income = recentTransactions.filter { $0.isIncome }.reduce(0) { $0 + $1.amount }
            let expenses = recentTransactions.filter { !$0.isIncome }.reduce(0) { $0 + $1.amount }
            totalIncome = income
            totalExpenses = expenses
        } catch {
            showError(error.localizedDescription)
        }
        
        isLoading = false
    }
    
    func refresh() async {
        await loadAll()
    }
    
    private func showError(_ message: String) {
        error = message
        errorBannerMessage = message
        showErrorBanner = true
        
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.error)
    }
}
