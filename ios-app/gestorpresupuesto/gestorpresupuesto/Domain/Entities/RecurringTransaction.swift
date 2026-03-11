import Foundation

enum RecurringType: String, Codable, CaseIterable {
    case income = "income"
    case bill = "bill"

    var displayName: String {
        switch self {
        case .income: return "Ingreso recurrente"
        case .bill: return "Gasto recurrente"
        }
    }

    var icon: String {
        switch self {
        case .income: return "arrow.down.circle.fill"
        case .bill: return "arrow.up.circle.fill"
        }
    }

}

struct RecurringTransaction: Codable, Identifiable, Equatable {
    let id: String
    let userId: String?
    let name: String
    let description: String?
    let amount: Double
    let type: String
    let accountId: String
    let categoryId: String
    let budgetId: String?
    let dayOfMonth: Int
    let lastExecutionDate: Date?
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case name
        case description
        case amount
        case type
        case accountId = "account_id"
        case categoryId = "category_id"
        case budgetId = "budget_id"
        case dayOfMonth = "day_of_month"
        case lastExecutionDate = "last_execution_date"
        case createdAt = "created_at"
    }

    var recurringType: RecurringType? {
        RecurringType(rawValue: type)
    }

    var isIncome: Bool {
        type == "income"
    }

    var nextExecutionDate: Date? {
        let calendar = Calendar.current
        let now = Date()
        var components = calendar.dateComponents([.year, .month], from: now)
        components.day = dayOfMonth

        guard var nextDate = calendar.date(from: components) else { return nil }

        if nextDate <= now {
            if let nextMonth = calendar.date(byAdding: .month, value: 1, to: nextDate) {
                nextDate = nextMonth
            }
        }

        return nextDate
    }

    var daysUntilNextExecution: Int? {
        guard let nextDate = nextExecutionDate else { return nil }
        let calendar = Calendar.current
        let components = calendar.dateComponents([.day], from: Date(), to: nextDate)
        return components.day
    }
}

struct CreateRecurringTransactionRequest: Codable {
    let name: String
    let description: String?
    let amount: Double
    let type: String
    let accountId: String
    let categoryId: String
    let budgetId: String?
    let dayOfMonth: Int

    enum CodingKeys: String, CodingKey {
        case name
        case description
        case amount
        case type
        case accountId = "account_id"
        case categoryId = "category_id"
        case budgetId = "budget_id"
        case dayOfMonth = "day_of_month"
    }
}

struct UpdateRecurringTransactionRequest: Codable {
    let name: String
    let description: String?
    let amount: Double
    let type: String
    let accountId: String
    let categoryId: String
    let budgetId: String?
    let dayOfMonth: Int

    enum CodingKeys: String, CodingKey {
        case name
        case description
        case amount
        case type
        case accountId = "account_id"
        case categoryId = "category_id"
        case budgetId = "budget_id"
        case dayOfMonth = "day_of_month"
    }
}

