import Foundation

protocol AuthRepository {
    func login(email: String, password: String) async throws -> User
    func register(name: String, lastName: String, email: String, password: String) async throws -> User
    func logout() async throws
    func getProfile() async throws -> User
}

protocol AccountRepository {
    func getAll() async throws -> [AccountResponse]
    func getById(_ id: String) async throws -> AccountResponse
    func create(_ request: CreateAccountRequest) async throws -> Account
    func update(_ id: String, request: UpdateAccountRequest) async throws -> Account
    func delete(_ id: String) async throws
}

// NOTE: Only TransactionRepository supports pagination
protocol TransactionRepository {
    func getAll(filter: TransactionFilter?) async throws -> PaginatedTransactionResponse
    func getByAccount(_ accountId: String) async throws -> PaginatedTransactionResponse
    func create(_ request: CreateTransactionRequest) async throws
    func update(_ id: String, request: UpdateTransactionRequest) async throws
    func delete(_ id: String) async throws
}

protocol CategoryRepository {
    func getAll() async throws -> [Category]
    func create(_ request: CreateCategoryRequest) async throws -> Category
    func update(_ id: String, request: UpdateCategoryRequest) async throws -> Category
    func delete(_ id: String) async throws
}

protocol BudgetRepository {
    func getAll() async throws -> [BudgetResponse]
    func create(_ request: CreateBudgetRequest) async throws -> Budget
    func update(_ id: String, request: UpdateBudgetRequest) async throws -> Budget
    func delete(_ id: String) async throws
}

protocol AnalyticsRepository {
    func getCategoryExpenses(dateFrom: String?, dateTo: String?) async throws -> [CategoryExpense]
    func getMonthlySummary() async throws -> [MonthlySummary]
    func getDashboardSummary() async throws -> DashboardSummary
}

protocol RecurringTransactionRepository {
    func getAll() async throws -> [RecurringTransaction]
    func create(_ request: CreateRecurringTransactionRequest) async throws -> RecurringTransaction
    func update(_ id: String, request: UpdateRecurringTransactionRequest) async throws -> RecurringTransaction
    func delete(_ id: String) async throws
}

// TODO: AIRepository has 11 methods, 4 features — split into 4 protocols
protocol AIRepository {
    func extractTransactions(request: ExtractTransactionsRequest) async throws -> ExtractTransactionsResponse
    func analyzeSpending(request: AnalyzeSpendingRequest) async throws -> SpendingAnalysisResponse
    func suggestCategory(request: AISuggestCategoryRequest) async throws -> AISuggestCategoryResponse
    func reconcilePreview(request: AIReconciliationPreviewRequest) async throws -> AIReconciliationPreviewResponse
    func reconcileApply(sessionId: String, request: AIReconciliationApplyRequest) async throws -> AIReconciliationApplyResponse
    func getSavingsGoals() async throws -> [AISavingsGoal]
    func createSavingsGoal(request: AICreateSavingsGoalRequest) async throws -> AISavingsGoalResponse
    func updateSavingsGoal(id: String, request: AIUpdateSavingsGoalRequest) async throws -> AISavingsGoalResponse
    func deleteSavingsGoal(id: String) async throws
    func getSavingsGoalProgress(id: String) async throws -> AISavingsGoalProgressResponse
    func generateSavingsPlan(request: AISavingsPlanRequest) async throws -> AISavingsPlanResponse
}

protocol CreditCardRepository {
    func getAll() async throws -> [CreditCard]
    func getById(_ id: String) async throws -> CreditCard
    func create(_ request: CreateCreditCardRequest) async throws -> CreditCard
    func update(_ id: String, request: UpdateCreditCardRequest) async throws -> CreditCard
    func delete(_ id: String) async throws
    func getSummary() async throws -> CreditCardSummary
    func getPayments(cardId: String) async throws -> [CardPayment]
    func createPayment(cardId: String, request: CreateCardPaymentRequest) async throws -> CardPayment
}

protocol LoanRepository {
    func getAll() async throws -> [Loan]
    func getById(_ id: String) async throws -> LoanDetails
    func create(_ request: CreateLoanRequest) async throws -> Loan
    func registerPayment(id: String, request: RegisterLoanPaymentRequest) async throws -> LoanPayment
    func getSummary() async throws -> LoanSummary
}

protocol CertificateRepository {
    func getAll() async throws -> [Certificate]
    func getById(_ id: String) async throws -> CertificateWithHistory
    func create(_ request: CreateCertificateRequest) async throws -> Certificate
    func update(_ id: String, request: UpdateCertificateRequest) async throws -> Certificate
    func delete(_ id: String) async throws
    func simulate(id: String, request: SimulatePaymentRequest) async throws -> SimulationResult
    func getSummary() async throws -> CertificateSummary
}

protocol InvestmentRepository {
    func getAll() async throws -> [Investment]
    func getById(_ id: String) async throws -> Investment
    func create(_ request: CreateInvestmentRequest) async throws -> Investment
    func update(_ id: String, request: UpdateInvestmentRequest) async throws -> Investment
    func delete(_ id: String) async throws
    func fundBroker(_ request: FundBrokerRequest) async throws
    func getFundingBalances() async throws -> [FundingBalance]
    func getQuote(symbol: String) async throws -> QuoteResponse
}

protocol ExchangeRateRepository {
    func getRate() async throws -> ExchangeRateResponse
}

protocol SearchRepository {
    func search(query: String) async throws -> SearchResponse
}

protocol NotificationRepository {
    func getHistory() async throws -> [AppNotification]
    func markAsRead(_ id: String) async throws
    func markAllAsRead() async throws
    func deleteAll() async throws
    func sendTest() async throws
}
