import Foundation
import SwiftUI
import UserNotifications
import Combine

@MainActor
final class NotificationManager: ObservableObject {
    static let shared = NotificationManager()

    @Published var notifications: [AppNotification] = []
    @Published var isConnected = false
    @Published var showBanner = false
    @Published var bannerNotification: NotificationEvent?
    @Published var showNotificationCenter = false

    var unreadCount: Int {
        notifications.filter { !$0.isRead }.count
    }

    private let sseClient = SSEClient()
    private let repository: NotificationRepository = DependencyContainer.shared.resolve(NotificationRepository.self)
    private var sseTask: Task<Void, Never>?
    private var networkCancellable: AnyCancellable?
    private var isStarted = false

    private init() {}

    // MARK: - Lifecycle

    func start(networkMonitor: NetworkMonitor) {
        guard !isStarted else { return }
        guard UserDefaultsStorage.shared.userId != nil else { return }
        isStarted = true

        connectSSE()
        Task { await fetchHistory() }

        networkCancellable = networkMonitor.$isConnected
            .removeDuplicates()
            .dropFirst()
            .sink { [weak self] connected in
                guard let self else { return }
                if connected {
                    self.connectSSE()
                } else {
                    Task { await self.sseClient.disconnect() }
                    self.isConnected = false
                }
            }
    }

    func stop() {
        Task { await sseClient.disconnect() }
        sseTask?.cancel()
        sseTask = nil
        networkCancellable?.cancel()
        networkCancellable = nil
        notifications = []
        isConnected = false
        showBanner = false
        bannerNotification = nil
        isStarted = false
    }

    // MARK: - SSE

    private func connectSSE() {
        sseTask?.cancel()

        sseTask = Task { [weak self] in
            guard let self else { return }

            let stream = await self.sseClient.connect()

            for await event in stream {
                if Task.isCancelled { break }

                // First event means we're connected
                if !self.isConnected {
                    self.isConnected = true
                }

                if event.event == "message" {
                    self.handleSSEEvent(event.data)
                }
            }

            if !Task.isCancelled {
                self.isConnected = false
            }
        }

        // Mark connected optimistically — the SSE stream is open
        // even if no events have arrived yet
        isConnected = true
    }

    private func handleSSEEvent(_ data: String) {
        guard let jsonData = data.data(using: .utf8),
              let event = try? JSONDecoder().decode(NotificationEvent.self, from: jsonData) else {
            #if DEBUG
            print("🔔 SSE: could not decode event data: \(data)")
            #endif
            return
        }

        // Create a local AppNotification for the list
        let notification = AppNotification(
            id: UUID().uuidString,
            userId: UserDefaultsStorage.shared.userId ?? "",
            type: event.type,
            message: event.message,
            amount: event.amount,
            isRead: false,
            createdAt: Date()
        )

        notifications.insert(notification, at: 0)

        // Show banner
        bannerNotification = event
        showBanner = true

        // Haptic feedback
        HapticManager.shared.notification(.success)

        // Local notification if app is in background
        postLocalNotificationIfNeeded(event)
    }

    // MARK: - History

    func fetchHistory() async {
        do {
            let history = try await repository.getHistory()
            notifications = history
        } catch {
            #if DEBUG
            print("🔔 Failed to fetch notification history: \(error)")
            #endif
        }
    }

    // MARK: - Actions

    func markAsRead(_ id: String) {
        if let index = notifications.firstIndex(where: { $0.id == id }) {
            let n = notifications[index]
            notifications[index] = AppNotification(
                id: n.id, userId: n.userId, type: n.type,
                message: n.message, amount: n.amount,
                isRead: true, createdAt: n.createdAt
            )
        }

        Task {
            do {
                try await repository.markAsRead(id)
            } catch {
                await fetchHistory()
            }
        }
    }

    func markAllAsRead() {
        notifications = notifications.map {
            AppNotification(
                id: $0.id, userId: $0.userId, type: $0.type,
                message: $0.message, amount: $0.amount,
                isRead: true, createdAt: $0.createdAt
            )
        }

        Task {
            do {
                try await repository.markAllAsRead()
            } catch {
                await fetchHistory()
            }
        }
    }

    func deleteAll() {
        notifications = []

        Task {
            do {
                try await repository.deleteAll()
            } catch {
                await fetchHistory()
            }
        }
    }

    func sendTest() {
        Task {
            do {
                try await repository.sendTest()
            } catch {
                #if DEBUG
                print("🔔 Failed to send test notification: \(error)")
                #endif
            }
        }
    }

    // MARK: - Local Notifications

    func requestNotificationPermission() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
            #if DEBUG
            print("🔔 Notification permission: \(granted), error: \(String(describing: error))")
            #endif
        }
    }

    private func postLocalNotificationIfNeeded(_ event: NotificationEvent) {
        let state = UIApplication.shared.applicationState
        guard state != .active else { return }

        let content = UNMutableNotificationContent()
        content.title = "SBFinance"
        content.body = event.message
        content.sound = .default

        if let amount = event.amount {
            content.subtitle = amount.currencyFormatted
        }

        let request = UNNotificationRequest(
            identifier: UUID().uuidString,
            content: content,
            trigger: nil
        )

        UNUserNotificationCenter.current().add(request)
    }
}
