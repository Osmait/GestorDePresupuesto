import Foundation
import SwiftUI

enum DocumentType: String, Codable, CaseIterable {
    case receipt = "receipt"
    case statement = "statement"
    case invoice = "invoice"

    var displayName: String {
        switch self {
        case .receipt: return "Recibo"
        case .statement: return "Estado de cuenta"
        case .invoice: return "Factura"
        }
    }

    var icon: String {
        switch self {
        case .receipt: return "doc.text"
        case .statement: return "doc.text.fill"
        case .invoice: return "doc.fill"
        }
    }
}

struct ExtractTransactionsRequest: Codable {
    let accountId: String
    let documentType: String
    let language: String?
    let files: [DocumentFile]

    enum CodingKeys: String, CodingKey {
        case accountId = "account_id"
        case documentType = "document_type"
        case language
        case files
    }
}

struct DocumentFile: Codable {
    let filename: String
    let contentType: String
    let base64Data: String

    enum CodingKeys: String, CodingKey {
        case filename
        case contentType = "content_type"
        case base64Data = "base64_data"
    }
}

struct ExtractTransactionsResponse: Codable {
    let success: Bool
    let task: String
    let data: ExtractData
    let usage: TokenUsage?
    let processingTimeMs: Int?
    let modelUsed: String?

    enum CodingKeys: String, CodingKey {
        case success, task, data, usage
        case processingTimeMs = "processing_time_ms"
        case modelUsed = "model_used"
    }
}

struct ExtractData: Codable {
    let transactions: [ExtractedTransaction]
    let count: Int
    let unmatchedCategories: Int

    enum CodingKeys: String, CodingKey {
        case transactions, count
        case unmatchedCategories = "unmatched_categories"
    }
}

struct ExtractedTransaction: Codable, Identifiable {
    let id: String?
    let name: String
    let description: String?
    let amount: Double
    let typeTransaction: String?
    let categoryId: String?
    let createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, name, description, amount
        case typeTransaction = "type_transation"
        case categoryId = "category_id"
        case createdAt = "created_at"
    }
}

struct TokenUsage: Codable {
    let promptTokens: Int?
    let completionTokens: Int?
    let totalTokens: Int?

    enum CodingKeys: String, CodingKey {
        case promptTokens = "prompt_tokens"
        case completionTokens = "completion_tokens"
        case totalTokens = "total_tokens"
    }
}

struct AnalyzeSpendingRequest: Codable {
    let dateFrom: String
    let dateTo: String
    let language: String?

    enum CodingKeys: String, CodingKey {
        case dateFrom = "date_from"
        case dateTo = "date_to"
        case language
    }
}

struct SpendingAnalysisResponse: Codable {
    let success: Bool
    let task: String
    let data: SpendingInsights
    let usage: TokenUsage?
    let processingTimeMs: Int?
    let modelUsed: String?

    enum CodingKeys: String, CodingKey {
        case success, task, data, usage
        case processingTimeMs = "processing_time_ms"
        case modelUsed = "model_used"
    }
}

struct SpendingInsights: Codable {
    let summary: SpendingSummary
    let patterns: [Pattern]
    let recommendations: [Recommendation]
}

struct SpendingSummary: Codable {
    let totalExpenses: Double
    let totalIncome: Double
    let savingsRatePercent: Double
    let period: PeriodInfo
    let topCategories: [CategoryBreakdown]

    enum CodingKeys: String, CodingKey {
        case totalExpenses = "total_expenses"
        case totalIncome = "total_income"
        case savingsRatePercent = "savings_rate_percent"
        case period
        case topCategories = "top_categories"
    }
}

struct PeriodInfo: Codable {
    let from: String
    let to: String
    let days: Int
}

struct CategoryBreakdown: Codable {
    let category: String
    let amount: Double
    let percentage: Double
}

struct Pattern: Codable, Identifiable {
    var id: String { type + description }
    let type: String
    let description: String
    let severity: String

