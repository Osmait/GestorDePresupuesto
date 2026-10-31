import Foundation
import Combine

// TODO: DashboardViewModel is a God Object — consider splitting by feature area
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
    @Published var creditCardDebt: Double = 0
    @Published var brokerCashTotal: Double = 0
    @Published var loansReceivableTotal: Double = 0
    @Published var accountsCount = 0
    /// The backend's net worth (it subtracts card debt and adds broker cash
    /// and loans receivable); nil on an older backend.
    @Published var netWorth: Double?
    @Published var monthlyPlanSummary: MonthlyPlanSummary?
    @Published var nextBill: MonthlyPlanItem?

    var patrimonyTotal: Double {
        netWorth ?? totalBalance + investmentsTotal + certificatesTotal
    }

    private let accountRepository: AccountRepository
    private let transactionRepository: TransactionRepository
    private let budgetRepository: BudgetRepository
    private let analyticsRepository: AnalyticsRepository
    private let monthlyPlanRepository: MonthlyPlanRepository?

    init(
        accountRepository: AccountRepository? = nil,
        transactionRepository: TransactionRepository? = nil,
        budgetRepository: BudgetRepository? = nil,
        analyticsRepository: AnalyticsRepository? = nil,
        monthlyPlanRepository: MonthlyPlanRepository? = nil
    ) {
        let container = DependencyContainer.shared
        self.accountRepository = accountRepository ?? container.resolve(AccountRepository.self)
        self.transactionRepository = transactionRepository ?? container.resolve(TransactionRepository.self)
        self.budgetRepository = budgetRepository ?? container.resolve(BudgetRepository.self)
        self.analyticsRepository = analyticsRepository ?? container.resolve(AnalyticsRepository.self)
        self.monthlyPlanRepository = monthlyPlanRepository ?? container.resolveOptional(MonthlyPlanRepository.self)
    }

    func loadAll() async {
        isLoading = true
        defer { isLoading = false }
        error = nil

        // Try dashboard summary first, fall back to individual calls
        async let summaryTask = loadDashboardSummary()
        async let transactionsTask = transactionRepository.getAll(filter: TransactionFilter(limit: 10))
        async let budgetsTask = budgetRepository.getAll()
        async let planTask: Void = loadMonthlyPlan()

        do {
            await summaryTask
            await planTask
            let transactionsResponse = try await transactionsTask
            recentTransactions = transactionsResponse.data
            budgets = try await budgetsTask
        } catch {
            showError(error.localizedDescription)
        }
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
            creditCardDebt = summary.creditCardDebt ?? 0
            brokerCashTotal = summary.brokerCashTotal ?? 0
            loansReceivableTotal = summary.loansReceivableTotal ?? 0
            netWorth = summary.netWorth
            accountsCount = summary.accountsCount
            categoryExpenses = summary.categoryExpenses
            monthlySummary = summary.monthlySummary

            accounts = try await accountRepository.getAll()
        } catch {
            // Fallback to individual calls
            await loadFallback()
        }
    }

    /// The plan card is optional: a failure here leaves it hidden instead of
    /// failing the whole dashboard.
    private func loadMonthlyPlan() async {
        guard let monthlyPlanRepository else { return }
        async let summaryTask = monthlyPlanRepository.getSummary()
        async let itemsTask = monthlyPlanRepository.getAll()
        guard let summary = try? await summaryTask, let items = try? await itemsTask else { return }
        monthlyPlanSummary = summary.totalIncome > 0 || summary.totalExpenses > 0 ? summary : nil
        nextBill = items.nextBill(from: Date())
    }

    private func loadFallback() async {
        do {
            accounts = try await accountRepository.getAll()
            categoryExpenses = try await analyticsRepository.getCategoryExpenses(dateFrom: nil, dateTo: nil)
            let bankAccounts = accounts.bankAccounts
            totalBalance = bankAccounts.reduce(0) { $0 + $1.currentBalance }
            accountsCount = bankAccounts.count
        } catch {
            showError(error.localizedDescription)
        }
    }

    func refresh() async {
        await loadAll()
    }
}
