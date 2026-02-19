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
    case GET = "GET"
    case POST = "POST"
    case PUT = "PUT"
    case DELETE = "DELETE"
    case PATCH = "PATCH"
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
    static let baseURL = "http://127.0.0.1:8080"
    
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
        Endpoint(path: "/account/\(id)", method: .GET)
    }
    
    static func updateAccount(id: String) -> Endpoint {
        Endpoint(path: "/account/\(id)", method: .PUT)
    }
    
    static func deleteAccount(id: String) -> Endpoint {
        Endpoint(path: "/account/\(id)", method: .DELETE)
    }
    
    // MARK: - Transactions
    static func transactions(filter: TransactionFilter? = nil) -> Endpoint {
        Endpoint(path: "/transaction", method: .GET, queryItems: filter?.toQueryItems())
    }
    
    static func createTransaction() -> Endpoint {
        Endpoint(path: "/transaction", method: .POST)
    }
    
    static func transactionsByAccount(id: String) -> Endpoint {
        Endpoint(path: "/transaction/\(id)", method: .GET)
    }
    
    static func updateTransaction(id: String) -> Endpoint {
        Endpoint(path: "/transaction/\(id)", method: .PUT)
    }
    
    static func deleteTransaction(id: String) -> Endpoint {
        Endpoint(path: "/transaction/\(id)", method: .DELETE)
    }
    
    // MARK: - Categories
    static func categories() -> Endpoint {
        Endpoint(path: "/category", method: .GET)
    }
    
    static func createCategory() -> Endpoint {
        Endpoint(path: "/category", method: .POST)
    }
    
    static func updateCategory(id: String) -> Endpoint {
        Endpoint(path: "/category/\(id)", method: .PUT)
    }
    
    static func deleteCategory(id: String) -> Endpoint {
        Endpoint(path: "/category/\(id)", method: .DELETE)
    }
    
    // MARK: - Budgets
    static func budgets() -> Endpoint {
        Endpoint(path: "/budget", method: .GET)
    }
    
    static func createBudget() -> Endpoint {
        Endpoint(path: "/budget", method: .POST)
    }
    
    static func updateBudget(id: String) -> Endpoint {
        Endpoint(path: "/budget/\(id)", method: .PUT)
    }
    
    static func deleteBudget(id: String) -> Endpoint {
        Endpoint(path: "/budget/\(id)", method: .DELETE)
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
        Endpoint(path: "/recurring-transactions/\(id)", method: .PUT)
    }
    
    static func deleteRecurringTransaction(id: String) -> Endpoint {
        Endpoint(path: "/recurring-transactions/\(id)", method: .DELETE)
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
}
