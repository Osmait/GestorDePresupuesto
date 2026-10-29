import Foundation

class AuthRepositoryImpl: AuthRepository {
    private let apiClient: APIClient
    private let tokenStorage: TokenStorage

    init(apiClient: APIClient = .shared, tokenStorage: TokenStorage = KeychainTokenStorage()) {
        self.apiClient = apiClient
        self.tokenStorage = tokenStorage
    }

    func login(email: String, password: String) async throws -> User {
        let endpoint = Endpoints.login()
        let body = LoginRequest(email: email, password: password)

        let response: LoginResponse = try await apiClient.request(
            Endpoint(path: endpoint.path, method: endpoint.method, body: try JSONEncoder().encode(body))
        )

        try tokenStorage.saveTokens(
            accessToken: response.accessToken,
            refreshToken: response.refreshToken
        )

        let user = try await apiClient.request(Endpoints.profile()) as User

        UserDefaultsStorage.shared.userId = user.id
        UserDefaultsStorage.shared.userName = user.fullName
        UserDefaultsStorage.shared.userEmail = user.email

        return user
    }

    func register(name: String, lastName: String, email: String, password: String) async throws {
        let endpoint = Endpoints.register()
        let body = RegisterRequest(name: name, lastName: lastName, email: email, password: password)

        try await apiClient.requestVoid(
            Endpoint(path: endpoint.path, method: endpoint.method, body: try JSONEncoder().encode(body))
        )
    }

    func logout() async throws {
        // Local tokens go away even if the server call fails (offline, expired).
        defer { Task { await apiClient.logout() } }
        guard let refreshToken = tokenStorage.getRefreshToken() else { return }
        let endpoint = Endpoints.logout()
        try await apiClient.requestVoid(
            Endpoint(
                path: endpoint.path,
                method: endpoint.method,
                body: try JSONEncoder().encode(RefreshTokenRequest(refreshToken: refreshToken))
            )
        )
    }

    func getProfile() async throws -> User {
        try await apiClient.request(Endpoints.profile())
    }
}

class AccountRepositoryImpl: AccountRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func getAll() async throws -> [AccountResponse] {
        try await apiClient.request(Endpoints.accounts())
    }

    func getById(_ id: String) async throws -> AccountResponse {
        try await apiClient.request(Endpoints.account(id: id))
    }

    func create(_ request: CreateAccountRequest) async throws {
        try await apiClient.requestVoid(
            Endpoint(path: "/account", method: .POST, body: try JSONEncoder().encode(request))
        )
    }

    func update(_ id: String, request: UpdateAccountRequest) async throws {
        try await apiClient.requestVoid(
            Endpoint(path: "/account/\(id)", method: .PUT, body: try JSONEncoder().encode(request))
        )
    }

    func delete(_ id: String) async throws {
        try await apiClient.requestVoid(Endpoints.deleteAccount(id: id))
    }
}

class TransactionRepositoryImpl: TransactionRepository {
    private let apiClient: APIClient
    private let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func getAll(filter: TransactionFilter?) async throws -> PaginatedTransactionResponse {
        try await apiClient.request(Endpoints.transactions(filter: filter))
    }

    func getByAccount(_ accountId: String) async throws -> PaginatedTransactionResponse {
        try await apiClient.request(Endpoints.transactionsByAccount(id: accountId))
    }

    func create(_ request: CreateTransactionRequest) async throws {
        try await apiClient.requestVoid(
            Endpoint(path: "/transaction", method: .POST, body: try? encoder.encode(request))
        )
    }

    func update(_ id: String, request: UpdateTransactionRequest) async throws {
        try await apiClient.requestVoid(
            Endpoint(path: "/transaction/\(id)", method: .PUT, body: try? encoder.encode(request))
        )
    }

    func delete(_ id: String) async throws {
        try await apiClient.requestVoid(Endpoints.deleteTransaction(id: id))
    }
}

class CategoryRepositoryImpl: CategoryRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func getAll() async throws -> [Category] {
        try await apiClient.request(Endpoints.categories())
    }

    func create(_ request: CreateCategoryRequest) async throws {
        try await apiClient.requestVoid(
            Endpoint(path: "/category", method: .POST, body: try JSONEncoder().encode(request))
        )
    }

    func update(_ id: String, request: UpdateCategoryRequest) async throws {
        try await apiClient.requestVoid(
            Endpoint(path: "/category/\(id)", method: .PUT, body: try JSONEncoder().encode(request))
        )
    }

    func delete(_ id: String) async throws {
        try await apiClient.requestVoid(Endpoints.deleteCategory(id: id))
    }
}

