import SwiftUI

/// Renders a money amount like the web `<Amount>`: app formatting, tabular
/// figures and semantic color. The only sanctioned way to color money: never
/// use raw green/red for income/expense.
struct AmountText: View {
    enum Tone {
        /// Inherits the surrounding color.
        case neutral
        /// Follows the sign: > 0 success, < 0 error, 0 neutral.
        case auto
        case positive
        case negative
        case warning
    }

    /// Signed amount: income/inflow positive, expense/outflow negative.
    let value: Double
    var currency: String = "DOP"
    var tone: Tone = .neutral
    /// Always print the sign ("+RD$100.00" / "-RD$100.00"); zero stays unsigned.
    var signed: Bool = false

    var body: some View {
        Text(formatted)
            .monospacedDigit()
            .foregroundStyle(color)
    }

    private var cents: Int {
        value.isFinite ? Int((value * 100).rounded()) : 0
    }

    var formatted: String {
        let text = abs(value).currencyFormatted(currency: currency)
        if cents < 0 { return "−" + text }
        if signed && cents > 0 { return "+" + text }
        return text
    }

    private var color: Color {
        switch resolvedTone {
        case .positive: Color.app.success
        case .negative: Color.app.error
        case .warning: Color.app.warning
        case .neutral, .auto: Color.app.textPrimary
        }
    }

    private var resolvedTone: Tone {
        guard tone == .auto else { return tone }
        if cents > 0 { return .positive }
        if cents < 0 { return .negative }
        return .neutral
    }
}

#Preview {
    VStack(alignment: .leading, spacing: 8) {
        AmountText(value: 284_530.75)
        AmountText(value: 96_000, tone: .auto, signed: true)
        AmountText(value: -58_412.30, tone: .auto)
        AmountText(value: -15.49, currency: "USD", tone: .auto)
    }
    .padding()
}
