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
            Endpoint(path: endpoint.path, method: endpoint.method, body: try? JSONEncoder().encode(body))
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
    
    func register(name: String, lastName: String, email: String, password: String) async throws -> User {
        let endpoint = Endpoints.register()
        let body = RegisterRequest(name: name, lastName: lastName, email: email, password: password)
        
        let user: User = try await apiClient.request(
            Endpoint(path: endpoint.path, method: endpoint.method, body: try? JSONEncoder().encode(body))
        )
        
        return user
    }
    
    func logout() async throws {
        try await apiClient.requestVoid(Endpoints.logout())
        await apiClient.logout()
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
    
    func create(_ request: CreateAccountRequest) async throws -> Account {
        try await apiClient.request(
            Endpoint(path: "/account", method: .POST, body: try? JSONEncoder().encode(request))
        )
    }
    
    func update(_ id: String, request: UpdateAccountRequest) async throws -> Account {
        try await apiClient.request(
            Endpoint(path: "/account/\(id)", method: .PUT, body: try? JSONEncoder().encode(request))
        )
    }
    
    func delete(_ id: String) async throws {
        try await apiClient.requestVoid(Endpoints.deleteAccount(id: id))
    }
}

class TransactionRepositoryImpl: TransactionRepository {
    private let apiClient: APIClient
    
    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }
    
    func getAll(filter: TransactionFilter?) async throws -> PaginatedTransactionResponse {
        try await apiClient.request(Endpoints.transactions(filter: filter))
    }
    
    func getByAccount(_ accountId: String) async throws -> [Transaction] {
        try await apiClient.request(Endpoints.transactionsByAccount(id: accountId))
    }
    
    func create(_ request: CreateTransactionRequest) async throws -> Transaction {
        try await apiClient.request(
            Endpoint(path: "/transaction", method: .POST, body: try? JSONEncoder().encode(request))
        )
    }
    
    func update(_ id: String, request: UpdateTransactionRequest) async throws -> Transaction {
        try await apiClient.request(
            Endpoint(path: "/transaction/\(id)", method: .PUT, body: try? JSONEncoder().encode(request))
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
    
    func create(_ request: CreateCategoryRequest) async throws -> Category {
        try await apiClient.request(
            Endpoint(path: "/category", method: .POST, body: try? JSONEncoder().encode(request))
        )
    }
    
    func update(_ id: String, request: UpdateCategoryRequest) async throws -> Category {
        try await apiClient.request(
            Endpoint(path: "/category/\(id)", method: .PUT, body: try? JSONEncoder().encode(request))
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
        try await apiClient.request(Endpoints.budgets())
    }
    
    func create(_ request: CreateBudgetRequest) async throws -> Budget {
        try await apiClient.request(
            Endpoint(path: "/budget", method: .POST, body: try? JSONEncoder().encode(request))
        )
    }
    
    func update(_ id: String, request: UpdateBudgetRequest) async throws -> Budget {
        try await apiClient.request(
            Endpoint(path: "/budget/\(id)", method: .PUT, body: try? JSONEncoder().encode(request))
        )
    }
    
    func delete(_ id: String) async throws {
        try await apiClient.requestVoid(Endpoints.deleteBudget(id: id))
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
}

class RecurringTransactionRepositoryImpl: RecurringTransactionRepository {
    private let apiClient: APIClient
    
    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
    }
    
    func getAll() async throws -> [RecurringTransaction] {
        try await apiClient.request(Endpoints.recurringTransactions())
    }
    
    func create(_ request: CreateRecurringTransactionRequest) async throws -> RecurringTransaction {
        try await apiClient.request(
            Endpoint(path: "/recurring-transactions", method: .POST, body: try? JSONEncoder().encode(request))
        )
    }
    
    func update(_ id: String, request: UpdateRecurringTransactionRequest) async throws -> RecurringTransaction {
        try await apiClient.request(
            Endpoint(path: "/recurring-transactions/\(id)", method: .PUT, body: try? JSONEncoder().encode(request))
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
            Endpoint(path: "/ai/extract/transactions", method: .POST, body: try? JSONEncoder().encode(request))
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
}