class BudgetRepositoryImpl: BudgetRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func getAll() async throws -> [BudgetResponse] {
        async let budgetsTask: [BudgetResponse] = apiClient.request(Endpoints.budgets())
        async let categoriesTask: [Category] = apiClient.request(Endpoints.categories())
        let budgets = try await budgetsTask
        // Names are cosmetic: without categories the budgets still load.
        guard let categories = try? await categoriesTask else { return budgets }
        let names = Dictionary(categories.map { ($0.id, $0.name) }, uniquingKeysWith: { first, _ in first })
        return budgets.map { $0.withCategoryName(names[$0.categoryId]) }
    }

    func create(_ request: CreateBudgetRequest) async throws {
        try await apiClient.requestVoid(
            Endpoint(path: "/budget", method: .POST, body: try JSONEncoder().encode(request))
        )
    }

    func update(_ id: String, request: UpdateBudgetRequest) async throws {
        try await apiClient.requestVoid(
            Endpoint(path: "/budget/\(id)", method: .PUT, body: try JSONEncoder().encode(request))
        )
    }

    func delete(_ id: String) async throws {
        try await apiClient.requestVoid(Endpoints.deleteBudget(id: id))
    }
}

class MonthlyPlanRepositoryImpl: MonthlyPlanRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func getAll() async throws -> [MonthlyPlanItem] {
        try await apiClient.request(Endpoints.monthlyPlan())
    }

    func getSummary() async throws -> MonthlyPlanSummary {
        try await apiClient.request(Endpoints.monthlyPlanSummary())
    }

    func create(_ request: MonthlyPlanItemRequest) async throws {
        try await apiClient.requestVoid(
            Endpoints.createMonthlyPlanItem(body: try JSONEncoder().encode(request))
        )
    }

    func update(_ id: String, request: MonthlyPlanItemRequest) async throws {
        try await apiClient.requestVoid(
            Endpoints.updateMonthlyPlanItem(id: id, body: try JSONEncoder().encode(request))
        )
    }

    func setActive(_ id: String, isActive: Bool) async throws {
        try await apiClient.requestVoid(
            Endpoints.setMonthlyPlanItemActive(
                id: id,
                body: try JSONEncoder().encode(MonthlyPlanToggleRequest(isActive: isActive))
            )
        )
    }

    func delete(_ id: String) async throws {
        try await apiClient.requestVoid(Endpoints.deleteMonthlyPlanItem(id: id))
    }
}

class AnalyticsRepositoryImpl: AnalyticsRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func getCategoryExpenses(dateFrom: String?, dateTo: String?) async throws -> [CategoryExpense] {
        try await apiClient.request(Endpoints.categoryExpenses(dateFrom: dateFrom, dateTo: dateTo))
    }

    func getMonthlySummary() async throws -> [MonthlySummary] {
        try await apiClient.request(Endpoints.monthlySummary())
    }

    func getDashboardSummary() async throws -> DashboardSummary {
        try await apiClient.request(Endpoints.dashboardSummary())
    }
}

class RecurringTransactionRepositoryImpl: RecurringTransactionRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func getAll() async throws -> [RecurringTransaction] {
        try await apiClient.request(Endpoints.recurringTransactions())
    }

    func create(_ request: CreateRecurringTransactionRequest) async throws {
        try await apiClient.requestVoid(
            Endpoint(path: "/recurring-transactions", method: .POST, body: try JSONEncoder().encode(request))
        )
    }

    func update(_ id: String, request: UpdateRecurringTransactionRequest) async throws {
        try await apiClient.requestVoid(
            Endpoint(path: "/recurring-transactions/\(id)", method: .PUT, body: try JSONEncoder().encode(request))
        )
    }

    func delete(_ id: String) async throws {
        try await apiClient.requestVoid(Endpoints.deleteRecurringTransaction(id: id))
    }
}

