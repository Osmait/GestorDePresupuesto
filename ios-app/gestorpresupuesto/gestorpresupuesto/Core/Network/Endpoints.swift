import Foundation

enum APIError: Error, LocalizedError {
    case invalidURL
    case noData
    case decodingError(Error)
    case serverError(Int, String?)
    case unauthorized
    case networkError(Error)
    case unknown

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "URL inválida"
        case .noData:
            return "Sin datos"
        case .decodingError(let error):
            return "Error de decodificación: \(error.localizedDescription)"
        case .serverError(let code, let message):
            return "Error del servidor (\(code)): \(message ?? "Error desconocido")"
        case .unauthorized:
            return "No autorizado"
        case .networkError(let error):
            return "Error de red: \(error.localizedDescription)"
        case .unknown:
            return "Error desconocido"
        }
    }
}

enum HTTPMethod: String {
    case GET
    case POST
    case PUT
    case DELETE
    case PATCH
}

struct Endpoint {
    let path: String
    let method: HTTPMethod
    let headers: [String: String]?
    let queryItems: [URLQueryItem]?
    let body: Data?

    init(
        path: String,
        method: HTTPMethod = .GET,
        headers: [String: String]? = nil,
        queryItems: [URLQueryItem]? = nil,
        body: Data? = nil
    ) {
        self.path = path
        self.method = method
        self.headers = headers
        self.queryItems = queryItems
        self.body = body
    }

    func asURLRequest(baseURL: String) -> URLRequest? {
        guard var urlComponents = URLComponents(string: baseURL + path) else { return nil }

        if let queryItems = queryItems, !queryItems.isEmpty {
            urlComponents.queryItems = queryItems
        }

        guard let url = urlComponents.url else { return nil }

        var request = URLRequest(url: url)
        request.httpMethod = method.rawValue
        request.httpBody = body
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")

        headers?.forEach { key, value in
            request.addValue(value, forHTTPHeaderField: key)
        }

        return request
    }
}

struct Endpoints {
    static var baseURL: String { AppConfiguration.current.baseURL }

    private static func encode(_ id: String) -> String {
        id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
    }

    // MARK: - Auth
    static func login() -> Endpoint {
        Endpoint(path: "/auth/login", method: .POST)
    }

    static func register() -> Endpoint {
        Endpoint(path: "/user", method: .POST)
    }

    static func refreshToken() -> Endpoint {
        Endpoint(path: "/auth/refresh", method: .POST)
    }

    static func logout() -> Endpoint {
        Endpoint(path: "/auth/logout", method: .POST)
    }

    static func profile() -> Endpoint {
        Endpoint(path: "/profile", method: .GET)
    }

    // MARK: - Accounts
    static func accounts() -> Endpoint {
        Endpoint(path: "/account", method: .GET)
    }

    static func createAccount() -> Endpoint {
        Endpoint(path: "/account", method: .POST)
    }

    static func account(id: String) -> Endpoint {
        Endpoint(path: "/account/\(encode(id))", method: .GET)
    }

    static func updateAccount(id: String) -> Endpoint {
        Endpoint(path: "/account/\(encode(id))", method: .PUT)
    }

    static func deleteAccount(id: String) -> Endpoint {
        Endpoint(path: "/account/\(encode(id))", method: .DELETE)
    }

    // MARK: - Transactions
    static func transactions(filter: TransactionFilter? = nil) -> Endpoint {
        Endpoint(path: "/transaction", method: .GET, queryItems: filter?.toQueryItems())
    }

    static func createTransaction() -> Endpoint {
        Endpoint(path: "/transaction", method: .POST)
    }

    static func transactionsByAccount(id: String) -> Endpoint {
        Endpoint(path: "/transaction/\(encode(id))", method: .GET)
    }

    static func updateTransaction(id: String) -> Endpoint {
        Endpoint(path: "/transaction/\(encode(id))", method: .PUT)
    }

    static func deleteTransaction(id: String) -> Endpoint {
        Endpoint(path: "/transaction/\(encode(id))", method: .DELETE)
    }

    // MARK: - Categories
    static func categories() -> Endpoint {
        Endpoint(path: "/category", method: .GET)
    }

    static func createCategory() -> Endpoint {
        Endpoint(path: "/category", method: .POST)
    }

    static func updateCategory(id: String) -> Endpoint {
        Endpoint(path: "/category/\(encode(id))", method: .PUT)
    }

    static func deleteCategory(id: String) -> Endpoint {
        Endpoint(path: "/category/\(encode(id))", method: .DELETE)
    }

    // MARK: - Budgets
    static func budgets() -> Endpoint {
        Endpoint(path: "/budget", method: .GET)
    }

    static func createBudget() -> Endpoint {
        Endpoint(path: "/budget", method: .POST)
    }

