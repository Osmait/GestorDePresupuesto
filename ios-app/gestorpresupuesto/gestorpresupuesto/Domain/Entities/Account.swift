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

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case bank
        case userId = "user_id"
        case initialBalance = "initial_balance"
        case createdAt = "created_at"
    }
}

struct AccountResponse: Codable, Identifiable {
    let accountInfo: Account
    let currentBalance: Double

    var id: String { accountInfo.id }

    enum CodingKeys: String, CodingKey {
        case accountInfo = "account_info"
        case currentBalance = "current_balance"
    }
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