class AIRepositoryImpl: AIRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func extractTransactions(request: ExtractTransactionsRequest) async throws -> ExtractTransactionsResponse {
        try await apiClient.request(
            Endpoint(path: "/ai/extract/transactions", method: .POST, body: try JSONEncoder().encode(request))
        )
    }

    func analyzeSpending(request: AnalyzeSpendingRequest) async throws -> SpendingAnalysisResponse {
        var items: [URLQueryItem] = [
            URLQueryItem(name: "date_from", value: request.dateFrom),
            URLQueryItem(name: "date_to", value: request.dateTo)
        ]
        if let language = request.language {
            items.append(URLQueryItem(name: "language", value: language))
        }
        return try await apiClient.request(
            Endpoint(path: "/ai/analyze/spending", method: .POST, queryItems: items)
        )
    }

    func suggestCategory(request: AISuggestCategoryRequest) async throws -> AISuggestCategoryResponse {
        try await apiClient.request(
            Endpoint(path: "/ai/suggest-category", method: .POST, body: try JSONEncoder().encode(request))
        )
    }

    func reconcilePreview(request: AIReconciliationPreviewRequest) async throws -> AIReconciliationPreviewResponse {
        try await apiClient.request(
            Endpoint(path: "/ai/reconcile/preview", method: .POST, body: try JSONEncoder().encode(request))
        )
    }

    func reconcileApply(sessionId: String, request: AIReconciliationApplyRequest) async throws -> AIReconciliationApplyResponse {
        try await apiClient.request(
            Endpoint(path: "/ai/reconcile/\(sessionId)/apply", method: .POST, body: try JSONEncoder().encode(request))
        )
    }

    func getSavingsGoals() async throws -> [AISavingsGoal] {
        let response: AISavingsGoalsListResponse = try await apiClient.request(Endpoints.savingsGoals())
        return response.data ?? []
    }

    func createSavingsGoal(request: AICreateSavingsGoalRequest) async throws -> AISavingsGoalResponse {
        try await apiClient.request(
            Endpoint(path: "/ai/goals", method: .POST, body: try JSONEncoder().encode(request))
        )
    }

    func updateSavingsGoal(id: String, request: AIUpdateSavingsGoalRequest) async throws -> AISavingsGoalResponse {
        try await apiClient.request(
            Endpoint(path: "/ai/goals/\(id)", method: .PATCH, body: try JSONEncoder().encode(request))
        )
    }

    func deleteSavingsGoal(id: String) async throws {
        try await apiClient.requestVoid(Endpoints.deleteSavingsGoal(id: id))
    }

    func getSavingsGoalProgress(id: String) async throws -> AISavingsGoalProgressResponse {
        try await apiClient.request(Endpoints.savingsGoalProgress(id: id))
    }

    func generateSavingsPlan(request: AISavingsPlanRequest) async throws -> AISavingsPlanResponse {
        try await apiClient.request(
            Endpoint(path: "/ai/goals/savings-plan", method: .POST, body: try JSONEncoder().encode(request))
        )
    }
}

// MARK: - Credit Card Repository

class CreditCardRepositoryImpl: CreditCardRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func getAll() async throws -> [CreditCard] {
        // The backend answers `null` instead of `[]` when there are none.
        let items: [CreditCard]? = try await apiClient.request(Endpoints.creditCards())
        return items ?? []
    }

    func getById(_ id: String) async throws -> CreditCard {
        try await apiClient.request(Endpoints.creditCard(id: id))
    }

    func create(_ request: CreateCreditCardRequest) async throws -> CreditCard {
        try await apiClient.request(
            Endpoint(path: "/credit-cards", method: .POST, body: try JSONEncoder().encode(request))
        )
    }

    func update(_ id: String, request: UpdateCreditCardRequest) async throws -> CreditCard {
        try await apiClient.request(
            Endpoint(path: "/credit-cards/\(id)", method: .PUT, body: try JSONEncoder().encode(request))
        )
    }

    func delete(_ id: String) async throws {
        try await apiClient.requestVoid(Endpoints.deleteCreditCard(id: id))
    }

    func getSummary() async throws -> CreditCardSummary {
        try await apiClient.request(Endpoints.creditCardSummary())
    }

    func getPayments(cardId: String) async throws -> [CardPayment] {
        // The backend answers `null` instead of `[]` when there are none.
        let items: [CardPayment]? = try await apiClient.request(Endpoints.creditCardPayments(cardId: cardId))
        return items ?? []
    }

    func createPayment(cardId: String, request: CreateCardPaymentRequest) async throws -> CardPayment {
        try await apiClient.request(
            Endpoint(path: "/credit-cards/\(cardId)/payments", method: .POST, body: try JSONEncoder().encode(request))
        )
    }
}

// MARK: - Loan Repository

