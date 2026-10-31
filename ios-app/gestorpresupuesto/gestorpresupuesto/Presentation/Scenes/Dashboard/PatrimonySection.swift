import SwiftUI
import Charts

/// Net worth, in DOP: the backend's total and the parts it is made of.
struct PatrimonySection: View {
    let total: Double
    let accountsTotal: Double
    /// Positions plus broker cash.
    let investmentsTotal: Double
    let certificatesTotal: Double
    var loansReceivableTotal: Double = 0
    var creditCardDebt: Double = 0

    var totalPatrimony: Double { total }

    var body: some View {
        SurfaceCard {
            VStack(spacing: Spacing.md.rawValue) {
                Text("Patrimonio")
                    .font(.app(.headline))
                    .foregroundStyle(Color.app.textPrimary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Text(totalPatrimony.currencyFormatted)
                    .font(.app(.title2))
                    .fontWeight(.bold)
                    .foregroundStyle(Color.app.textPrimary)

                Chart {
                    if accountsTotal > 0 {
                        SectorMark(angle: .value("Cuentas", accountsTotal))
                            .foregroundStyle(Color.app.accent)
                    }
                    if investmentsTotal > 0 {
                        SectorMark(angle: .value("Inversiones", investmentsTotal))
                            .foregroundStyle(Color.app.success)
                    }
                    if certificatesTotal > 0 {
                        SectorMark(angle: .value("Certificados", certificatesTotal))
                            .foregroundStyle(Color.app.warning)
                    }
                    if loansReceivableTotal > 0 {
                        SectorMark(angle: .value("Préstamos", loansReceivableTotal))
                            .foregroundStyle(Color.app.textSecondary)
                    }
                }
                .frame(height: 160)
                // The legend below reads each part.
                .accessibilityHidden(true)

                HStack(spacing: Spacing.lg.rawValue) {
                    legendItem("Cuentas", color: Color.app.accent, value: accountsTotal)
                    legendItem("Inversiones", color: Color.app.success, value: investmentsTotal)
                    legendItem("Certificados", color: Color.app.warning, value: certificatesTotal)
                    if loansReceivableTotal > 0 {
                        legendItem("Préstamos", color: Color.app.textSecondary, value: loansReceivableTotal)
                    }
                }

                if creditCardDebt > 0 {
                    HStack {
                        Text("Menos deuda de tarjetas")
                            .font(.app(.caption))
                            .foregroundStyle(Color.app.textSecondary)
                        Spacer()
                        Text((-creditCardDebt).currencyFormatted)
                            .font(.app(.caption))
                            .fontWeight(.semibold)
                            .foregroundStyle(Color.app.error)
                    }
                }
            }
        }
    }

    private func legendItem(_ title: String, color: Color, value: Double) -> some View {
        VStack(spacing: 2) {
            HStack(spacing: 4) {
                Circle()
                    .fill(color)
                    .frame(width: 8, height: 8)
                Text(title)
                    .font(.caption2)
                    .foregroundStyle(Color.app.textSecondary)
            }
            Text(value.currencyFormatted)
                .font(.system(.caption2, weight: .semibold))
                .foregroundStyle(Color.app.textPrimary)
        }
    }
}
