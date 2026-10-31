import Foundation
import Testing
@testable import gestorpresupuesto

/// End-to-end checks of the app's real networking (APIClient, repositories,
/// Codable models and view models) against a running backend.
///
/// Opt-in: they create data, so they only run with `LIVE_API=1`
/// (`TEST_RUNNER_LIVE_API=1 xcodebuild test ...`). Point the app at a
/// throwaway database. The base URL comes from `API_BASE_URL` (Local.xcconfig).
/// AI endpoints that call the LLM provider are not covered here.
@Suite(
    "Live API",
    .serialized,
    .enabled(if: ProcessInfo.processInfo.environment["LIVE_API"] == "1")
)
@MainActor
struct LiveAPITests {

    // MARK: - Session

    /// One user per test run, registered on first use.
    private enum Session {
        static let email = "ios-qa-\(UUID().uuidString.prefix(8).lowercased())@example.com"
        // Generated per run: no credential in the source.
        static let password = "Qa-\(UUID().uuidString.prefix(12))-9z!"
        static var loggedIn = false
    }

    private func login() async throws {
        let auth = AuthRepositoryImpl()
        if !Session.loggedIn {
            try await auth.register(name: "QA", lastName: "iOS", email: Session.email, password: Session.password)
            Session.loggedIn = true
        }
        _ = try await auth.login(email: Session.email, password: Session.password)
    }

    private func makeAccount(name: String = "Cuenta QA", balance: Double = 100_000) async throws -> AccountResponse {
        let repo = AccountRepositoryImpl()
        try await repo.create(CreateAccountRequest(name: name, bank: "Banco QA", initialBalance: balance))
        let account = try await repo.getAll().last { $0.accountInfo.name == name }
        return try #require(account)
    }

    private func makeCategory(name: String = "Categoría QA") async throws -> gestorpresupuesto.Category {
        let repo = CategoryRepositoryImpl()
        if let existing = try await repo.getAll().first(where: { $0.name == name }) { return existing }
        try await repo.create(CreateCategoryRequest(name: name, icon: "cart", color: "#2A78D6"))
        return try #require(try await repo.getAll().first { $0.name == name })
    }

    // MARK: - Auth

    @Test func auth_registerLoginProfileAndFlags() async throws {
        try await login()

        let profile = try await AuthRepositoryImpl().getProfile()
        #expect(profile.email == Session.email)

        let flags = FeatureFlagManager.shared
        await flags.fetchFlags()
        #expect(flags.isEnabled("module_credit_cards"))
        #expect(flags.isEnabled("module_loans"))
    }

    // MARK: - Accounts, categories, transactions

    @Test func accounts_crud() async throws {
        try await login()
        let repo = AccountRepositoryImpl()

        let account = try await makeAccount(name: "Cuenta CRUD", balance: 5_000)
        #expect(account.currentBalance == 5_000)

        let byId = try await repo.getById(account.id)
        #expect(byId.id == account.id)

        try await repo.update(account.id, request: UpdateAccountRequest(name: "Cuenta CRUD 2", bank: "Banco QA", initialBalance: 5_000))
        #expect(try await repo.getById(account.id).accountInfo.name == "Cuenta CRUD 2")

        try await repo.delete(account.id)
        #expect(!(try await repo.getAll().contains { $0.id == account.id }))
    }

    @Test func categories_crud() async throws {
        try await login()
        let repo = CategoryRepositoryImpl()

        try await repo.create(CreateCategoryRequest(name: "Cat CRUD", icon: "tag", color: "#EB6834"))
        let category = try #require(try await repo.getAll().first { $0.name == "Cat CRUD" })
        try await repo.update(category.id, request: UpdateCategoryRequest(name: "Cat CRUD 2", icon: "tag", color: "#EB6834"))
        #expect(try await repo.getAll().contains { $0.name == "Cat CRUD 2" })

        try await repo.delete(category.id)
        #expect(!(try await repo.getAll().contains { $0.id == category.id }))
    }

