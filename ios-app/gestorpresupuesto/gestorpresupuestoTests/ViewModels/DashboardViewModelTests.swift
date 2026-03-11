import Testing
@testable import gestorpresupuesto

@Suite("DashboardViewModel Tests")
struct DashboardViewModelTests {

    @MainActor private func makeSUT() -> (DashboardViewModel, MockAccountRepository, MockTransactionRepository, MockBudgetRepository, MockAnalyticsRepository) {
        let accRepo = MockAccountRepository()
        let txnRepo = MockTransactionRepository()
        let budRepo = MockBudgetRepository()
        let anaRepo = MockAnalyticsRepository()
        let vm = DashboardViewModel(
            accountRepository: accRepo,
            transactionRepository: txnRepo,
            budgetRepository: budRepo,
            analyticsRepository: anaRepo
        )
        return (vm, accRepo, txnRepo, budRepo, anaRepo)
    }

    @Test @MainActor func patrimonyTotal_sumsAllAssets() {
        let (vm, _, _, _, _) = makeSUT()
        vm.totalBalance = 100000
        vm.investmentsTotal = 50000
        vm.certificatesTotal = 30000

        #expect(vm.patrimonyTotal == 180000)
    }

    @Test @MainActor func patrimonyTotal_allZero() {
        let (vm, _, _, _, _) = makeSUT()
        #expect(vm.patrimonyTotal == 0)
    }

    @Test @MainActor func loadAll_withDashboardSummary_success() async {
        let (vm, accRepo, txnRepo, budRepo, anaRepo) = makeSUT()
        anaRepo.getDashboardSummaryResult = .success(DashboardSummary(
            totalIncome: 100000, totalExpenses: -50000, netAmount: 50000,
            usdToDopRate: 58.5, accountsTotal: 200000,
            investmentsTotal: 80000, certificatesTotal: 50000,
            accountsCount: 2, investmentsCount: 3, certificatesCount: 1,
            categoryExpenses: [], monthlySummary: []
        ))
        accRepo.getAllResult = .success([.fixture()])
        txnRepo.getAllResult = .success(.fixture(data: [.fixture()]))
        budRepo.getAllResult = .success([])

        await vm.loadAll()

        #expect(vm.totalIncome == 100000)
        #expect(vm.totalExpenses == -50000)
        #expect(vm.investmentsTotal == 80000)
        #expect(vm.certificatesTotal == 50000)
        #expect(!vm.isLoading)
    }

    @Test @MainActor func loadAll_fallbackWhenSummaryFails() async {
        let (vm, accRepo, txnRepo, budRepo, anaRepo) = makeSUT()
        anaRepo.getDashboardSummaryResult = .failure(MockError.forced)
        anaRepo.getCategoryExpensesResult = .success([])
        accRepo.getAllResult = .success([
            .fixture(account: .fixture(id: "a1"), currentBalance: 10000),
            .fixture(account: .fixture(id: "a2"), currentBalance: 20000),
        ])
        txnRepo.getAllResult = .success(.fixture())
        budRepo.getAllResult = .success([])

        await vm.loadAll()

        #expect(vm.totalBalance == 30000)
    }

    @Test @MainActor func savingsRate_calculatesCorrectly() async {
        let (vm, accRepo, txnRepo, budRepo, anaRepo) = makeSUT()
        anaRepo.getDashboardSummaryResult = .success(DashboardSummary(
            totalIncome: 100000, totalExpenses: -40000, netAmount: 60000,
            usdToDopRate: 58.5, accountsTotal: 200000,
            investmentsTotal: 0, certificatesTotal: 0,
            accountsCount: 1, investmentsCount: 0, certificatesCount: 0,
            categoryExpenses: [], monthlySummary: []
        ))
        accRepo.getAllResult = .success([])
        txnRepo.getAllResult = .success(.fixture())
        budRepo.getAllResult = .success([])

        await vm.loadAll()

        #expect(vm.savingsRate == 60.0)
    }

    @Test @MainActor func savingsRate_zeroIncome() async {
        let (vm, accRepo, txnRepo, budRepo, anaRepo) = makeSUT()
        anaRepo.getDashboardSummaryResult = .success(DashboardSummary(
            totalIncome: 0, totalExpenses: 0, netAmount: 0,
            usdToDopRate: 58.5, accountsTotal: 0,
            investmentsTotal: 0, certificatesTotal: 0,
            accountsCount: 0, investmentsCount: 0, certificatesCount: 0,
            categoryExpenses: [], monthlySummary: []
        ))
        accRepo.getAllResult = .success([])
        txnRepo.getAllResult = .success(.fixture())
        budRepo.getAllResult = .success([])

        await vm.loadAll()

        #expect(vm.savingsRate == 0)
    }

    @Test @MainActor func loadAll_populatesRecentTransactions() async {
        let (vm, accRepo, txnRepo, budRepo, anaRepo) = makeSUT()
        anaRepo.getDashboardSummaryResult = .success(DashboardSummary(
            totalIncome: 0, totalExpenses: 0, netAmount: 0,
            usdToDopRate: 58.5, accountsTotal: 0,
            investmentsTotal: 0, certificatesTotal: 0,
            accountsCount: 0, investmentsCount: 0, certificatesCount: 0,
            categoryExpenses: [], monthlySummary: []
        ))
        accRepo.getAllResult = .success([])
        txnRepo.getAllResult = .success(.fixture(data: [.fixture(), .fixture(id: "t2")]))
        budRepo.getAllResult = .success([.fixture()])

        await vm.loadAll()

        #expect(vm.recentTransactions.count == 2)
        #expect(vm.budgets.count == 1)
    }

    @Test @MainActor func loadAll_error_showsError() async {
        let (vm, accRepo, txnRepo, budRepo, anaRepo) = makeSUT()
        anaRepo.getDashboardSummaryResult = .failure(MockError.forced)
        anaRepo.getCategoryExpensesResult = .failure(MockError.forced)
        accRepo.getAllResult = .failure(MockError.forced)
        txnRepo.getAllResult = .failure(MockError.forced)
        budRepo.getAllResult = .failure(MockError.forced)

        await vm.loadAll()

        #expect(vm.error != nil)
    }
}
