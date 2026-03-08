import SwiftUI

struct CurrencyField: View {
    let title: String
    @Binding var amount: String
    @Binding var currency: String
    var currencies: [String] = ["DOP", "USD"]

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs.rawValue) {
            Text(title)
                .font(.app(.caption))
                .foregroundStyle(Color.app.textSecondary)

            HStack(spacing: Spacing.sm.rawValue) {
                Menu {
                    ForEach(currencies, id: \.self) { curr in
                        Button(curr) {
                            currency = curr
                            HapticManager.shared.selection()
                        }
                    }
                } label: {
                    HStack(spacing: 4) {
                        Text(currency)
                            .font(.app(.subheadline))
                            .fontWeight(.semibold)
                            .foregroundStyle(Color.app.accent)
                        Image(systemName: "chevron.down")
                            .font(.system(size: 10))
                            .foregroundStyle(Color.app.textTertiary)
                    }
                    .padding(.horizontal, Spacing.sm.rawValue)
                    .padding(.vertical, Spacing.sm.rawValue)
                    .background(Color.app.accent.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: Radius.sm.rawValue))
                }

                TextField("0.00", text: $amount)
                    .keyboardType(.decimalPad)
                    .font(.app(.body))
                    .foregroundStyle(Color.app.textPrimary)
            }
            .padding(.horizontal, Spacing.md.rawValue)
            .padding(.vertical, Spacing.sm.rawValue)
            .background(Color.app.surface)
            .clipShape(RoundedRectangle(cornerRadius: Radius.md.rawValue))
            .overlay(
                RoundedRectangle(cornerRadius: Radius.md.rawValue)
                    .stroke(Color.app.border, lineWidth: 1)
            )
        }
    }
}
