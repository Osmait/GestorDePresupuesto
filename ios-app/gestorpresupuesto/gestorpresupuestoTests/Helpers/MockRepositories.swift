import Foundation
@testable import gestorpresupuesto

// MARK: - Mock Error

enum MockError: Error, LocalizedError {
    case forced
    var errorDescription: String? { "Forced error" }
}

// MARK: - MockAuthRepository

final class MockAuthRepository: AuthRepository {
    var loginResult: Result<User, Error> = .success(.fixture())
    var loginCallCount = 0
    var registerResult: Result<User, Error> = .success(.fixture())
    var logoutError: Error?
    var logoutCallCount = 0
    var getProfileResult: Result<User, Error> = .success(.fixture())

    func login(email: String, password: String) async throws -> User {
        loginCallCount += 1
        return try loginResult.get()
    }

    func register(name: String, lastName: String, email: String, password: String) async throws -> User {
        return try registerResult.get()
    }

    func logout() async throws {
        logoutCallCount += 1
        if let error = logoutError { throw error }
    }

    func getProfile() async throws -> User {
        return try getProfileResult.get()
    }
}

// MARK: - MockAccountRepository

final class MockAccountRepository: AccountRepository {
    var getAllResult: Result<[AccountResponse], Error> = .success([])
    var getAllCallCount = 0
    var getByIdResult: Result<AccountResponse, Error> = .success(.fixture())
    var createResult: Result<Account, Error> = .success(.fixture())
    var createCallCount = 0
    var updateResult: Result<Account, Error> = .success(.fixture())
    var deleteError: Error?
    var deleteCallCount = 0

    func getAll() async throws -> [AccountResponse] {
        getAllCallCount += 1
        return try getAllResult.get()
    }

    func getById(_ id: String) async throws -> AccountResponse {
        return try getByIdResult.get()
    }

    func create(_ request: CreateAccountRequest) async throws -> Account {
        createCallCount += 1
        return try createResult.get()
    }

    func update(_ id: String, request: UpdateAccountRequest) async throws -> Account {
        return try updateResult.get()
    }

    func delete(_ id: String) async throws {
        deleteCallCount += 1
        if let error = deleteError { throw error }
    }
}

// MARK: - MockTransactionRepository

final class MockTransactionRepository: TransactionRepository {
    var getAllResult: Result<PaginatedTransactionResponse, Error> = .success(
        .fixture()
    )
    var getAllCallCount = 0
    var lastFilter: TransactionFilter?
    var getByAccountResult: Result<PaginatedTransactionResponse, Error> = .success(.fixture())
    var createError: Error?
    var createCallCount = 0
    var updateError: Error?
    var deleteError: Error?
    var deleteCallCount = 0

    func getAll(filter: TransactionFilter?) async throws -> PaginatedTransactionResponse {
        getAllCallCount += 1
        lastFilter = filter
        return try getAllResult.get()
    }

    func getByAccount(_ accountId: String) async throws -> PaginatedTransactionResponse {
        return try getByAccountResult.get()
    }

    func create(_ request: CreateTransactionRequest) async throws {
        createCallCount += 1
        if let error = createError { throw error }
    }

    func update(_ id: String, request: UpdateTransactionRequest) async throws {
        if let error = updateError { throw error }
    }

    func delete(_ id: String) async throws {
        deleteCallCount += 1
        if let error = deleteError { throw error }
    }
}

// MARK: - MockCategoryRepository

final class MockCategoryRepository: CategoryRepository {
    var getAllResult: Result<[gestorpresupuesto.Category], Error> = .success([])
    var getAllCallCount = 0
    var createResult: Result<gestorpresupuesto.Category, Error> = .success(.fixture())
    var updateResult: Result<gestorpresupuesto.Category, Error> = .success(.fixture())
    var deleteError: Error?
    var deleteCallCount = 0

    func getAll() async throws -> [gestorpresupuesto.Category] {
        getAllCallCount += 1
        return try getAllResult.get()
    }

    func create(_ request: CreateCategoryRequest) async throws -> gestorpresupuesto.Category {
        return try createResult.get()
    }

    func update(_ id: String, request: UpdateCategoryRequest) async throws -> gestorpresupuesto.Category {
        return try updateResult.get()
    }

    func delete(_ id: String) async throws {
        deleteCallCount += 1
        if let error = deleteError { throw error }
    }
}

