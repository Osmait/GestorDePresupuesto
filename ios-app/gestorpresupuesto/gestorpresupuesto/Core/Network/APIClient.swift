import Foundation

actor APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let tokenStorage: TokenStorage
    private let decoder: JSONDecoder
    private var refreshTask: Task<String?, Error>?

    init(session: URLSession = .shared, tokenStorage: TokenStorage = KeychainTokenStorage()) {
        self.session = session
        self.tokenStorage = tokenStorage

        let jsonDecoder = JSONDecoder()
        let isoWithFrac = ISO8601DateFormatter()
        isoWithFrac.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let isoNoFrac = ISO8601DateFormatter()
        isoNoFrac.formatOptions = [.withInternetDateTime]
        jsonDecoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let dateString = try container.decode(String.self)

            if let date = isoWithFrac.date(from: dateString) {
                return date
            }

            if let date = isoNoFrac.date(from: dateString) {
                return date
            }

            // Handle Go's nanosecond precision (>3 fractional digits)
            // by truncating to milliseconds
            let trimmed = dateString.replacingOccurrences(
                of: #"(\.\d{3})\d+"#,
                with: "$1",
                options: .regularExpression
            )
            if trimmed != dateString, let date = isoWithFrac.date(from: trimmed) {
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
                #if DEBUG
                let rawJSON = String(data: data, encoding: .utf8) ?? "<no data>"
                print("🔴 DECODING ERROR for \(T.self)")
                print("🔴 URL: \(request.url?.absoluteString ?? "?")")
                print("🔴 Error: \(error)")
                print("🔴 Raw JSON (first 2000 chars): \(String(rawJSON.prefix(2000)))")
                #endif
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
        if let existing = refreshTask {
            return try await existing.value
        }

        let task = Task<String?, Error> {
            defer { self.refreshTask = nil }

            guard let refreshToken = self.tokenStorage.getRefreshToken() else {
                return nil
            }

            guard var request = Endpoints.refreshToken().asURLRequest(baseURL: Endpoints.baseURL) else {
                throw APIError.invalidURL
            }
            let body = RefreshTokenRequest(refreshToken: refreshToken)
            request.httpBody = try JSONEncoder().encode(body)

            let (data, response) = try await self.session.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                await self.tokenStorage.clearTokens()
                return nil
            }

            let tokenResponse = try self.decoder.decode(RefreshTokenResponse.self, from: data)
            try await self.tokenStorage.saveTokens(accessToken: tokenResponse.accessToken, refreshToken: tokenResponse.refreshToken)

            return tokenResponse.accessToken
        }

        refreshTask = task
        return try await task.value
    }

    func logout() async {
        await tokenStorage.clearTokens()
        await UserDefaultsStorage.shared.clearUserData()
    }
}

struct ErrorMessage: Decodable {
    let message: String
}
