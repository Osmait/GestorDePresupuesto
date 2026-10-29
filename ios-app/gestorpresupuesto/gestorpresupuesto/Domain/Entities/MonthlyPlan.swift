import Foundation

/// A fixed expense ("bill") or expected income that repeats every month.
struct MonthlyPlanItem: Codable, Identifiable, Equatable {
    enum ItemType: String, Codable {
        case income
        case bill
    }

    let id: String
    let userId: String
    let name: String
    let description: String
    let amount: Double
    /// `amount` already converted to DOP by the backend.
    let amountDop: Double
    let currency: String
    let type: ItemType
    let categoryId: String?
    let accountId: String?
    let dayOfMonth: Int?
    let isActive: Bool
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case name
        case description
        case amount
        case amountDop = "amount_dop"
        case currency
        case type
        case categoryId = "category_id"
        case accountId = "account_id"
        case dayOfMonth = "day_of_month"
        case isActive = "is_active"
        case createdAt = "created_at"
    }

    var isIncome: Bool { type == .income }
}

extension Array where Element == MonthlyPlanItem {
    /// The next active fixed expense from `date`'s day on, wrapping to the
    /// first one of next month.
    func nextBill(from date: Date, calendar: Calendar = .current) -> MonthlyPlanItem? {
        let today = calendar.component(.day, from: date)
        let bills = filter { !$0.isIncome && $0.isActive && $0.dayOfMonth != nil }
            .sorted { ($0.dayOfMonth ?? 0, $0.name) < ($1.dayOfMonth ?? 0, $1.name) }
        return bills.first { ($0.dayOfMonth ?? 0) >= today } ?? bills.first
    }
}

/// Totals of the plan, all amounts in DOP. Computed by the backend.
struct MonthlyPlanSummary: Codable, Equatable {
    let totalIncome: Double
    let totalExpenses: Double
    /// Income minus expenses. Negative means the plan does not add up.
    let available: Double
    /// Share of the expected income already taken by fixed expenses (0–100+).
    let committedPercentage: Double
    let usdToDopRate: Double
    let incomeCount: Int
    let expensesCount: Int

    enum CodingKeys: String, CodingKey {
        case totalIncome = "total_income"
        case totalExpenses = "total_expenses"
        case available
        case committedPercentage = "committed_percentage"
        case usdToDopRate = "usd_to_dop_rate"
        case incomeCount = "income_count"
        case expensesCount = "expenses_count"
    }

    var isOvercommitted: Bool { available < 0 }
}

struct MonthlyPlanItemRequest: Codable, Equatable {
    let name: String
    let description: String
    let amount: Double
    let currency: String
    let type: MonthlyPlanItem.ItemType
    let categoryId: String?
    let accountId: String?
    let dayOfMonth: Int?
    let isActive: Bool?

    enum CodingKeys: String, CodingKey {
        case name
        case description
        case amount
        case currency
        case type
        case categoryId = "category_id"
        case accountId = "account_id"
        case dayOfMonth = "day_of_month"
        case isActive = "is_active"
    }
}

struct MonthlyPlanToggleRequest: Codable {
    let isActive: Bool

    enum CodingKeys: String, CodingKey {
        case isActive = "is_active"
    }
}