    var severityColor: Color {
        switch severity.lowercased() {
        case "high", "alert": return .app.error
        case "medium", "warning": return .app.warning
        case "low", "info": return .app.success
        default: return .app.textSecondary
        }
    }

    var icon: String {
        switch type.lowercased() {
        case "subscription": return "arrow.clockwise"
        case "impulse": return "bolt"
        case "frequency": return "chart.line.uptrend.xyaxis"
        case "seasonal": return "calendar"
        default: return "lightbulb"
        }
    }
}

struct Recommendation: Codable, Identifiable {
    var id: String { title }
    let title: String
    let description: String
    let potentialSavings: Double
    let priority: String

    enum CodingKeys: String, CodingKey {
        case title, description, priority
        case potentialSavings = "potential_savings"
    }

    var priorityColor: Color {
        switch priority.lowercased() {
        case "high": return .app.error
        case "medium": return .app.warning
        case "low": return .app.success
        default: return .app.textSecondary
        }
    }

    var priorityIcon: String {
        switch priority.lowercased() {
        case "high": return "exclamationmark.3"
        case "medium": return "exclamationmark.2"
        case "low": return "exclamationmark"
        default: return "info.circle"
        }
    }
}

// MARK: - Category Suggestion

struct AISuggestCategoryRequest: Codable {
    let name: String
    let description: String?
    let amount: Double
    let typeTransaction: String
    let accountId: String
    let currency: String?

    enum CodingKeys: String, CodingKey {
        case name, description, amount, currency
        case typeTransaction = "type_transation"
        case accountId = "account_id"
    }
}

struct AISuggestCategoryResponse: Codable {
    let success: Bool
    let data: AICategorySuggestion?
}

struct AICategorySuggestion: Codable {
    let categoryId: String
    let categoryName: String
    let newCategoryName: String?
    let confidence: String
    let score: Double
    let reason: String

    enum CodingKeys: String, CodingKey {
        case confidence, score, reason
        case categoryId = "category_id"
        case categoryName = "category_name"
        case newCategoryName = "new_category_name"
    }
}

// MARK: - Reconciliation

struct AIReconciliationPreviewRequest: Codable {
    let accountId: String
    let accountCurrency: String?
    let documentType: String
    let language: String?
    let files: [DocumentFile]

    enum CodingKeys: String, CodingKey {
        case language, files
        case accountId = "account_id"
        case accountCurrency = "account_currency"
        case documentType = "document_type"
    }
}

struct AIReconciliationPreviewResponse: Codable {
    let success: Bool
    let data: AIReconciliationPreviewData
}

struct AIReconciliationPreviewData: Codable {
    let sessionId: String
    let extractedCount: Int
    let exactMatches: [AIReconciliationItem]
    let similarMatches: [AIReconciliationItem]
    let unmatched: [AIReconciliationItem]

    enum CodingKeys: String, CodingKey {
        case sessionId = "session_id"
        case extractedCount = "extracted_count"
        case exactMatches = "exact_matches"
        case similarMatches = "similar_matches"
        case unmatched
    }
}

struct AIReconciliationItem: Codable, Identifiable {
    var id: String { extracted.name + "\(extracted.amount)" }
    let extracted: ExtractedTransaction
    let candidates: [AIDuplicateCandidate]
    let score: Double
    let status: String
}

struct AIDuplicateCandidate: Codable, Identifiable {
    let id: String
    let name: String
    let amount: Double
    let typeTransaction: String
    let accountId: String
    let currency: String
    let createdAt: String
    let score: Double

    enum CodingKeys: String, CodingKey {
        case id, name, amount, currency, score
        case typeTransaction = "type_transation"
        case accountId = "account_id"
        case createdAt = "created_at"
    }
}

struct AIReconciliationApplyRequest: Codable {
    let actions: [AIReconciliationAction]
}

struct AIReconciliationAction: Codable {
    let extractedTransactionId: String
    let action: String // "create", "link", "ignore"
    let linkedTransactionId: String?
    let categoryId: String?

