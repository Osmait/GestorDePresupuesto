import SwiftUI

struct CreditCardVisual: View {
    let card: CreditCard

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.md.rawValue) {
            HStack {
                Text(card.bank)
                    .font(.app(.caption))
                    .foregroundStyle(Color.app.onAccent.opacity(0.85))
                Spacer()
                Image(systemName: "creditcard.fill")
                    .font(.title2)
                    .foregroundStyle(Color.app.onAccent.opacity(0.75))
            }

            Spacer()

            if !card.lastFourDigits.isEmpty {
                Text("•••• •••• •••• \(card.lastFourDigits)")
                    .font(.system(.title3, design: .monospaced, weight: .medium))
                    .foregroundStyle(Color.app.onAccent)
            }

            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("TITULAR")
                        .font(.caption2)
                        .foregroundStyle(Color.app.onAccent.opacity(0.75))
                    Text(card.name)
                        .font(.app(.caption))
                        .fontWeight(.medium)
                        .foregroundStyle(Color.app.onAccent)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 2) {
                    Text("VENCE")
                        .font(.caption2)
                        .foregroundStyle(Color.app.onAccent.opacity(0.75))
                    Text("Día \(card.dueDay)")
                        .font(.app(.caption))
                        .fontWeight(.medium)
                        .foregroundStyle(Color.app.onAccent)
                }
            }
        }
        .padding(Spacing.lg.rawValue)
        // Grows with the text size instead of clipping it.
        .frame(minHeight: 200)
        .background(Color.app.accent)
        .clipShape(RoundedRectangle(cornerRadius: Radius.xl.rawValue))
    }
}