// MARK: - MockBudgetRepository

final class MockBudgetRepository: BudgetRepository {
    var getAllResult: Result<[BudgetResponse], Error> = .success([])
    var getAllCallCount = 0
    var createResult: Result<Budget, Error> = .success(.fixture())
    var updateResult: Result<Budget, Error> = .success(.fixture())
    var deleteError: Error?
    var deleteCallCount = 0

    func getAll() async throws -> [BudgetResponse] {
        getAllCallCount += 1
        return try getAllResult.get()
    }

    func create(_ request: CreateBudgetRequest) async throws -> Budget {
        return try createResult.get()
    }

    func update(_ id: String, request: UpdateBudgetRequest) async throws -> Budget {
        return try updateResult.get()
    }

    func delete(_ id: String) async throws {
        deleteCallCount += 1
        if let error = deleteError { throw error }
    }
}

// MARK: - MockAnalyticsRepository

final class MockAnalyticsRepository: AnalyticsRepository {
    var getCategoryExpensesResult: Result<[CategoryExpense], Error> = .success([])
    var getCategoryExpensesCallCount = 0
    var getMonthlySummaryResult: Result<[MonthlySummary], Error> = .success([])
    var getDashboardSummaryResult: Result<DashboardSummary, Error> = .failure(MockError.forced)

    func getCategoryExpenses(dateFrom: String?, dateTo: String?) async throws -> [CategoryExpense] {
        getCategoryExpensesCallCount += 1
        return try getCategoryExpensesResult.get()
    }

    func getMonthlySummary() async throws -> [MonthlySummary] {
        return try getMonthlySummaryResult.get()
    }

    func getDashboardSummary() async throws -> DashboardSummary {
        return try getDashboardSummaryResult.get()
    }
}

// MARK: - MockRecurringTransactionRepository

final class MockRecurringTransactionRepository: RecurringTransactionRepository {
    var getAllResult: Result<[RecurringTransaction], Error> = .success([])
    var getAllCallCount = 0
    var createResult: Result<RecurringTransaction, Error> = .success(.fixture())
    var updateResult: Result<RecurringTransaction, Error> = .success(.fixture())
    var deleteError: Error?
    var deleteCallCount = 0

    func getAll() async throws -> [RecurringTransaction] {
        getAllCallCount += 1
        return try getAllResult.get()
    }

    func create(_ request: CreateRecurringTransactionRequest) async throws -> RecurringTransaction {
        return try createResult.get()
    }

    func update(_ id: String, request: UpdateRecurringTransactionRequest) async throws -> RecurringTransaction {
        return try updateResult.get()
    }

    func delete(_ id: String) async throws {
        deleteCallCount += 1
        if let error = deleteError { throw error }
    }
}

// MARK: - MockAIRepository

final class MockAIRepository: AIRepository {
    var extractResult: Result<ExtractTransactionsResponse, Error> = .failure(MockError.forced)
    var analyzeResult: Result<SpendingAnalysisResponse, Error> = .failure(MockError.forced)
    var suggestCategoryResult: Result<AISuggestCategoryResponse, Error> = .failure(MockError.forced)
    var reconcilePreviewResult: Result<AIReconciliationPreviewResponse, Error> = .failure(MockError.forced)
    var reconcileApplyResult: Result<AIReconciliationApplyResponse, Error> = .failure(MockError.forced)
    var getSavingsGoalsResult: Result<[AISavingsGoal], Error> = .success([])
    var createSavingsGoalResult: Result<AISavingsGoalResponse, Error> = .failure(MockError.forced)
    var updateSavingsGoalResult: Result<AISavingsGoalResponse, Error> = .failure(MockError.forced)
    var deleteSavingsGoalError: Error?
    var getSavingsGoalProgressResult: Result<AISavingsGoalProgressResponse, Error> = .failure(MockError.forced)
    var generateSavingsPlanResult: Result<AISavingsPlanResponse, Error> = .failure(MockError.forced)

    func extractTransactions(request: ExtractTransactionsRequest) async throws -> ExtractTransactionsResponse {
        return try extractResult.get()
    }

    func analyzeSpending(request: AnalyzeSpendingRequest) async throws -> SpendingAnalysisResponse {
        return try analyzeResult.get()
    }

