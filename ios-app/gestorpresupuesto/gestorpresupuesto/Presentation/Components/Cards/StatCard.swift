import SwiftUI

/// One KPI in a flat card, like the web `StatCard`: muted label and icon on
/// top, the value below. `colors.first` only tints the value (pass
/// `Color.app.gradientSuccess` for a positive figure, etc.).
struct StatCard: View {
    let title: String
    let value: String
    let icon: String
    let colors: [Color]
    var trend: TrendDirection?
    var trendValue: String?

    enum TrendDirection {
        case up, down, neutral
    }

    private var valueColor: Color {
        colors.first ?? Color.app.textPrimary
    }

    var body: some View {
        SurfaceCard(cornerRadius: .lg, padding: .lg) {
            VStack(alignment: .leading, spacing: .sm) {
                HStack(alignment: .top) {
                    Text(title)
                        .font(.app(.footnote))
                        .fontWeight(.medium)
                        .foregroundStyle(Color.app.textSecondary)
                    Spacer(minLength: .sm)
                    Image(systemName: icon)
                        .font(.footnote)
                        .foregroundStyle(Color.app.textSecondary)
                        .accessibilityHidden(true)
                }

                Text(value)
                    .font(.app(.title3))
                    .monospacedDigit()
                    .foregroundStyle(valueColor)
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)

                if let trend = trend, let trendValue = trendValue {
                    HStack(spacing: .xs) {
                        Image(systemName: trend == .up ? "arrow.up.right" : trend == .down ? "arrow.down.right" : "minus")
                        Text(trendValue)
                    }
                    .font(.app(.caption))
                    .foregroundStyle(trend == .up ? Color.app.success : trend == .down ? Color.app.error : Color.app.textSecondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(title): \(value)")
    }
}

struct IconCircle: View {
    let icon: String
    let colors: [Color]
    var size: CGFloat = 48

    var body: some View {
        ZStack {
            Circle()
                .fill(Color.app.surfaceSecondary)
                .frame(width: size, height: size)

            Image(systemName: icon)
                .font(.system(size: size * 0.42, weight: .medium))
                .foregroundStyle(colors.first ?? Color.app.textPrimary)
        }
    }
}

struct BalanceStatCard: View {
    let totalBalance: Double
    let income: Double
    let expenses: Double

    var body: some View {
        GlassCard(cornerRadius: .xl, padding: .xl) {
            VStack(spacing: .lg) {
                VStack(spacing: .xs) {
                    Text("Balance Total")
                        .font(.app(.caption))
                        .foregroundStyle(Color.app.textSecondary)

                    Text(totalBalance.currencyFormatted)
                        .font(.app(.largeTitle))
                        .foregroundStyle(totalBalance >= 0 ? Color.app.success : Color.app.error)
                }

                Divider()
                    .background(Color.app.border)

                HStack(spacing: .xl) {
                    StatItem(
                        title: "Ingresos",
                        value: income.currencyFormatted,
                        icon: "arrow.up.circle.fill",
                        color: Color.app.success
                    )

                    Spacer()

                    StatItem(
                        title: "Gastos",
                        value: expenses.currencyFormatted,
                        icon: "arrow.down.circle.fill",
                        color: Color.app.error
                    )
                }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Balance total: \(totalBalance.currencyFormatted). Ingresos: \(income.currencyFormatted). Gastos: \(expenses.currencyFormatted)")
    }
}

struct StatItem: View {
    let title: String
    let value: String
    let icon: String
    let color: Color

    var body: some View {
        HStack(spacing: .sm) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(color)

            VStack(alignment: .leading, spacing: .xxs) {
                Text(title)
                    .font(.caption2)
                    .foregroundStyle(Color.app.textSecondary)

                Text(value)
                    .font(.app(.headline))
                    .foregroundStyle(color)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }
        }
    }
}

#Preview {
    ZStack {
        Color.app.background.ignoresSafeArea()

        ScrollView {
            VStack(spacing: 20) {
                BalanceStatCard(
                    totalBalance: 10228.50,
                    income: 15000,
                    expenses: 4771.50
                )

                HStack(spacing: .md) {
                    StatCard(
                        title: "Este Mes",
                        value: "$5,230",
                        icon: "calendar",
                        colors: Color.app.gradientPrimary
                    )

                    StatCard(
                        title: "Ahorro",
                        value: "23%",
                        icon: "piggybank",
                        colors: Color.app.gradientSuccess,
                        trend: .up,
                        trendValue: "+5%"
                    )
                }
            }
            .padding()
        }
    }
}
