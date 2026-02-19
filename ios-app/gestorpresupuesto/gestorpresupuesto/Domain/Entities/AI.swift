import Foundation

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
        case success
        case task
        case data
        case usage
        case processingTimeMs = "processing_time_ms"
        case modelUsed = "model_used"
    }
}

struct ExtractData: Codable {
    let transactions: [ExtractedTransaction]
    let count: Int
    let unmatchedCategories: Int
    
    enum CodingKeys: String, CodingKey {
        case transactions
        case count
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
        case id
        case name
        case description
        case amount
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
        case success
        case task
        case data
        case usage
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
        case "high": return .app.error
        case "medium": return .app.warning
        case "low": return .app.success
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
        case title
        case description
        case potentialSavings = "potential_savings"
        case priority
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

import SwiftUI
