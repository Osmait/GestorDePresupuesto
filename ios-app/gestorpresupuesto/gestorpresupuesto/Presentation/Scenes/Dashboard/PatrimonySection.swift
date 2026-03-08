import SwiftUI
import Charts

struct PatrimonySection: View {
    let accountsTotal: Double
    let investmentsTotal: Double
    let certificatesTotal: Double

    var totalPatrimony: Double {
        accountsTotal + investmentsTotal + certificatesTotal
    }

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
                }
                .frame(height: 160)

                HStack(spacing: Spacing.lg.rawValue) {
                    legendItem("Cuentas", color: Color.app.accent, value: accountsTotal)
                    legendItem("Inversiones", color: Color.app.success, value: investmentsTotal)
                    legendItem("Certificados", color: Color.app.warning, value: certificatesTotal)
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
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(Color.app.textPrimary)
        }
    }
}
