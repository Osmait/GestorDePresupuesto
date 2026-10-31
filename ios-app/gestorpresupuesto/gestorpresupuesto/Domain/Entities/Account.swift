import Foundation

// NOTE: Create/Update request types kept separate for API evolution
struct Account: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let bank: String
    let userId: String?
    // FIXME: amount: Double should be Decimal for monetary precision
    let initialBalance: Double
    let createdAt: Date
    /// "bank" or "credit_card" (a card's account, whose balance is its debt).
    var type: String? = nil
    var currency: String? = nil

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case bank
        case userId = "user_id"
        case initialBalance = "initial_balance"
        case createdAt = "created_at"
        case type
        case currency
    }

    var isCreditCard: Bool { type == "credit_card" }
}

struct AccountResponse: Codable, Identifiable {
    let accountInfo: Account
    let currentBalance: Double
    var lastReconciledAt: Date? = nil

    var id: String { accountInfo.id }
    var currency: String { accountInfo.currency ?? "DOP" }

    enum CodingKeys: String, CodingKey {
        case accountInfo = "account_info"
        case currentBalance = "current_balance"
        case lastReconciledAt = "last_reconciled_at"
    }
}

extension Array where Element == AccountResponse {
    /// Bank accounts only: a card account's balance is debt, not money.
    var bankAccounts: [AccountResponse] { filter { !$0.accountInfo.isCreditCard } }
    var cardAccounts: [AccountResponse] { filter { $0.accountInfo.isCreditCard } }
}

struct CreateAccountRequest: Codable {
    let name: String
    let bank: String
    let initialBalance: Double

    enum CodingKeys: String, CodingKey {
        case name
        case bank
        case initialBalance = "initial_balance"
    }
}

struct UpdateAccountRequest: Codable {
    let name: String
    let bank: String
    let initialBalance: Double

    enum CodingKeys: String, CodingKey {
        case name
        case bank
        case initialBalance = "initial_balance"
    }
}
