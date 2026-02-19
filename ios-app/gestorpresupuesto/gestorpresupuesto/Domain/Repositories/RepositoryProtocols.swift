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

protocol TransactionRepository {
    func getAll(filter: TransactionFilter?) async throws -> PaginatedTransactionResponse
    func getByAccount(_ accountId: String) async throws -> [Transaction]
    func create(_ request: CreateTransactionRequest) async throws -> Transaction
    func update(_ id: String, request: UpdateTransactionRequest) async throws -> Transaction
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
}

protocol RecurringTransactionRepository {
    func getAll() async throws -> [RecurringTransaction]
    func create(_ request: CreateRecurringTransactionRequest) async throws -> RecurringTransaction
    func update(_ id: String, request: UpdateRecurringTransactionRequest) async throws -> RecurringTransaction
    func delete(_ id: String) async throws
}

protocol AIRepository {
    func extractTransactions(request: ExtractTransactionsRequest) async throws -> ExtractTransactionsResponse
    func analyzeSpending(request: AnalyzeSpendingRequest) async throws -> SpendingAnalysisResponse
}
