import Foundation

struct SSEEvent {
    let event: String
    let data: String
    let id: String?
    let retry: Int?
}

actor SSEClient {
    private var dataTask: URLSessionDataTask?
    private var session: URLSession?
    private let tokenStorage: TokenStorage

    private var continuation: AsyncStream<SSEEvent>.Continuation?
    private var parser = SSEParser()
    private var buffer = ""
    private var reconnectAttempt = 0

    init(tokenStorage: TokenStorage = KeychainTokenStorage()) {
        self.tokenStorage = tokenStorage
    }

    func connect() -> AsyncStream<SSEEvent> {
        disconnect()

        return AsyncStream { [weak self] continuation in
            guard let self else {
                continuation.finish()
                return
            }

            Task {
                await self.setContinuation(continuation)
                await self.startConnection()
            }

            continuation.onTermination = { [weak self] _ in
                Task { await self?.disconnect() }
            }
        }
    }

    private func setContinuation(_ continuation: AsyncStream<SSEEvent>.Continuation) {
        self.continuation = continuation
    }

    func disconnect() {
        dataTask?.cancel()
        dataTask = nil
        session?.invalidateAndCancel()
        session = nil
        continuation?.finish()
        continuation = nil
        buffer = ""
        parser = SSEParser()
        reconnectAttempt = 0
    }

    // MARK: - Connection

    private func startConnection() {
        guard let url = URL(string: Endpoints.baseURL + "/notifications") else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        request.setValue("no-cache", forHTTPHeaderField: "Cache-Control")

        if let token = tokenStorage.getAccessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 300
        config.timeoutIntervalForResource = 0
        config.requestCachePolicy = .reloadIgnoringLocalCacheData

        let delegate = SSESessionDelegate(owner: self)
        let session = URLSession(configuration: config, delegate: delegate, delegateQueue: nil)
        self.session = session

        let task = session.dataTask(with: request)
        self.dataTask = task
        task.resume()

        #if DEBUG
        print("🔔 SSE: starting connection to \(url)")
        #endif
    }

    // MARK: - Delegate Callbacks

    func handleResponse(_ response: URLResponse, completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
        if let httpResponse = response as? HTTPURLResponse {
            #if DEBUG
            print("🔔 SSE connected with status: \(httpResponse.statusCode)")
            #endif
            if httpResponse.statusCode == 401 {
                completionHandler(.cancel)
                return
            }
            reconnectAttempt = 0
        }
        completionHandler(.allow)
    }

    func handleData(_ data: Data) {
        guard let text = String(data: data, encoding: .utf8) else { return }

        #if DEBUG
        if !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            print("🔔 SSE chunk: \(text.prefix(200))")
        }
        #endif

        let events = parser.processBuffer(text)
        for event in events {
            continuation?.yield(event)
        }
    }

    func handleCompletion(error: Error?) {
        #if DEBUG
        if let error {
            print("🔔 SSE connection closed: \(error.localizedDescription)")
        } else {
            print("🔔 SSE connection closed normally")
        }
        #endif

        guard self.dataTask != nil else { return }

        let delay = min(pow(2, Double(reconnectAttempt)) + Double.random(in: 0...1), 60)
        reconnectAttempt += 1

        Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            guard let self = self else { return }
            guard await self.dataTask != nil else { return }
            #if DEBUG
            print("🔔 SSE: reconnecting after \(String(format: "%.1f", delay))s…")
            #endif
            await self.startConnection()
        }
    }
}

// MARK: - URLSession Delegate (bridges to actor)

private final class SSESessionDelegate: NSObject, URLSessionDataDelegate {
    private weak var owner: SSEClient?

    init(owner: SSEClient) {
        self.owner = owner
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse, completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
        Task { [owner] in
            await owner?.handleResponse(response, completionHandler: completionHandler)
        }
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        Task { [owner] in
            await owner?.handleData(data)
        }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        Task { [owner] in
            await owner?.handleCompletion(error: error)
        }
    }
}

// MARK: - Testable SSE Parser

struct SSEParser {
    private(set) var currentEvent = ""
    private(set) var currentData = ""
    private(set) var currentId: String?
    private(set) var currentRetry: Int?

    mutating func processLine(_ line: String) -> SSEEvent? {
        if line.isEmpty {
            // Empty line = dispatch event
            guard !currentData.isEmpty else { return nil }
            let event = SSEEvent(
                event: currentEvent.isEmpty ? "message" : currentEvent,
                data: currentData.trimmingCharacters(in: .whitespacesAndNewlines),
                id: currentId,
                retry: currentRetry
            )
            currentEvent = ""
            currentData = ""
            currentId = nil
            currentRetry = nil
            return event
        } else if line.hasPrefix("event:") {
            currentEvent = String(line.dropFirst(6)).trimmingCharacters(in: .whitespaces)
        } else if line.hasPrefix("data:") {
            let value = String(line.dropFirst(5)).trimmingCharacters(in: .whitespaces)
            if currentData.isEmpty {
                currentData = value
            } else {
                currentData += "\n" + value
            }
        } else if line.hasPrefix("id:") {
            currentId = String(line.dropFirst(3)).trimmingCharacters(in: .whitespaces)
        } else if line.hasPrefix("retry:") {
            let value = String(line.dropFirst(6)).trimmingCharacters(in: .whitespaces)
            currentRetry = Int(value)
        }
        // Lines starting with ":" are comments — ignore them
        return nil
    }

    mutating func processBuffer(_ text: String) -> [SSEEvent] {
        var events: [SSEEvent] = []
        var buffer = text
        while let range = buffer.rangeOfCharacter(from: .newlines) {
            let line = String(buffer[buffer.startIndex..<range.lowerBound])
            buffer = String(buffer[range.upperBound...])
            if let event = processLine(line) {
                events.append(event)
            }
        }
        if !buffer.isEmpty {
            if let event = processLine(buffer) {
                events.append(event)
            }
        }
        return events
    }
}
