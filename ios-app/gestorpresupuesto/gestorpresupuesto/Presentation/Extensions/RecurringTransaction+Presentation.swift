import SwiftUI

extension RecurringType {
    var color: Color {
        switch self {
        case .income: return .app.success
        case .bill: return .app.error
        }
    }
}