    @Test func transactions_crudFilterAndBalance() async throws {
        try await login()
        let account = try await makeAccount(name: "Cuenta Tx", balance: 10_000)
        let category = try await makeCategory()
        let repo = TransactionRepositoryImpl()

        try await repo.create(CreateTransactionRequest(
            name: "Supermercado QA", description: nil, amount: 1_250.50, typeTransaction: "bill",
            accountId: account.id, categoryId: category.id, budgetId: nil, currency: "DOP", createdAt: nil
        ))
        try await repo.create(CreateTransactionRequest(
            name: "Nómina QA", description: "quincena", amount: 3_000, typeTransaction: "income",
            accountId: account.id, categoryId: category.id, budgetId: nil, currency: "DOP", createdAt: nil
        ))

        let byAccount = try await repo.getByAccount(account.id)
        #expect(byAccount.data.count == 2)

        let bills = try await repo.getAll(filter: TransactionFilter(type: "bill", accountId: account.id))
        #expect(bills.data.map(\.name) == ["Supermercado QA"])

        let balance = try await AccountRepositoryImpl().getById(account.id).currentBalance
        #expect(abs(balance - (10_000 - 1_250.50 + 3_000)) < 0.001)

        let bill = try #require(bills.data.first)
        try await repo.update(bill.id, request: UpdateTransactionRequest(
            name: "Supermercado QA 2", description: nil, amount: 1_000, typeTransaction: "bill",
            accountId: account.id, categoryId: category.id, budgetId: nil, currency: "DOP"
        ))
        try await repo.delete(bill.id)
        #expect(try await repo.getByAccount(account.id).data.count == 1)

        // The Movimientos tab loads through its view model.
        let vm = TransactionsViewModel()
        await vm.loadTransactions()
        #expect(vm.error == nil)
        #expect(!vm.transactions.isEmpty)
    }

    // MARK: - Budgets, recurring, monthly plan

    @Test func budgets_crud() async throws {
        try await login()
        let category = try await makeCategory(name: "Cat Budget")
        let repo = BudgetRepositoryImpl()

        try await repo.create(CreateBudgetRequest(categoryId: category.id, amount: 8_000))
        let budget = try #require(try await repo.getAll().first { $0.categoryId == category.id })
        #expect(budget.displayName == "Cat Budget", "name filled in from the categories")

        try await repo.update(budget.id, request: UpdateBudgetRequest(categoryId: category.id, amount: 9_000))
        #expect(try await repo.getAll().first { $0.id == budget.id }?.amount == 9_000)

        try await repo.delete(budget.id)
    }

    @Test func recurringTransactions_crud() async throws {
        try await login()
        let account = try await makeAccount(name: "Cuenta Rec")
        let category = try await makeCategory()
        let repo = RecurringTransactionRepositoryImpl()

        try await repo.create(CreateRecurringTransactionRequest(
            name: "Netflix QA", description: nil, amount: 900, type: "bill",
            accountId: account.id, categoryId: category.id, budgetId: nil, dayOfMonth: 15
        ))
        let item = try #require(try await repo.getAll().first { $0.name == "Netflix QA" })
        try await repo.update(item.id, request: UpdateRecurringTransactionRequest(
            name: "Netflix QA", description: nil, amount: 950, type: "bill",
            accountId: account.id, categoryId: category.id, budgetId: nil, dayOfMonth: 16
        ))
        #expect(try await repo.getAll().first { $0.id == item.id }?.dayOfMonth == 16)
        try await repo.delete(item.id)
    }