    static func updateBudget(id: String) -> Endpoint {
        Endpoint(path: "/budget/\(encode(id))", method: .PUT)
    }

    static func deleteBudget(id: String) -> Endpoint {
        Endpoint(path: "/budget/\(encode(id))", method: .DELETE)
    }

    // MARK: - Analytics
    static func categoryExpenses(dateFrom: String? = nil, dateTo: String? = nil) -> Endpoint {
        var items: [URLQueryItem] = []
        if let dateFrom = dateFrom {
            items.append(URLQueryItem(name: "date_from", value: dateFrom))
        }
        if let dateTo = dateTo {
            items.append(URLQueryItem(name: "date_to", value: dateTo))
        }
        return Endpoint(path: "/analytics/category-expenses", method: .GET, queryItems: items.isEmpty ? nil : items)
    }

    static func monthlySummary() -> Endpoint {
        Endpoint(path: "/analytics/monthly-summary", method: .GET)
    }

    // MARK: - Recurring Transactions
    static func recurringTransactions() -> Endpoint {
        Endpoint(path: "/recurring-transactions", method: .GET)
    }

    static func createRecurringTransaction() -> Endpoint {
        Endpoint(path: "/recurring-transactions", method: .POST)
    }

    static func updateRecurringTransaction(id: String) -> Endpoint {
        Endpoint(path: "/recurring-transactions/\(encode(id))", method: .PUT)
    }

    static func deleteRecurringTransaction(id: String) -> Endpoint {
        Endpoint(path: "/recurring-transactions/\(encode(id))", method: .DELETE)
    }

    // MARK: - AI
    static func extractTransactions() -> Endpoint {
        Endpoint(path: "/ai/extract/transactions", method: .POST)
    }

    static func analyzeSpending(dateFrom: String, dateTo: String, language: String? = nil) -> Endpoint {
        var items: [URLQueryItem] = [
            URLQueryItem(name: "date_from", value: dateFrom),
            URLQueryItem(name: "date_to", value: dateTo)
        ]
        if let language = language {
            items.append(URLQueryItem(name: "language", value: language))
        }
        return Endpoint(path: "/ai/analyze/spending", method: .POST, queryItems: items)
    }

    static func suggestCategory() -> Endpoint {
        Endpoint(path: "/ai/suggest-category", method: .POST)
    }

    static func reconcilePreview() -> Endpoint {
        Endpoint(path: "/ai/reconcile/preview", method: .POST)
    }

    static func reconcileApply(sessionId: String) -> Endpoint {
        Endpoint(path: "/ai/reconcile/\(encode(sessionId))/apply", method: .POST)
    }

    static func savingsGoals() -> Endpoint {
        Endpoint(path: "/ai/goals", method: .GET)
    }

    static func createSavingsGoal() -> Endpoint {
        Endpoint(path: "/ai/goals", method: .POST)
    }

    static func updateSavingsGoal(id: String) -> Endpoint {
        Endpoint(path: "/ai/goals/\(encode(id))", method: .PATCH)
    }

    static func deleteSavingsGoal(id: String) -> Endpoint {
        Endpoint(path: "/ai/goals/\(encode(id))", method: .DELETE)
    }

    static func savingsGoalProgress(id: String) -> Endpoint {
        Endpoint(path: "/ai/goals/\(id)/progress", method: .GET)
    }

    static func savingsPlan() -> Endpoint {
        Endpoint(path: "/ai/goals/savings-plan", method: .POST)
    }

    // MARK: - Feature Flags
    static func features() -> Endpoint {
        Endpoint(path: "/me/features", method: .GET)
    }

    // MARK: - Exchange Rate
    static func exchangeRate() -> Endpoint {
        Endpoint(path: "/exchange/rate", method: .GET)
    }

    // MARK: - Credit Cards
    static func creditCards() -> Endpoint {
        Endpoint(path: "/credit-cards", method: .GET)
    }

    static func creditCard(id: String) -> Endpoint {
        Endpoint(path: "/credit-cards/\(encode(id))", method: .GET)
    }

    static func createCreditCard() -> Endpoint {
        Endpoint(path: "/credit-cards", method: .POST)
    }

    static func updateCreditCard(id: String) -> Endpoint {
        Endpoint(path: "/credit-cards/\(encode(id))", method: .PUT)
    }

    static func deleteCreditCard(id: String) -> Endpoint {
        Endpoint(path: "/credit-cards/\(encode(id))", method: .DELETE)
    }

    static func creditCardSummary() -> Endpoint {
        Endpoint(path: "/credit-cards/summary", method: .GET)
    }

    static func updateCardBalance(cardId: String, balanceId: String) -> Endpoint {
        Endpoint(path: "/credit-cards/\(encode(cardId))/balances/\(encode(balanceId))", method: .PUT)
    }

    static func creditCardPayments(cardId: String) -> Endpoint {
        Endpoint(path: "/credit-cards/\(encode(cardId))/payments", method: .GET)
    }

