import Foundation
import Security

protocol TokenStorage {
    func saveTokens(accessToken: String, refreshToken: String) throws
    func getAccessToken() -> String?
    func getRefreshToken() -> String?
    func clearTokens()
}

class KeychainTokenStorage: TokenStorage {
    private let accessTokenKey = "access_token"
    private let refreshTokenKey = "refresh_token"
    private let service = "com.gestorpresupuesto.auth"
    
    func saveTokens(accessToken: String, refreshToken: String) throws {
        try save(key: accessTokenKey, value: accessToken)
        try save(key: refreshTokenKey, value: refreshToken)
    }
    
    func getAccessToken() -> String? {
        try? get(key: accessTokenKey)
    }
    
    func getRefreshToken() -> String? {
        try? get(key: refreshTokenKey)
    }
    
    func clearTokens() {
        try? delete(key: accessTokenKey)
        try? delete(key: refreshTokenKey)
    }
    
    private func save(key: String, value: String) throws {
        guard let data = value.data(using: .utf8) else { return }
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecValueData as String: data
        ]
        
        SecItemDelete(query as CFDictionary)
        
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw KeychainError.saveFailed
        }
    }
    
    private func get(key: String) throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess,
              let data = result as? Data,
              let value = String(data: data, encoding: .utf8) else {
            return nil
        }
        
        return value
    }
    
    private func delete(key: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key
        ]
        
        SecItemDelete(query as CFDictionary)
    }
}

enum KeychainError: Error {
    case saveFailed
    case itemNotFound
    case unexpectedData
}

class UserDefaultsStorage {
    static let shared = UserDefaultsStorage()
    private let defaults = UserDefaults.standard
    
    private let userIdKey = "user_id"
    private let userNameKey = "user_name"
    private let userEmailKey = "user_email"
    private let onboardingCompletedKey = "onboarding_completed"
    
    var userId: String? {
        get { defaults.string(forKey: userIdKey) }
        set { defaults.set(newValue, forKey: userIdKey) }
    }
    
    var userName: String? {
        get { defaults.string(forKey: userNameKey) }
        set { defaults.set(newValue, forKey: userNameKey) }
    }
    
    var userEmail: String? {
        get { defaults.string(forKey: userEmailKey) }
        set { defaults.set(newValue, forKey: userEmailKey) }
    }
    
    var onboardingCompleted: Bool {
        get { defaults.bool(forKey: onboardingCompletedKey) }
        set { defaults.set(newValue, forKey: onboardingCompletedKey) }
    }
    
    func clearUserData() {
        userId = nil
        userName = nil
        userEmail = nil
    }
}