    enum CodingKeys: String, CodingKey {
        case action
        case extractedTransactionId = "extracted_transaction_id"
        case linkedTransactionId = "linked_transaction_id"
        case categoryId = "category_id"
    }
}

struct AIReconciliationApplyResponse: Codable {
    let success: Bool
    let data: AIReconciliationApplyData
}

struct AIReconciliationApplyData: Codable {
    let sessionId: String
    let linked: Int
    let created: Int
    let ignored: Int
    let failed: Int

    enum CodingKeys: String, CodingKey {
        case linked, created, ignored, failed
        case sessionId = "session_id"
    }
}

// MARK: - Savings Goals

struct AISavingsGoal: Codable, Identifiable {
    let id: String
    let name: String
    let targetAmount: Double
    let currentSaved: Double
    let progressPct: Double
    let targetDate: String?
    let accountId: String?
    let status: String
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, name, status
        case targetAmount = "target_amount"
        case currentSaved = "current_saved"
        case progressPct = "progress_pct"
        case targetDate = "target_date"
        case accountId = "account_id"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct AISavingsGoalResponse: Codable {
    let success: Bool
    let data: AISavingsGoal
}

struct AISavingsGoalProgressResponse: Codable {
    let success: Bool
    let data: AISavingsGoalProgressData
}

struct AISavingsGoalProgressData: Codable {
    let goal: AISavingsGoal
    let currentAverageSavings: Double
    let recommendedMonthlySave: Double
    let recommendedWeeklySave: Double
    let estimatedMonthsToTarget: Int
    let feasibleByDate: Bool

    enum CodingKeys: String, CodingKey {
        case goal
        case currentAverageSavings = "current_average_savings"
        case recommendedMonthlySave = "recommended_monthly_save"
        case recommendedWeeklySave = "recommended_weekly_save"
        case estimatedMonthsToTarget = "estimated_months_to_target"
        case feasibleByDate = "feasible_by_date"
    }
}

struct AICreateSavingsGoalRequest: Codable {
    let name: String
    let targetAmount: Double
    let targetDate: String?
    let accountId: String?
    let currentSaved: Double?

    enum CodingKeys: String, CodingKey {
        case name
        case targetAmount = "target_amount"
        case targetDate = "target_date"
        case accountId = "account_id"
        case currentSaved = "current_saved"
    }
}

struct AIUpdateSavingsGoalRequest: Codable {
    let name: String?
    let targetAmount: Double?
    let targetDate: String?
    let accountId: String?
    let currentSaved: Double?
    let status: String?

    enum CodingKeys: String, CodingKey {
        case name, status
        case targetAmount = "target_amount"
        case targetDate = "target_date"
        case accountId = "account_id"
        case currentSaved = "current_saved"
    }
}

struct AISavingsPlanRequest: Codable {
    let targetAmount: Double
    let targetDate: String?
    let accountId: String?

    enum CodingKeys: String, CodingKey {
        case targetAmount = "target_amount"
        case targetDate = "target_date"
        case accountId = "account_id"
    }
}

struct AISavingsPlanResponse: Codable {
    let success: Bool
    let data: AISavingsPlanData
}

struct AISavingsPlanData: Codable {
    let targetAmount: Double
    let currentAverageSavings: Double
    let recommendedMonthlySave: Double
    let recommendedWeeklySave: Double
    let estimatedMonthsToTarget: Int
    let feasibleByDate: Bool
    let targetDate: String?

    enum CodingKeys: String, CodingKey {
        case feasibleByDate = "feasible_by_date"
        case targetAmount = "target_amount"
        case currentAverageSavings = "current_average_savings"
        case recommendedMonthlySave = "recommended_monthly_save"
        case recommendedWeeklySave = "recommended_weekly_save"
        case estimatedMonthsToTarget = "estimated_months_to_target"
        case targetDate = "target_date"
    }
}
