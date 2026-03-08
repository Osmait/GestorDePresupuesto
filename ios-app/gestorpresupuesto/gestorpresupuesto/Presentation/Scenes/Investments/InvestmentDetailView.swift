import SwiftUI

struct InvestmentDetailView: View {
    let investment: Investment
    @ObservedObject var viewModel: InvestmentsViewModel

    var body: some View {
        ZStack {
            Color.app.background.ignoresSafeArea()

            ScrollView {
                VStack(spacing: Spacing.lg.rawValue) {
                    // Header
                    VStack(spacing: Spacing.sm.rawValue) {
                        Image(systemName: investment.type.icon)
                            .font(.largeTitle)
                            .foregroundStyle(Color.app.accent)

                        Text(investment.symbol)
                            .font(.app(.title2))
                            .fontWeight(.bold)

                        Text(investment.name)
                            .font(.app(.subheadline))
                            .foregroundStyle(Color.app.textSecondary)

                        GainLossIndicator(value: investment.gainLoss, percent: investment.gainLossPercent)
                    }
                    .frame(maxWidth: .infinity)

                    // Details
                    SurfaceCard {
                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: Spacing.md.rawValue) {
                            detailCell("Cantidad", String(format: "%.4f", investment.quantity))
                            detailCell("Precio Compra", investment.purchasePrice.currencyFormatted)
                            detailCell("Precio Actual", investment.currentPrice.currencyFormatted)
                            detailCell("Costo Total", investment.totalCost.currencyFormatted)
                            detailCell("Valor Actual", investment.totalValue.currencyFormatted)
                            detailCell("Tipo", investment.type.displayName)
                        }
                    }

                    // P&L
                    SurfaceCard {
                        VStack(spacing: Spacing.sm.rawValue) {
                            Text("Ganancia / Pérdida")
                                .font(.app(.subheadline))
                                .fontWeight(.medium)

                            Text(investment.gainLoss.currencyFormatted)
                                .font(.app(.title2))
                                .fontWeight(.bold)
                                .foregroundStyle(investment.isProfit ? Color.app.success : Color.app.error)

                            Text("\(String(format: "%.2f", investment.gainLossPercent))%")
                                .font(.app(.subheadline))
                                .foregroundStyle(investment.isProfit ? Color.app.success : Color.app.error)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
                .padding(Spacing.lg.rawValue)
            }
        }
        .navigationTitle(investment.symbol)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func detailCell(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.caption2)
                .foregroundStyle(Color.app.textTertiary)
            Text(value)
                .font(.app(.subheadline))
                .fontWeight(.medium)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
