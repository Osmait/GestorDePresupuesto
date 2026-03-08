import Foundation

enum TransactionType: String, Codable, CaseIterable {
    case income = "income"
    case expense = "expense"
    case bill = "bill"
    case cardPayment = "card_payment"
    case loanDisbursement = "loan_disbursement"
    case loanCollection = "loan_collection"
    case investmentPurchase = "investment_purchase"
    case investmentFunding = "investment_funding"

    var displayName: String {
        switch self {
        case .income: return "Ingreso"
        case .expense: return "Gasto"
        case .bill: return "Factura"
        case .cardPayment: return "Pago tarjeta"
        case .loanDisbursement: return "Desembolso préstamo"
        case .loanCollection: return "Cobro préstamo"
        case .investmentPurchase: return "Compra inversión"
        case .investmentFunding: return "Fondeo inversión"
        }
    }
}

struct Transaction: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let description: String?
    let amount: Double
    let typeTransaction: String
    let accountId: String
    let categoryId: String
    let budgetId: String?
    let currency: String?
    let userId: String?
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case description
        case amount
        case typeTransaction = "type_transation"
        case accountId = "account_id"
        case categoryId = "category_id"
        case budgetId = "budget_id"
        case currency
        case userId = "user_id"
        case createdAt = "created_at"
    }
    
    var transactionType: TransactionType? {
        TransactionType(rawValue: typeTransaction)
    }
    
    var isIncome: Bool {
        typeTransaction == "income"
    }
}

struct CreateTransactionRequest: Codable {
    let name: String
    let description: String?
    let amount: Double
    let typeTransaction: String
    let accountId: String
    let categoryId: String
    let budgetId: String?
    let currency: String?
    let createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case name
        case description
        case amount
        case typeTransaction = "type_transation"
        case accountId = "account_id"
        case categoryId = "category_id"
        case budgetId = "budget_id"
        case currency
        case createdAt = "created_at"
    }
}

struct UpdateTransactionRequest: Codable {
    let name: String
    let description: String?
    let amount: Double
    let typeTransaction: String
    let accountId: String
    let categoryId: String
    let budgetId: String?
    let currency: String?

    enum CodingKeys: String, CodingKey {
        case name
        case description
        case amount
        case typeTransaction = "type_transation"
        case accountId = "account_id"
        case categoryId = "category_id"
        case budgetId = "budget_id"
        case currency
    }
}

struct TransactionFilter: Codable {
    var page: Int = 1
    var limit: Int = 20
    var sortBy: String = "created_at"
    var sortOrder: String = "desc"
    var type: String?
    var categoryId: String?
    var categories: [String]?
    var accountId: String?
    var budgetId: String?
    var dateFrom: String?
    var dateTo: String?
    var period: String?
    var amountMin: Double?
    var amountMax: Double?
    var search: String?
    
    enum CodingKeys: String, CodingKey {
        case page
        case limit
        case sortBy = "sort_by"
        case sortOrder = "sort_order"
        case type
        case categoryId = "category_id"
        case categories
        case accountId = "account_id"
        case budgetId = "budget_id"
        case dateFrom = "date_from"
        case dateTo = "date_to"
        case period
        case amountMin = "amount_min"
        case amountMax = "amount_max"
        case search
    }
    
    func toQueryItems() -> [URLQueryItem] {
        var items: [URLQueryItem] = [
            URLQueryItem(name: "page", value: "\(page)"),
            URLQueryItem(name: "limit", value: "\(limit)"),
            URLQueryItem(name: "sort_by", value: sortBy),
            URLQueryItem(name: "sort_order", value: sortOrder)
        ]
        
        if let type = type { items.append(URLQueryItem(name: "type", value: type)) }
        if let categoryId = categoryId { items.append(URLQueryItem(name: "category_id", value: categoryId)) }
        if let categories = categories, !categories.isEmpty {
            categories.forEach { items.append(URLQueryItem(name: "categories", value: $0)) }
        }
        if let accountId = accountId { items.append(URLQueryItem(name: "account_id", value: accountId)) }
        if let budgetId = budgetId { items.append(URLQueryItem(name: "budget_id", value: budgetId)) }
        if let dateFrom = dateFrom { items.append(URLQueryItem(name: "date_from", value: dateFrom)) }
        if let dateTo = dateTo { items.append(URLQueryItem(name: "date_to", value: dateTo)) }
        if let period = period { items.append(URLQueryItem(name: "period", value: period)) }
        if let amountMin = amountMin { items.append(URLQueryItem(name: "amount_min", value: "\(amountMin)")) }
        if let amountMax = amountMax { items.append(URLQueryItem(name: "amount_max", value: "\(amountMax)")) }
        if let search = search, !search.isEmpty { items.append(URLQueryItem(name: "search", value: search)) }
        
        return items
    }
}

struct PaginatedTransactionResponse: Codable {
    let data: [Transaction]
    let pagination: PaginationMeta

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.data = try container.decodeIfPresent([Transaction].self, forKey: .data) ?? []
        self.pagination = try container.decode(PaginationMeta.self, forKey: .pagination)
    }
}

struct PaginationMeta: Codable {
    let currentPage: Int
    let perPage: Int
    let totalPages: Int
    let totalRecords: Int
    let hasNextPage: Bool
    let hasPrevPage: Bool
    let nextPage: Int?
    let prevPage: Int?
    
    enum CodingKeys: String, CodingKey {
        case currentPage = "current_page"
        case perPage = "per_page"
        case totalPages = "total_pages"
        case totalRecords = "total_records"
        case hasNextPage = "has_next_page"
        case hasPrevPage = "has_prev_page"
        case nextPage = "next_page"
        case prevPage = "prev_page"
    }
}

struct TransactionSummary: Codable {
    let totalIncome: Double
    let totalExpenses: Double
    let netAmount: Double
    let incomeDOP: Double?
    let incomeUSD: Double?
    let expensesDOP: Double?
    let expensesUSD: Double?
    let usdToDopRate: Double?
    let incomeCount: Int
    let expenseCount: Int
    let averageIncome: Double
    let averageExpense: Double
    let largestIncome: Double
    let largestExpense: Double
    let filteredRecords: Int?
    let categoryBreakdown: [String: CategorySummaryItem]?

    enum CodingKeys: String, CodingKey {
        case totalIncome = "total_income"
        case totalExpenses = "total_expenses"
        case netAmount = "net_amount"
        case incomeDOP = "income_dop"
        case incomeUSD = "income_usd"
        case expensesDOP = "expenses_dop"
        case expensesUSD = "expenses_usd"
        case usdToDopRate = "usd_to_dop_rate"
        case incomeCount = "income_count"
        case expenseCount = "expense_count"
        case averageIncome = "average_income"
        case averageExpense = "average_expense"
        case largestIncome = "largest_income"
        case largestExpense = "largest_expense"
        case filteredRecords = "filtered_records"
        case categoryBreakdown = "category_breakdown"
    }
}

struct CategorySummaryItem: Codable {
    let categoryId: String
    let totalAmount: Double
    let count: Int
    let averageAmount: Double

    enum CodingKeys: String, CodingKey {
        case categoryId = "category_id"
        case totalAmount = "total_amount"
        case count
        case averageAmount = "average_amount"
    }
}
