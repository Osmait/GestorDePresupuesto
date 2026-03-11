import Foundation

struct CreditCard: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let bank: String
    let lastFourDigits: String
    let cutDay: Int
    let dueDay: Int
    let balances: [CardBalance]
    let nextCutDate: String?
    let nextDueDate: String?
    let createdAt: String
    let updatedAt: String

    enum CodingKeys: String, CodingKey {
        case id, name, bank, balances
        case lastFourDigits = "last_four_digits"
        case cutDay = "cut_day"
        case dueDay = "due_day"
        case nextCutDate = "next_cut_date"
        case nextDueDate = "next_due_date"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }

    var totalDebt: Double {
        balances.reduce(0) { $0 + $1.currentBalance }
    }
}

struct CardBalance: Codable, Identifiable, Equatable {
    let id: String
    let currency: String
    let currentBalance: Double
    let creditLimit: Double
    let availableCredit: Double
    let utilizationPercent: Double

    enum CodingKeys: String, CodingKey {
        case id, currency
        case currentBalance = "current_balance"
        case creditLimit = "credit_limit"
        case availableCredit = "available_credit"
        case utilizationPercent = "utilization_percent"
    }
}

struct CardPayment: Codable, Identifiable {
    let id: String
    let cardId: String
    let fromAccountId: String
    let currency: String
    let amount: Double
    let sourceCurrency: String?
    let sourceAmount: Double?
    let exchangeRate: Double?
    let includesInterest: Bool
    let interestAmount: Double
    let paymentDate: String
    let status: String
    let notes: String
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id, currency, amount, status, notes
        case cardId = "card_id"
        case fromAccountId = "from_account_id"
        case sourceCurrency = "source_currency"
        case sourceAmount = "source_amount"
        case exchangeRate = "exchange_rate"
        case includesInterest = "includes_interest"
        case interestAmount = "interest_amount"
        case paymentDate = "payment_date"
        case createdAt = "created_at"
    }
}

struct CreditCardSummary: Codable {
    let totalCards: Int
    let totalDebt: [String: Double]
    let totalCreditLimit: [String: Double]
    let avgUtilization: [String: Double]
    let byCard: [CreditCard]

    enum CodingKeys: String, CodingKey {
        case byCard = "by_card"
        case totalCards = "total_cards"
        case totalDebt = "total_debt"
        case totalCreditLimit = "total_credit_limit"
        case avgUtilization = "avg_utilization"
    }
}

struct CreateCreditCardRequest: Codable {
    let name: String
    let bank: String
    let lastFourDigits: String?
    let cutDay: Int
    let dueDay: Int
    let balances: [CreateBalanceRequest]

    enum CodingKeys: String, CodingKey {
        case name, bank, balances
        case lastFourDigits = "last_four_digits"
        case cutDay = "cut_day"
        case dueDay = "due_day"
    }
}

struct CreateBalanceRequest: Codable {
    let currency: String
    let creditLimit: Double
    let initialDebt: Double?

    enum CodingKeys: String, CodingKey {
        case currency
        case creditLimit = "credit_limit"
        case initialDebt = "initial_debt"
    }
}

struct UpdateCreditCardRequest: Codable {
    let name: String?
    let bank: String?
    let lastFourDigits: String?
    let cutDay: Int?
    let dueDay: Int?

    enum CodingKeys: String, CodingKey {
        case name, bank
        case lastFourDigits = "last_four_digits"
        case cutDay = "cut_day"
        case dueDay = "due_day"
    }
}

struct CreateCardPaymentRequest: Codable {
    let fromAccountId: String
    let currency: String
    let amount: Double
    let exchangeRate: Double?
    let includesInterest: Bool?
    let interestAmount: Double?
    let notes: String?

    enum CodingKeys: String, CodingKey {
        case currency, amount, notes
        case fromAccountId = "from_account_id"
        case exchangeRate = "exchange_rate"
        case includesInterest = "includes_interest"
        case interestAmount = "interest_amount"
    }
}
