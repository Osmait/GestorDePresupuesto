import Foundation

struct User: Codable, Identifiable, Equatable {
    let id: String
    let name: String
    let lastName: String
    let email: String
    let role: String
    let isDemo: Bool?
    let confirmed: Bool?
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case lastName = "last_name"
        case email
        case role
        case isDemo = "is_demo"
        case confirmed
        case createdAt = "created_at"
    }

    var fullName: String {
        "\(name) \(lastName)"
    }
}

struct AuthTokens: Codable {
    let accessToken: String
    let refreshToken: String

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
    }
}

struct LoginRequest: Codable {
    let email: String
    let password: String
}

struct LoginResponse: Codable {
    let accessToken: String
    let refreshToken: String
    let tokenType: String
    let expiresIn: Int

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case tokenType = "token_type"
        case expiresIn = "expires_in"
    }
}

struct RegisterRequest: Codable {
    let name: String
    let lastName: String
    let email: String
    let password: String

    enum CodingKeys: String, CodingKey {
        case name
        case lastName = "last_name"
        case email
        case password
    }
}

struct RefreshTokenRequest: Codable {
    let refreshToken: String

    enum CodingKeys: String, CodingKey {
        case refreshToken = "refresh_token"
    }
}

struct RefreshTokenResponse: Codable {
    let accessToken: String
    let refreshToken: String

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
    }
}
