import SwiftUI
import Charts

struct MonthlySummaryChart: View {
    let data: [MonthlySummary]

    var body: some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: Spacing.md.rawValue) {
                Text("Resumen Mensual")
                    .font(.app(.headline))
                    .foregroundStyle(Color.app.textPrimary)

                if data.isEmpty {
                    Text("Sin datos disponibles")
                        .font(.app(.caption))
                        .foregroundStyle(Color.app.textTertiary)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.vertical, Spacing.lg.rawValue)
                } else {
                    Chart {
                        ForEach(data) { item in
                            BarMark(
                                x: .value("Mes", item.month),
                                y: .value("Ingresos", item.totalIncome)
                            )
                            .foregroundStyle(by: .value("Tipo", "Ingresos"))
                            .position(by: .value("Tipo", "Ingresos"))

                            BarMark(
                                x: .value("Mes", item.month),
                                y: .value("Gastos", item.totalExpenses)
                            )
                            .foregroundStyle(by: .value("Tipo", "Gastos"))
                            .position(by: .value("Tipo", "Gastos"))
                        }
                    }
                    // Series styled by name so the legend tells income from expenses.
                    .chartForegroundStyleScale(["Ingresos": Color.app.success, "Gastos": Color.app.error])
                    .frame(height: 200)
                    .chartLegend(position: .bottom)
                    .accessibilityLabel("Ingresos y gastos por mes")
                }
            }
        }
    }
}
