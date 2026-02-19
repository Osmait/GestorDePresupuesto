import Foundation

struct Budget: Codable, Identifiable, Equatable {
    let id: String
    let categoryId: String
    let userId: String
    let amount: Double
    let categoryName: String?
    let createdAt: Date
    
    enum CodingKeys: String, CodingKey {
        case id
        case categoryId = "category_id"
        case userId = "user_id"
        case amount
        case categoryName = "category_name"
        case createdAt = "created_at"
    }
}

struct BudgetResponse: Codable, Identifiable {
    let id: String
    let categoryId: String
    let userId: String
    let amount: Double
    let currentAmount: Double
    let categoryName: String?
    let createdAt: Date
    
    enum CodingKeys: String, CodingKey {
        case id
        case categoryId = "category_id"
        case userId = "user_id"
        case amount
        case currentAmount = "current_amount"
        case categoryName = "category_name"
        case createdAt = "created_at"
    }
    
    var spent: Double {
        abs(currentAmount)
    }
    
    var progress: Double {
        guard amount > 0 else { return 0 }
        return min(spent / amount, 1.0)
    }
    
    var percentageUsed: Int {
        Int(progress * 100)
    }
    
    var remaining: Double {
        max(amount - spent, 0)
    }
    
    var isOverBudget: Bool {
        spent > amount
    }
    
    var isWarning: Bool {
        progress >= 0.7 && progress < 1.0
    }
    
    var isCritical: Bool {
        progress >= 1.0
    }
    
    var displayName: String {
        categoryName ?? "Presupuesto"
    }
}

struct CreateBudgetRequest: Codable {
    let categoryId: String
    let amount: Double
    
    enum CodingKeys: String, CodingKey {
        case categoryId = "category_id"
        case amount
    }
}

struct UpdateBudgetRequest: Codable {
    let categoryId: String
    let amount: Double
    
    enum CodingKeys: String, CodingKey {
        case categoryId = "category_id"
        case amount
    }
}
