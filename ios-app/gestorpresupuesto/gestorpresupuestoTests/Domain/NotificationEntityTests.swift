import Testing
@testable import gestorpresupuesto

@Suite("Notification Entity Tests")
struct NotificationEntityTests {

    @Test func notificationType_rawValueParsing() {
        #expect(NotificationType(rawValue: "budget_warning") == .budgetWarning)
        #expect(NotificationType(rawValue: "budget_exceeded") == .budgetExceeded)
        #expect(NotificationType(rawValue: "goal_progress") == .goalProgress)
        #expect(NotificationType(rawValue: "goal_completed") == .goalCompleted)
        #expect(NotificationType(rawValue: "recurring_reminder") == .recurringReminder)
        #expect(NotificationType(rawValue: "test") == .test)
        #expect(NotificationType(rawValue: "info") == .info)
    }

    @Test func notificationType_unknownDefaultsToInfo() {
        let notification = AppNotification.fixture(type: "unknown_type")
        #expect(notification.notificationType == .info)
    }

    @Test func notificationType_icon_mapping() {
        #expect(NotificationType.budgetWarning.icon == "exclamationmark.triangle.fill")
        #expect(NotificationType.budgetExceeded.icon == "xmark.circle.fill")
        #expect(NotificationType.goalProgress.icon == "chart.line.uptrend.xyaxis")
        #expect(NotificationType.goalCompleted.icon == "checkmark.seal.fill")
        #expect(NotificationType.recurringReminder.icon == "arrow.clockwise")
        #expect(NotificationType.test.icon == "bell.fill")
        #expect(NotificationType.info.icon == "info.circle.fill")
    }

    @Test func notificationType_toastType_warning() {
        #expect(NotificationType.budgetWarning.toastType == .warning)
    }

    @Test func notificationType_toastType_error() {
        #expect(NotificationType.budgetExceeded.toastType == .error)
    }

    @Test func notificationType_toastType_success() {
        #expect(NotificationType.goalCompleted.toastType == .success)
    }

    @Test func notificationType_toastType_info() {
        #expect(NotificationType.goalProgress.toastType == .info)
        #expect(NotificationType.recurringReminder.toastType == .info)
        #expect(NotificationType.test.toastType == .info)
        #expect(NotificationType.info.toastType == .info)
    }
}
