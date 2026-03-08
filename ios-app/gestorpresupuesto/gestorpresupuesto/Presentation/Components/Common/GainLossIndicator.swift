import SwiftUI

struct GainLossIndicator: View {
    let value: Double
    let percent: Double

    var isPositive: Bool { value >= 0 }

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: isPositive ? "arrow.up.right" : "arrow.down.right")
                .font(.system(size: 10, weight: .bold))
            Text("\(String(format: "%.2f", abs(percent)))%")
                .font(.system(size: 12, weight: .semibold))
        }
        .foregroundStyle(isPositive ? Color.app.success : Color.app.error)
        .padding(.horizontal, 8)
        .padding(.vertical, 3)
        .background((isPositive ? Color.app.success : Color.app.error).opacity(0.15))
        .clipShape(Capsule())
    }
}