class LoanRepositoryImpl: LoanRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func getAll() async throws -> [Loan] {
        try await apiClient.request(Endpoints.loans())
    }

    func getById(_ id: String) async throws -> LoanDetails {
        try await apiClient.request(Endpoints.loan(id: id))
    }

    func create(_ request: CreateLoanRequest) async throws -> Loan {
        try await apiClient.request(
            Endpoint(path: "/loan", method: .POST, body: try JSONEncoder().encode(request))
        )
    }

    func registerPayment(id: String, request: RegisterLoanPaymentRequest) async throws -> LoanPayment {
        try await apiClient.request(
            Endpoint(path: "/loan/\(id)/payments", method: .POST, body: try JSONEncoder().encode(request))
        )
    }

    func getSummary() async throws -> LoanSummary {
        try await apiClient.request(Endpoints.loanSummary())
    }
}

// MARK: - Certificate Repository

class CertificateRepositoryImpl: CertificateRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func getAll() async throws -> [Certificate] {
        // The backend answers `null` instead of `[]` when there are none.
        let items: [Certificate]? = try await apiClient.request(Endpoints.certificates())
        return items ?? []
    }

    func getById(_ id: String) async throws -> CertificateWithHistory {
        try await apiClient.request(Endpoints.certificate(id: id))
    }

    func create(_ request: CreateCertificateRequest) async throws {
        try await apiClient.requestVoid(
            Endpoint(path: "/certificate", method: .POST, body: try JSONEncoder().encode(request))
        )
    }

    func update(_ id: String, request: UpdateCertificateRequest) async throws {
        try await apiClient.requestVoid(
            Endpoint(path: "/certificate/\(id)", method: .PUT, body: try JSONEncoder().encode(request))
        )
    }

    func delete(_ id: String) async throws {
        try await apiClient.requestVoid(Endpoints.deleteCertificate(id: id))
    }

    func simulate(id: String, request: SimulatePaymentRequest) async throws -> SimulationResult {
        try await apiClient.request(
            Endpoint(path: "/certificate/\(id)/simulate", method: .POST, body: try JSONEncoder().encode(request))
        )
    }

    func getSummary() async throws -> CertificateSummary {
        try await apiClient.request(Endpoints.certificateSummary())
    }
}

// MARK: - Investment Repository

class InvestmentRepositoryImpl: InvestmentRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func getAll() async throws -> [Investment] {
        // The backend answers `null` instead of `[]` when there are none.
        let items: [Investment]? = try await apiClient.request(Endpoints.investments())
        return items ?? []
    }

    func getById(_ id: String) async throws -> Investment {
        try await apiClient.request(Endpoints.investment(id: id))
    }

    func create(_ request: CreateInvestmentRequest) async throws {
        try await apiClient.requestVoid(
            Endpoint(path: "/investments", method: .POST, body: try JSONEncoder().encode(request))
        )
    }

    func update(_ id: String, request: UpdateInvestmentRequest) async throws -> Investment {
        try await apiClient.request(
            Endpoint(path: "/investments/\(id)", method: .PUT, body: try JSONEncoder().encode(request))
        )
    }

    func delete(_ id: String) async throws {
        try await apiClient.requestVoid(Endpoints.deleteInvestment(id: id))
    }

    func fundBroker(_ request: FundBrokerRequest) async throws {
        try await apiClient.requestVoid(
            Endpoint(path: "/investments/funding", method: .POST, body: try JSONEncoder().encode(request))
        )
    }

    func getFundingBalances() async throws -> [FundingBalance] {
        try await apiClient.request(Endpoints.fundingBalances())
    }

    func getQuote(symbol: String) async throws -> QuoteResponse {
        try await apiClient.request(Endpoints.quote(symbol: symbol))
    }
}

// MARK: - Exchange Rate Repository

class ExchangeRateRepositoryImpl: ExchangeRateRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func getRate() async throws -> ExchangeRateResponse {
        try await apiClient.request(Endpoints.exchangeRate())
    }
}

// MARK: - Search Repository

class SearchRepositoryImpl: SearchRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func search(query: String) async throws -> SearchResponse {
        try await apiClient.request(Endpoints.search(query: query))
    }
}

// MARK: - Notification Repository

class NotificationRepositoryImpl: NotificationRepository {
    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }

    func getHistory() async throws -> [AppNotification] {
        let result: [AppNotification]? = try await apiClient.request(Endpoints.notificationHistory())
        return result ?? []
    }

    func markAsRead(_ id: String) async throws {
        try await apiClient.requestVoid(Endpoints.markNotificationRead(id: id))
    }

    func markAllAsRead() async throws {
        try await apiClient.requestVoid(Endpoints.markAllNotificationsRead())
    }

    func deleteAll() async throws {
        try await apiClient.requestVoid(Endpoints.deleteAllNotifications())
    }

    func sendTest() async throws {
        try await apiClient.requestVoid(Endpoints.testNotification())
    }
}