    func suggestCategory(request: AISuggestCategoryRequest) async throws -> AISuggestCategoryResponse {
        return try suggestCategoryResult.get()
    }

    func reconcilePreview(request: AIReconciliationPreviewRequest) async throws -> AIReconciliationPreviewResponse {
        return try reconcilePreviewResult.get()
    }

    func reconcileApply(sessionId: String, request: AIReconciliationApplyRequest) async throws -> AIReconciliationApplyResponse {
        return try reconcileApplyResult.get()
    }

    func getSavingsGoals() async throws -> [AISavingsGoal] {
        return try getSavingsGoalsResult.get()
    }

    func createSavingsGoal(request: AICreateSavingsGoalRequest) async throws -> AISavingsGoalResponse {
        return try createSavingsGoalResult.get()
    }

    func updateSavingsGoal(id: String, request: AIUpdateSavingsGoalRequest) async throws -> AISavingsGoalResponse {
        return try updateSavingsGoalResult.get()
    }

    func deleteSavingsGoal(id: String) async throws {
        if let error = deleteSavingsGoalError { throw error }
    }

    func getSavingsGoalProgress(id: String) async throws -> AISavingsGoalProgressResponse {
        return try getSavingsGoalProgressResult.get()
    }

    func generateSavingsPlan(request: AISavingsPlanRequest) async throws -> AISavingsPlanResponse {
        return try generateSavingsPlanResult.get()
    }
}

// MARK: - MockCreditCardRepository

final class MockCreditCardRepository: CreditCardRepository {
    var getAllResult: Result<[CreditCard], Error> = .success([])
    var getAllCallCount = 0
    var getByIdResult: Result<CreditCard, Error> = .failure(MockError.forced)
    var createResult: Result<CreditCard, Error> = .success(.fixture())
    var updateResult: Result<CreditCard, Error> = .success(.fixture())
    var deleteError: Error?
    var deleteCallCount = 0
    var getSummaryResult: Result<CreditCardSummary, Error> = .success(.fixture())
    var getPaymentsResult: Result<[CardPayment], Error> = .success([])
    var createPaymentResult: Result<CardPayment, Error> = .success(.fixture())

    func getAll() async throws -> [CreditCard] {
        getAllCallCount += 1
        return try getAllResult.get()
    }

    func getById(_ id: String) async throws -> CreditCard {
        return try getByIdResult.get()
    }

    func create(_ request: CreateCreditCardRequest) async throws -> CreditCard {
        return try createResult.get()
    }

    func update(_ id: String, request: UpdateCreditCardRequest) async throws -> CreditCard {
        return try updateResult.get()
    }

    func delete(_ id: String) async throws {
        deleteCallCount += 1
        if let error = deleteError { throw error }
    }

    func getSummary() async throws -> CreditCardSummary {
        return try getSummaryResult.get()
    }

    func getPayments(cardId: String) async throws -> [CardPayment] {
        return try getPaymentsResult.get()
    }

    func createPayment(cardId: String, request: CreateCardPaymentRequest) async throws -> CardPayment {
        return try createPaymentResult.get()
    }
}

// MARK: - MockLoanRepository

final class MockLoanRepository: LoanRepository {
    var getAllResult: Result<[Loan], Error> = .success([])
    var getAllCallCount = 0
    var getByIdResult: Result<LoanDetails, Error> = .failure(MockError.forced)
    var createResult: Result<Loan, Error> = .success(.fixture())
    var registerPaymentResult: Result<LoanPayment, Error> = .success(.fixture())
    var getSummaryResult: Result<LoanSummary, Error> = .success(.fixture())

    func getAll() async throws -> [Loan] {
        getAllCallCount += 1
        return try getAllResult.get()
    }

    func getById(_ id: String) async throws -> LoanDetails {
        return try getByIdResult.get()
    }

    func create(_ request: CreateLoanRequest) async throws -> Loan {
        return try createResult.get()
    }

    func registerPayment(id: String, request: RegisterLoanPaymentRequest) async throws -> LoanPayment {
        return try registerPaymentResult.get()
    }

    func getSummary() async throws -> LoanSummary {
        return try getSummaryResult.get()
    }
}

// MARK: - MockCertificateRepository

