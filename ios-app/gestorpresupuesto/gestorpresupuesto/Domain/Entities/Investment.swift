import Foundation

enum InvestmentType: String, Codable, CaseIterable {
    case stock
    case crypto
    case fixedIncome = "fixed_income"

    var displayName: String {
        switch self {
        case .stock: return "Acción"
        case .crypto: return "Cripto"
        case .fixedIncome: return "Renta Fija"
        }
    }

    var icon: String {
        switch self {
        case .stock: return "chart.line.uptrend.xyaxis"
        case .crypto: return "bitcoinsign.circle.fill"
        case .fixedIncome: return "banknote.fill"
        }
    }
}

struct Investment: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let symbol: String
    let type: InvestmentType
    let quantity: Double
    let purchasePrice: Double
    let currentPrice: Double
    let sourceAccountId: String?
    let sourceAmount: Double?
    let settlementCurrency: String?
    let exchangeRate: Double?
    let createdAt: String
    let updatedAt: String?
    let userId: String

    enum CodingKeys: String, CodingKey {
        case id, name, symbol, type, quantity
        case purchasePrice = "purchase_price"
        case currentPrice = "current_price"
        case sourceAccountId = "source_account_id"
        case sourceAmount = "source_amount"
        case settlementCurrency = "settlement_currency"
        case exchangeRate = "exchange_rate"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
        case userId = "user_id"
    }

    var totalCost: Double {
        quantity * purchasePrice
    }

    var totalValue: Double {
        quantity * currentPrice
    }

    var gainLoss: Double {
        totalValue - totalCost
    }

    var gainLossPercent: Double {
        guard totalCost > 0 else { return 0 }
        return (gainLoss / totalCost) * 100
    }

    var isProfit: Bool {
        gainLoss >= 0
    }
}

struct FundingBalance: Codable {
    let currency: String
    let available: Double
}

struct QuoteResponse: Codable {
    let regularMarketPrice: Double
    let symbol: String
    let name: String?

    enum CodingKeys: String, CodingKey {
        case symbol, name
        case regularMarketPrice = "regular_market_price"
    }
}

struct CreateInvestmentRequest: Codable {
    let name: String
    let symbol: String
    let type: String
    let quantity: Double
    let purchasePrice: Double
    let currentPrice: Double
    let settlementCurrency: String?

    enum CodingKeys: String, CodingKey {
        case name, symbol, type, quantity
        case purchasePrice = "purchase_price"
        case currentPrice = "current_price"
        case settlementCurrency = "settlement_currency"
    }
}

struct UpdateInvestmentRequest: Codable {
    let name: String?
    let symbol: String?
    let type: String?
    let quantity: Double?
    let purchasePrice: Double?
    let currentPrice: Double?
    let settlementCurrency: String?

    enum CodingKeys: String, CodingKey {
        case name, symbol, type, quantity
        case purchasePrice = "purchase_price"
        case currentPrice = "current_price"
        case settlementCurrency = "settlement_currency"
    }
}

struct FundBrokerRequest: Codable {
    let sourceAccountId: String
    let sourceAmount: Double
    let targetCurrency: String
    let exchangeRate: Double?
    let feeAmount: Double?
    let notes: String?

    enum CodingKeys: String, CodingKey {
        case notes
        case sourceAccountId = "source_account_id"
        case sourceAmount = "source_amount"
        case targetCurrency = "target_currency"
        case exchangeRate = "exchange_rate"
        case feeAmount = "fee_amount"
    }
}
