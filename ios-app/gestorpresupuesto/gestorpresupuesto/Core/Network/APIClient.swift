import Foundation

actor APIClient {
    static let shared = APIClient()
    
    private let session: URLSession
    private let tokenStorage: TokenStorage
    private let decoder: JSONDecoder
    private var isRefreshing = false
    
    init(session: URLSession = .shared, tokenStorage: TokenStorage = KeychainTokenStorage()) {
        self.session = session
        self.tokenStorage = tokenStorage
        
        let jsonDecoder = JSONDecoder()
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        jsonDecoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let dateString = try container.decode(String.self)
            
            if let date = formatter.date(from: dateString) {
                return date
            }
            
            let fallbackFormatter = ISO8601DateFormatter()
            fallbackFormatter.formatOptions = [.withInternetDateTime]
            if let date = fallbackFormatter.date(from: dateString) {
                return date
            }
            
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Cannot decode date: \(dateString)")
        }
        self.decoder = jsonDecoder
    }
    
    func request<T: Decodable>(_ endpoint: Endpoint) async throws -> T {
        var request = try buildRequest(endpoint)
        
        do {
            return try await performRequest(request)
        } catch APIError.unauthorized {
            if let newToken = try await refreshToken() {
                request.setValue("Bearer \(newToken)", forHTTPHeaderField: "Authorization")
                return try await performRequest(request)
            } else {
                throw APIError.unauthorized
            }
        }
    }
    
    func requestVoid(_ endpoint: Endpoint) async throws {
        var request = try buildRequest(endpoint)
        
        do {
            try await performVoidRequest(request)
        } catch APIError.unauthorized {
            if let newToken = try await refreshToken() {
                request.setValue("Bearer \(newToken)", forHTTPHeaderField: "Authorization")
                try await performVoidRequest(request)
            } else {
                throw APIError.unauthorized
            }
        }
    }
    
    private func buildRequest(_ endpoint: Endpoint) throws -> URLRequest {
        guard var request = endpoint.asURLRequest(baseURL: Endpoints.baseURL) else {
            throw APIError.invalidURL
        }
        
        if let accessToken = tokenStorage.getAccessToken() {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }
        
        return request
    }
    
    private func performRequest<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.unknown
        }
        
        switch httpResponse.statusCode {
        case 200...299:
            do {
                return try decoder.decode(T.self, from: data)
            } catch {
                throw APIError.decodingError(error)
            }
        case 401:
            throw APIError.unauthorized
        case 400...499:
            let errorMessage = try? decoder.decode(ErrorMessage.self, from: data)
            throw APIError.serverError(httpResponse.statusCode, errorMessage?.message)
        case 500...599:
            throw APIError.serverError(httpResponse.statusCode, "Server error")
        default:
            throw APIError.unknown
        }
    }
    
    private func performVoidRequest(_ request: URLRequest) async throws {
        let (_, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.unknown
        }
        
        switch httpResponse.statusCode {
        case 200...299:
            return
        case 401:
            throw APIError.unauthorized
        case 400...499:
            throw APIError.serverError(httpResponse.statusCode, nil)
        case 500...599:
            throw APIError.serverError(httpResponse.statusCode, "Server error")
        default:
            throw APIError.unknown
        }
    }
    
    private func refreshToken() async throws -> String? {
        if isRefreshing {
            return nil
        }
        
        isRefreshing = true
        defer { isRefreshing = false }
        
        guard let refreshToken = tokenStorage.getRefreshToken() else {
            return nil
        }
        
        var request = Endpoints.refreshToken().asURLRequest(baseURL: Endpoints.baseURL)!
        let body = RefreshTokenRequest(refreshToken: refreshToken)
        request.httpBody = try? JSONEncoder().encode(body)
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            tokenStorage.clearTokens()
            return nil
        }
        
        let tokenResponse = try decoder.decode(RefreshTokenResponse.self, from: data)
        try tokenStorage.saveTokens(accessToken: tokenResponse.accessToken, refreshToken: tokenResponse.refreshToken)
        
        return tokenResponse.accessToken
    }
    
    func logout() {
        tokenStorage.clearTokens()
        UserDefaultsStorage.shared.clearUserData()
    }
}

struct ErrorMessage: Decodable {
    let message: String
}