final class MockCertificateRepository: CertificateRepository {
    var getAllResult: Result<[Certificate], Error> = .success([])
    var getAllCallCount = 0
    var getByIdResult: Result<CertificateWithHistory, Error> = .failure(MockError.forced)
    var createResult: Result<Certificate, Error> = .success(.fixture())
    var updateResult: Result<Certificate, Error> = .success(.fixture())
    var deleteError: Error?
    var deleteCallCount = 0
    var simulateResult: Result<SimulationResult, Error> = .failure(MockError.forced)
    var getSummaryResult: Result<CertificateSummary, Error> = .success(.fixture())

    func getAll() async throws -> [Certificate] {
        getAllCallCount += 1
        return try getAllResult.get()
    }

    func getById(_ id: String) async throws -> CertificateWithHistory {
        return try getByIdResult.get()
    }

    func create(_ request: CreateCertificateRequest) async throws -> Certificate {
        return try createResult.get()
    }

    func update(_ id: String, request: UpdateCertificateRequest) async throws -> Certificate {
        return try updateResult.get()
    }

    func delete(_ id: String) async throws {
        deleteCallCount += 1
        if let error = deleteError { throw error }
    }

    func simulate(id: String, request: SimulatePaymentRequest) async throws -> SimulationResult {
        return try simulateResult.get()
    }

    func getSummary() async throws -> CertificateSummary {
        return try getSummaryResult.get()
    }
}

// MARK: - MockInvestmentRepository

final class MockInvestmentRepository: InvestmentRepository {
    var getAllResult: Result<[Investment], Error> = .success([])
    var getAllCallCount = 0
    var getByIdResult: Result<Investment, Error> = .failure(MockError.forced)
    var createResult: Result<Investment, Error> = .success(.fixture())
    var updateResult: Result<Investment, Error> = .success(.fixture())
    var deleteError: Error?
    var deleteCallCount = 0
    var fundBrokerError: Error?
    var getFundingBalancesResult: Result<[FundingBalance], Error> = .success([])
    var getQuoteResult: Result<QuoteResponse, Error> = .failure(MockError.forced)

    func getAll() async throws -> [Investment] {
        getAllCallCount += 1
        return try getAllResult.get()
    }

    func getById(_ id: String) async throws -> Investment {
        return try getByIdResult.get()
    }

    func create(_ request: CreateInvestmentRequest) async throws -> Investment {
        return try createResult.get()
    }

    func update(_ id: String, request: UpdateInvestmentRequest) async throws -> Investment {
        return try updateResult.get()
    }

    func delete(_ id: String) async throws {
        deleteCallCount += 1
        if let error = deleteError { throw error }
    }

    func fundBroker(_ request: FundBrokerRequest) async throws {
        if let error = fundBrokerError { throw error }
    }

    func getFundingBalances() async throws -> [FundingBalance] {
        return try getFundingBalancesResult.get()
    }

    func getQuote(symbol: String) async throws -> QuoteResponse {
        return try getQuoteResult.get()
    }
}

// MARK: - MockExchangeRateRepository

final class MockExchangeRateRepository: ExchangeRateRepository {
    var getRateResult: Result<ExchangeRateResponse, Error> = .success(
        ExchangeRateResponse(usdToDop: 58.5, lastUpdated: "2026-01-01")
    )

    func getRate() async throws -> ExchangeRateResponse {
        return try getRateResult.get()
    }
}

// MARK: - MockSearchRepository

final class MockSearchRepository: SearchRepository {
    var searchResult: Result<SearchResponse, Error> = .failure(MockError.forced)

    func search(query: String) async throws -> SearchResponse {
        return try searchResult.get()
    }
}

// MARK: - MockNotificationRepository

final class MockNotificationRepository: NotificationRepository {
    var getHistoryResult: Result<[AppNotification], Error> = .success([])
    var markAsReadError: Error?
    var markAllAsReadError: Error?
    var deleteAllError: Error?
    var sendTestError: Error?

    func getHistory() async throws -> [AppNotification] {
        return try getHistoryResult.get()
    }

    func markAsRead(_ id: String) async throws {
        if let error = markAsReadError { throw error }
    }

    func markAllAsRead() async throws {
        if let error = markAllAsReadError { throw error }
    }

    func deleteAll() async throws {
        if let error = deleteAllError { throw error }
    }

    func sendTest() async throws {
        if let error = sendTestError { throw error }
    }
}