    @Test func monthlyPlan_fullFlowThroughViewModel() async throws {
        try await login()
        let category = try await makeCategory(name: "Vivienda QA")
        let vm = MonthlyPlanViewModel()

        try await vm.save(MonthlyPlanItemRequest(
            name: "Nómina", description: "", amount: 50_000, currency: "DOP", type: .income,
            categoryId: nil, accountId: nil, dayOfMonth: 15, isActive: true
        ), editing: nil)
        try await vm.save(MonthlyPlanItemRequest(
            name: "Alquiler", description: "", amount: 20_000, currency: "DOP", type: .bill,
            categoryId: category.id, accountId: nil, dayOfMonth: 30, isActive: true
        ), editing: nil)
        try await vm.save(MonthlyPlanItemRequest(
            name: "Netflix", description: "", amount: 10, currency: "USD", type: .bill,
            categoryId: nil, accountId: nil, dayOfMonth: 5, isActive: true
        ), editing: nil)

        #expect(vm.error == nil)
        #expect(vm.items.count == 3)
        let summary = try #require(vm.summary)
        #expect(summary.totalIncome == 50_000)
        #expect(summary.incomeCount == 1)
        #expect(summary.expensesCount == 2)
        let netflix = try #require(vm.items.first { $0.name == "Netflix" })
        #expect(netflix.amountDop > netflix.amount, "USD converted to DOP by the backend")
        #expect(vm.groups.contains { $0.title == "Vivienda QA" })

        let rent = try #require(vm.items.first { $0.name == "Alquiler" })
        try await vm.save(MonthlyPlanItemRequest(
            name: "Alquiler", description: "Apto", amount: 22_000, currency: "DOP", type: .bill,
            categoryId: category.id, accountId: nil, dayOfMonth: 30, isActive: true
        ), editing: rent.id)
        #expect(vm.items.first { $0.id == rent.id }?.amount == 22_000)

        await vm.toggleActive(try #require(vm.items.first { $0.id == rent.id }))
        #expect(vm.items.first { $0.id == rent.id }?.isActive == false)
        #expect(vm.summary?.expensesCount == 1, "paused items stop counting")

        await vm.delete(netflix)
        #expect(vm.error == nil)
        #expect(vm.items.count == 2)
    }

    // MARK: - Dashboard and analytics

    @Test func dashboard_and_analytics_load() async throws {
        try await login()
        _ = try await makeAccount(name: "Cuenta Dash")

        let dashboard = DashboardViewModel()
        await dashboard.loadAll()
        #expect(dashboard.error == nil)
        #expect(!dashboard.accounts.isEmpty)

        let analytics = AnalyticsRepositoryImpl()
        _ = try await analytics.getDashboardSummary(dateFrom: nil, dateTo: nil)
        _ = try await analytics.getMonthlySummary()
        _ = try await analytics.getCategoryExpenses(dateFrom: nil, dateTo: nil)

        let vm = AnalyticsViewModel()
        await vm.loadAnalytics()
        #expect(vm.error == nil)
    }

    @Test func search_and_exchangeRate() async throws {
        try await login()
        _ = try await makeAccount(name: "Cuenta Buscable")

        _ = try await SearchRepositoryImpl().search(query: "Buscable")
        let rate = try await ExchangeRateRepositoryImpl().getRate()
        #expect(rate.usdToDop > 0)
    }

    // MARK: - Modules

    @Test func creditCards_createPayAndSummary() async throws {
        try await login()
        let account = try await makeAccount(name: "Cuenta Pago Tarjeta")
        let repo = CreditCardRepositoryImpl()

        let card = try await repo.create(CreateCreditCardRequest(
            name: "Visa QA", bank: "Banco QA", lastFourDigits: "4242", cutDay: 20, dueDay: 10,
            balances: [CreateBalanceRequest(currency: "DOP", creditLimit: 50_000, initialDebt: 5_000)]
        ))
        _ = try await repo.getById(card.id)
        _ = try await repo.update(card.id, request: UpdateCreditCardRequest(name: "Visa QA 2", bank: nil, lastFourDigits: nil, cutDay: nil, dueDay: nil))

        _ = try await repo.createPayment(cardId: card.id, request: CreateCardPaymentRequest(
            fromAccountId: account.id, currency: "DOP", amount: 2_000, exchangeRate: nil,
            includesInterest: nil, interestAmount: nil, notes: nil
        ))
        #expect(try await repo.getPayments(cardId: card.id).count == 1)
        _ = try await repo.getSummary()

        try await repo.delete(card.id)
    }

    @Test func loans_createPayAndSummary() async throws {
        try await login()
        let account = try await makeAccount(name: "Cuenta Préstamo")
        let repo = LoanRepositoryImpl()

        let loan = try await repo.create(CreateLoanRequest(
            borrowerName: "Juan QA", borrowerContact: nil, principalAmount: 10_000, currency: "DOP",
            interestMode: "none", annualRate: 0, termMonths: 5, startDate: nil,
            sourceAccountId: account.id, notes: nil
        ))
        _ = try await repo.registerPayment(id: loan.id, request: RegisterLoanPaymentRequest(
            destinationAccountId: account.id, amount: 2_000, paymentDate: nil, notes: nil
        ))
        let details = try await repo.getById(loan.id)
        #expect(details.loan.id == loan.id)
        _ = try await repo.getAll()
        _ = try await repo.getSummary()
    }

    @Test func certificates_createSimulateAndSummary() async throws {
        try await login()
        let repo = CertificateRepositoryImpl()

        try await repo.create(CreateCertificateRequest(
            bank: "Banco QA", baseCapital: 100_000, interestType: "compound", currentInterestRate: 8,
            currentTaxRate: 10, cutDay: 15, reinvestInterest: true, payoutAccountId: nil,
            maturityDate: nil, currency: "DOP"
        ))
        let certificate = try #require(try await repo.getAll().first { $0.bank == "Banco QA" })
        _ = try await repo.getById(certificate.id)
        _ = try await repo.simulate(id: certificate.id, request: SimulatePaymentRequest(capital: nil, rate: nil, taxRate: nil, months: 12))
        try await repo.update(certificate.id, request: UpdateCertificateRequest(
            bank: nil, baseCapital: nil, currentInterestRate: 9, currentTaxRate: nil, cutDay: nil,
            reinvestInterest: nil, payoutAccountId: nil, status: nil
        ))
        _ = try await repo.getSummary()
        try await repo.delete(certificate.id)
    }

    @Test func investments_crudAndFunding() async throws {
        try await login()
        let account = try await makeAccount(name: "Cuenta Broker")
        let repo = InvestmentRepositoryImpl()

        try await repo.fundBroker(FundBrokerRequest(
            sourceAccountId: account.id, sourceAmount: 63_000, targetCurrency: "USD",
            exchangeRate: 63, feeAmount: nil, notes: nil
        ))
        _ = try await repo.getFundingBalances()

        try await repo.create(CreateInvestmentRequest(
            name: "Apple", symbol: "AAPL", type: "stock", quantity: 2, purchasePrice: 150,
            currentPrice: 160, settlementCurrency: "USD"
        ))
        let investment = try #require(try await repo.getAll().first { $0.symbol == "AAPL" })
        _ = try await repo.update(investment.id, request: UpdateInvestmentRequest(
            name: nil, symbol: nil, type: nil, quantity: nil, purchasePrice: nil, currentPrice: 170, settlementCurrency: nil
        ))
        #expect(try await repo.getAll().contains { $0.id == investment.id })
        try await repo.delete(investment.id)
    }

    // MARK: - Assistant (no LLM calls) and notifications

    @Test func savingsGoals_crud() async throws {
        try await login()
        let repo = AIRepositoryImpl()

        let goal = try await repo.createSavingsGoal(request: AICreateSavingsGoalRequest(
            name: "Viaje QA", targetAmount: 50_000, targetDate: nil, accountId: nil, currentSaved: 5_000
        )).data
        _ = try await repo.updateSavingsGoal(id: goal.id, request: AIUpdateSavingsGoalRequest(
            name: nil, targetAmount: nil, targetDate: nil, accountId: nil, currentSaved: 10_000, status: nil
        ))
        _ = try await repo.getSavingsGoalProgress(id: goal.id)
        #expect(try await repo.getSavingsGoals().contains { $0.id == goal.id })
        try await repo.deleteSavingsGoal(id: goal.id)
    }

    @Test func notifications_history() async throws {
        try await login()
        let repo = NotificationRepositoryImpl()

        try await repo.sendTest()
        _ = try await repo.getHistory()
        try await repo.markAllAsRead()
        try await repo.deleteAll()
    }

    // MARK: - Logout (last)

    @Test func zz_logout() async throws {
        try await login()
        try await AuthRepositoryImpl().logout()
    }
}
