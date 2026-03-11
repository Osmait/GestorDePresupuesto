import SwiftUI

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

    var body: some View {
        GradientCard(colors: colors, cornerRadius: .xl, padding: .lg) {
            HStack(spacing: .md) {
                IconCircle(icon: icon, colors: colors)

                VStack(alignment: .leading, spacing: .xs) {
                    Text(title)
                        .font(.app(.caption))
                        .foregroundStyle(.white.opacity(0.8))

                    Text(value)
                        .font(.app(.title2))
                        .fontWeight(.bold)
                        .foregroundStyle(.white)
                        .lineLimit(1)
                        .minimumScaleFactor(0.5)

                    if let trend = trend, let trendValue = trendValue {
                        HStack(spacing: .xs) {
                            Image(systemName: trend == .up ? "arrow.up.right" : trend == .down ? "arrow.down.right" : "minus")
                                .font(.caption2)
                            Text(trendValue)
                                .font(.caption2)
                        }
                        .foregroundStyle(trend == .up ? .white : trend == .down ? .white.opacity(0.7) : .white.opacity(0.6))
                    }
                }

                Spacer()
            }
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
                .fill(.white.opacity(0.2))
                .frame(width: size, height: size)

            Image(systemName: icon)
                .font(.system(size: size * 0.45, weight: .semibold))
                .foregroundStyle(.white)
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