    static func createCreditCardPayment(cardId: String) -> Endpoint {
        Endpoint(path: "/credit-cards/\(encode(cardId))/payments", method: .POST)
    }

    // MARK: - Loans
    static func loans() -> Endpoint {
        Endpoint(path: "/loan", method: .GET)
    }

    static func loan(id: String) -> Endpoint {
        Endpoint(path: "/loan/\(encode(id))", method: .GET)
    }

    static func createLoan() -> Endpoint {
        Endpoint(path: "/loan", method: .POST)
    }

    static func registerLoanPayment(id: String) -> Endpoint {
        Endpoint(path: "/loan/\(id)/payments", method: .POST)
    }

    static func updateLoanStatus(id: String) -> Endpoint {
        Endpoint(path: "/loan/\(id)/status", method: .PATCH)
    }

    static func loanSummary() -> Endpoint {
        Endpoint(path: "/loan/summary", method: .GET)
    }

    // MARK: - Certificates
    static func certificates() -> Endpoint {
        Endpoint(path: "/certificate", method: .GET)
    }

    static func certificate(id: String) -> Endpoint {
        Endpoint(path: "/certificate/\(encode(id))", method: .GET)
    }

    static func createCertificate() -> Endpoint {
        Endpoint(path: "/certificate", method: .POST)
    }

    static func updateCertificate(id: String) -> Endpoint {
        Endpoint(path: "/certificate/\(encode(id))", method: .PUT)
    }

    static func deleteCertificate(id: String) -> Endpoint {
        Endpoint(path: "/certificate/\(encode(id))", method: .DELETE)
    }

    static func simulateCertificate(id: String) -> Endpoint {
        Endpoint(path: "/certificate/\(id)/simulate", method: .POST)
    }

    static func certificateSummary() -> Endpoint {
        Endpoint(path: "/certificate/summary", method: .GET)
    }

    // MARK: - Investments
    static func investments() -> Endpoint {
        Endpoint(path: "/investments", method: .GET)
    }

    static func investment(id: String) -> Endpoint {
        Endpoint(path: "/investments/\(encode(id))", method: .GET)
    }

    static func createInvestment() -> Endpoint {
        Endpoint(path: "/investments", method: .POST)
    }

    static func updateInvestment(id: String) -> Endpoint {
        Endpoint(path: "/investments/\(encode(id))", method: .PUT)
    }

    static func deleteInvestment(id: String) -> Endpoint {
        Endpoint(path: "/investments/\(encode(id))", method: .DELETE)
    }

    static func fundBroker() -> Endpoint {
        Endpoint(path: "/investments/funding", method: .POST)
    }

    static func fundingBalances() -> Endpoint {
        Endpoint(path: "/investments/funding/balances", method: .GET)
    }

    static func quote(symbol: String) -> Endpoint {
        Endpoint(path: "/quotes/\(encode(symbol))", method: .GET)
    }

    // MARK: - Dashboard Summary
    static func dashboardSummary() -> Endpoint {
        Endpoint(path: "/analytics/dashboard-summary", method: .GET)
    }

    // MARK: - Notifications
    static func notificationHistory() -> Endpoint {
        Endpoint(path: "/notifications/history", method: .GET)
    }

    static func markNotificationRead(id: String) -> Endpoint {
        Endpoint(path: "/notifications/\(encode(id))/read", method: .PATCH)
    }

    static func markAllNotificationsRead() -> Endpoint {
        Endpoint(path: "/notifications/read-all", method: .PATCH)
    }

    static func deleteAllNotifications() -> Endpoint {
        Endpoint(path: "/notifications", method: .DELETE)
    }

    static func testNotification() -> Endpoint {
        Endpoint(path: "/notifications/test", method: .POST)
    }

    // MARK: - Search
    static func search(query: String) -> Endpoint {
        Endpoint(path: "/search", method: .GET, queryItems: [URLQueryItem(name: "q", value: query)])
    }
}

// MARK: - APIError Equatable

extension APIError: Equatable {
    static func == (lhs: APIError, rhs: APIError) -> Bool {
        switch (lhs, rhs) {
        case (.invalidURL, .invalidURL): return true
        case (.noData, .noData): return true
        case (.decodingError, .decodingError): return true
        case (.serverError(let lCode, let lMsg), .serverError(let rCode, let rMsg)):
            return lCode == rCode && lMsg == rMsg
        case (.unauthorized, .unauthorized): return true
        case (.networkError, .networkError): return true
        case (.unknown, .unknown): return true
        default: return false
        }
    }
}

// MARK: - Endpoint Body Helper

extension Endpoint {
    func withBody(_ body: Data) -> Endpoint {
        Endpoint(path: path, method: method, headers: headers, queryItems: queryItems, body: body)
    }
}
