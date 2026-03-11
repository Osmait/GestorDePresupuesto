import Foundation

struct AppNotification: Codable, Identifiable, Equatable {
    let id: String
    let userId: String
    let type: String
    let message: String
    let amount: Double?
    let isRead: Bool
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case userId = "user_id"
        case type
        case message
        case amount
        case isRead = "is_read"
        case createdAt = "created_at"
    }

    var notificationType: NotificationType {
        NotificationType(rawValue: type) ?? .info
    }
}

struct NotificationEvent: Codable, Equatable {
    let type: String
    let message: String
    let amount: Double?

    var notificationType: NotificationType {
        NotificationType(rawValue: type) ?? .info
    }
}

enum NotificationType: String, Codable {
    case budgetWarning = "budget_warning"
    case budgetExceeded = "budget_exceeded"
    case goalProgress = "goal_progress"
    case goalCompleted = "goal_completed"
    case recurringReminder = "recurring_reminder"
    case test
    case info

    var icon: String {
        switch self {
        case .budgetWarning: "exclamationmark.triangle.fill"
        case .budgetExceeded: "xmark.circle.fill"
        case .goalProgress: "chart.line.uptrend.xyaxis"
        case .goalCompleted: "checkmark.seal.fill"
        case .recurringReminder: "arrow.clockwise"
        case .test: "bell.fill"
        case .info: "info.circle.fill"
        }
    }

    var toastType: ToastType {
        switch self {
        case .budgetWarning: .warning
        case .budgetExceeded: .error
        case .goalProgress: .info
        case .goalCompleted: .success
        case .recurringReminder: .info
        case .test: .info
        case .info: .info
        }
    }
}
