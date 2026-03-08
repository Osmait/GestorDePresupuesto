import Foundation

struct SearchResponse: Codable {
    let transactions: [Transaction]
    let categories: [Category]
    let accounts: [Account]
    let budgets: [SearchBudgetItem]
    let loans: [SearchLoanItem]
    let certificates: [SearchCertificateItem]

    enum CodingKeys: String, CodingKey {
        case transactions, categories, accounts, budgets, loans, certificates
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        self.transactions = try container.decodeIfPresent([Transaction].self, forKey: .transactions) ?? []
        self.categories = try container.decodeIfPresent([Category].self, forKey: .categories) ?? []
        self.accounts = try container.decodeIfPresent([Account].self, forKey: .accounts) ?? []
        self.budgets = try container.decodeIfPresent([SearchBudgetItem].self, forKey: .budgets) ?? []
        self.loans = try container.decodeIfPresent([SearchLoanItem].self, forKey: .loans) ?? []
        self.certificates = try container.decodeIfPresent([SearchCertificateItem].self, forKey: .certificates) ?? []
    }
}

// Budget domain entity from search has no JSON tags on most fields (Go PascalCase)
struct SearchBudgetItem: Codable, Identifiable {
    let id: String
    let categoryId: String?
    let amount: Double?
    let categoryName: String?

    enum CodingKeys: String, CodingKey {
        // Go fields without JSON tags serialize as PascalCase
        case id = "Id"
        case categoryId = "CategoryId"
        case amount = "Amount"
        case categoryName = "category_name"
    }
}

struct SearchLoanItem: Codable, Identifiable {
    let id: String
    let borrowerName: String
    let pendingAmount: Double
    let totalAmount: Double
    let currency: String
    let status: String

    enum CodingKeys: String, CodingKey {
        case id, currency, status
        case borrowerName = "borrower_name"
        case pendingAmount = "pending_amount"
        case totalAmount = "total_amount"
    }
}

struct SearchCertificateItem: Codable, Identifiable {
    let id: String
    let bank: String
    let baseCapital: Double
    let currency: String
    let status: String

    enum CodingKeys: String, CodingKey {
        case id, bank, currency, status
        case baseCapital = "base_capital"
    }
}
