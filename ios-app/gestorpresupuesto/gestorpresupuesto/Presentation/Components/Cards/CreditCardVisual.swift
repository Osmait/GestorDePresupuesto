import SwiftUI

struct CreditCardVisual: View {
    let card: CreditCard

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md.rawValue) {
            HStack {
                Text(card.bank)
                    .font(.app(.caption))
                    .foregroundStyle(.white.opacity(0.8))
                Spacer()
                Image(systemName: "creditcard.fill")
                    .font(.title2)
                    .foregroundStyle(.white.opacity(0.6))
            }

            Spacer()

            if !card.lastFourDigits.isEmpty {
                Text("•••• •••• •••• \(card.lastFourDigits)")
                    .font(.system(size: 20, weight: .medium, design: .monospaced))
                    .foregroundStyle(.white)
            }

            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("TITULAR")
                        .font(.system(size: 8))
                        .foregroundStyle(.white.opacity(0.6))
                    Text(card.name)
                        .font(.app(.caption))
                        .fontWeight(.medium)
                        .foregroundStyle(.white)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("VENCE")
                        .font(.system(size: 8))
                        .foregroundStyle(.white.opacity(0.6))
                    Text("Día \(card.dueDay)")
                        .font(.app(.caption))
                        .fontWeight(.medium)
                        .foregroundStyle(.white)
                }
            }
        }
        .padding(Spacing.lg.rawValue)
        .frame(height: 200)
        .background(
            LinearGradient(
                colors: [Color.app.accent, Color.app.accent.opacity(0.7)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .clipShape(RoundedRectangle(cornerRadius: Radius.xl.rawValue))
        .shadow(color: Color.app.accent.opacity(0.3), radius: 12, y: 6)
    }
}
