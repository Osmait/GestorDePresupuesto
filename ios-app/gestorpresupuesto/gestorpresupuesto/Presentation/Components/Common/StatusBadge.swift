import SwiftUI

struct StatusBadge: View {
    let text: String
    let color: Color

    init(_ text: String, color: Color) {
        self.text = text
        self.color = color
    }

    var body: some View {
        Text(text)
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.15))
            .clipShape(Capsule())
    }

    static func forLoanStatus(_ status: LoanStatus) -> StatusBadge {
        switch status {
        case .active: return StatusBadge("Activo", color: .app.success)
        case .paid: return StatusBadge("Pagado", color: .app.accent)
        case .defaulted: return StatusBadge("Vencido", color: .app.error)
        case .cancelled: return StatusBadge("Cancelado", color: .app.textSecondary)
        }
    }

    static func forCertificateStatus(_ status: CertificateStatus) -> StatusBadge {
        switch status {
        case .active: return StatusBadge("Activo", color: .app.success)
        case .matured: return StatusBadge("Vencido", color: .app.warning)
        case .cancelled: return StatusBadge("Cancelado", color: .app.textSecondary)
        }
    }
}
