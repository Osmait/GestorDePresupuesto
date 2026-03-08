import Foundation
import Combine

@MainActor
class DashboardViewModel: BaseViewModel {
    @Published var accounts: [AccountResponse] = []
    @Published var recentTransactions: [Transaction] = []
    @Published var budgets: [BudgetResponse] = []
    @Published var categoryExpenses: [CategoryExpense] = []
    @Published var monthlySummary: [MonthlySummary] = []
    @Published var totalBalance: Double = 0
    @Published var totalIncome: Double = 0
    @Published var totalExpenses: Double = 0
    @Published var savingsRate: Double = 0
    @Published var investmentsTotal: Double = 0
    @Published var certificatesTotal: Double = 0

    var patrimonyTotal: Double {
        totalBalance + investmentsTotal + certificatesTotal
    }

    private let accountRepository: AccountRepository
    private let transactionRepository: TransactionRepository
    private let budgetRepository: BudgetRepository
    private let analyticsRepository: AnalyticsRepository

    init(
        accountRepository: AccountRepository? = nil,
        transactionRepository: TransactionRepository? = nil,
        budgetRepository: BudgetRepository? = nil,
        analyticsRepository: AnalyticsRepository? = nil
    ) {
        let container = DependencyContainer.shared
        self.accountRepository = accountRepository ?? container.resolve(AccountRepository.self)
        self.transactionRepository = transactionRepository ?? container.resolve(TransactionRepository.self)
        self.budgetRepository = budgetRepository ?? container.resolve(BudgetRepository.self)
        self.analyticsRepository = analyticsRepository ?? container.resolve(AnalyticsRepository.self)
    }

    func loadAll() async {
        isLoading = true
        error = nil

        // Try dashboard summary first, fall back to individual calls
        async let summaryTask = loadDashboardSummary()
        async let transactionsTask = transactionRepository.getAll(filter: TransactionFilter(limit: 10))
        async let budgetsTask = budgetRepository.getAll()

        do {
            await summaryTask
            let transactionsResponse = try await transactionsTask
            recentTransactions = transactionsResponse.data
            budgets = try await budgetsTask
        } catch {
            showError(error.localizedDescription)
        }

        isLoading = false
    }

    private func loadDashboardSummary() async {
        do {
            let summary = try await analyticsRepository.getDashboardSummary()
            totalIncome = summary.totalIncome
            totalExpenses = summary.totalExpenses
            totalBalance = summary.accountsTotal
            savingsRate = summary.totalIncome > 0
                ? ((summary.totalIncome - abs(summary.totalExpenses)) / summary.totalIncome) * 100
                : 0
            investmentsTotal = summary.investmentsTotal
            certificatesTotal = summary.certificatesTotal
            categoryExpenses = summary.categoryExpenses
            monthlySummary = summary.monthlySummary

            accounts = try await accountRepository.getAll()
        } catch {
            // Fallback to individual calls
            await loadFallback()
        }
    }

    private func loadFallback() async {
        do {
            accounts = try await accountRepository.getAll()
            categoryExpenses = try await analyticsRepository.getCategoryExpenses(dateFrom: nil, dateTo: nil)
            totalBalance = accounts.reduce(0) { $0 + $1.currentBalance }
        } catch {
            showError(error.localizedDescription)
        }
    }

    func refresh() async {
        await loadAll()
    }
}
