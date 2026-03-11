import SwiftUI

extension Pattern {
    var severityColor: Color {
        switch severity.lowercased() {
        case "high", "alert": return .app.error
        case "medium", "warning": return .app.warning
        case "low", "info": return .app.success
        default: return .app.textSecondary
        }
    }

    var icon: String {
        switch type.lowercased() {
        case "subscription": return "arrow.clockwise"
        case "impulse": return "bolt"
        case "frequency": return "chart.line.uptrend.xyaxis"
        case "seasonal": return "calendar"
        default: return "lightbulb"
        }
    }
}

extension Recommendation {
    var priorityColor: Color {
        switch priority.lowercased() {
        case "high": return .app.error
        case "medium": return .app.warning
        case "low": return .app.success
        default: return .app.textSecondary
        }
    }

    var priorityIcon: String {
        switch priority.lowercased() {
        case "high": return "exclamationmark.3"
        case "medium": return "exclamationmark.2"
        case "low": return "exclamationmark"
        default: return "info.circle"
        }
    }
}
