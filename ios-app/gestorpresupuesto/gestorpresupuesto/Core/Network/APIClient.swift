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
        default:
            throw Self.failure(httpResponse, data: data)
        }
    }

    private func performVoidRequest(_ request: URLRequest) async throws {
        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.unknown
        }

        if (200...299).contains(httpResponse.statusCode) { return }
        throw Self.failure(httpResponse, data: data)
    }

    /// The error for a non-2xx reply, with the server's message when it sent one.
    private static func failure(_ response: HTTPURLResponse, data: Data) -> APIError {
        let status = response.statusCode
        switch status {
        case 401:
            return .unauthorized
        case 413:
            return .serverError(status, "El archivo es demasiado grande.")
        case 429:
            let wait = response.value(forHTTPHeaderField: "Retry-After").flatMap(Int.init)
            return .serverError(status, wait.map { "Demasiadas solicitudes. Intenta de nuevo en \($0) s." }
                ?? "Demasiadas solicitudes. Intenta de nuevo en un momento.")
        case 503:
            return .serverError(status, "El servicio está ocupado. Intenta de nuevo en un momento.")
        case 400...599:
            return .serverError(status, ErrorMessage.decode(from: data))
        default:
            return .unknown
        }
    }

    /// Refreshes the access token for callers outside APIClient (the
    /// notifications stream). nil when the session is over.
    func refreshAccessToken() async throws -> String? {
        try await refreshToken()
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

            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.unknown
            }
            switch httpResponse.statusCode {
            case 200:
                break
            case 400, 401:
                await self.tokenStorage.clearTokens()
                // The server rejected the refresh token (expired, revoked or
                // unknown user): the session is over, send the user to login.
                NotificationCenter.default.post(name: .sessionExpired, object: nil)
                return nil
            default:
                // Rate limit, deploy or server error: the refresh token is
                // still good, keep it and let the next request try again.
                throw Self.failure(httpResponse, data: data)
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

/// The backend sends `{"error": "..."}`, `{"error": {"message": "..."}}` or
/// `{"message": "..."}`.
enum ErrorMessage {
    private struct Flat: Decodable { let error: String?; let message: String? }
    private struct Nested: Decodable {
        struct Detail: Decodable { let message: String? }
        let error: Detail
    }

    static func decode(from data: Data) -> String? {
        let decoder = JSONDecoder()
        if let nested = try? decoder.decode(Nested.self, from: data), let message = nested.error.message, !message.isEmpty {
            return message
        }
        if let flat = try? decoder.decode(Flat.self, from: data) {
            return [flat.message, flat.error].compactMap { $0 }.first { !$0.isEmpty }
        }
        return nil
    }
}

extension Notification.Name {
    /// Posted when the refresh token is rejected; AuthViewModel returns to login.
    static let sessionExpired = Notification.Name("APIClient.sessionExpired")
}
