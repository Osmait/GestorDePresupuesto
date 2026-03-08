import SwiftUI
import Charts

struct CertificateSimulationView: View {
    @Environment(\.dismiss) private var dismiss
    let certificate: Certificate
    @ObservedObject var viewModel: CertificatesViewModel

    @State private var months = "12"
    @State private var customCapital = ""
    @State private var customRate = ""

    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: Spacing.lg.rawValue) {
                        SurfaceCard {
                            VStack(spacing: Spacing.sm.rawValue) {
                                Text("Parámetros de simulación")
                                    .font(.app(.headline))

                                FormField(title: "Meses", icon: "calendar", placeholder: "12", text: $months, keyboardType: .numberPad)
                                FormField(title: "Capital (opcional)", icon: "dollarsign.circle", placeholder: "\(String(format: "%.2f", certificate.effectiveCapital))", text: $customCapital, keyboardType: .decimalPad)
                                FormField(title: "Tasa (opcional)", icon: "percent", placeholder: "\(String(format: "%.2f", certificate.currentInterestRate))", text: $customRate, keyboardType: .decimalPad)
                            }
                        }

                        PrimaryButton("Simular", isLoading: viewModel.isLoading) {
                            Task { await runSimulation() }
                        }

                        if let result = viewModel.simulationResult {
                            SurfaceCard {
                                VStack(spacing: Spacing.md.rawValue) {
                                    Text("Resultados")
                                        .font(.app(.headline))

                                    HStack {
                                        VStack {
                                            Text("Interés Bruto")
                                                .font(.caption2)
                                                .foregroundStyle(Color.app.textTertiary)
                                            Text(result.totals.grossInterest.currencyFormatted)
                                                .font(.app(.subheadline))
                                                .fontWeight(.semibold)
                                        }
                                        Spacer()
                                        VStack {
                                            Text("Impuesto")
                                                .font(.caption2)
                                                .foregroundStyle(Color.app.textTertiary)
                                            Text(result.totals.taxWithheld.currencyFormatted)
                                                .font(.app(.subheadline))
                                                .foregroundStyle(Color.app.error)
                                        }
                                        Spacer()
                                        VStack {
                                            Text("Interés Neto")
                                                .font(.caption2)
                                                .foregroundStyle(Color.app.textTertiary)
                                            Text(result.totals.netInterest.currencyFormatted)
                                                .font(.app(.subheadline))
                                                .fontWeight(.bold)
                                                .foregroundStyle(Color.app.success)
                                        }
                                    }

                                    if !result.payments.isEmpty {
                                        Chart {
                                            ForEach(Array(result.payments.enumerated()), id: \.offset) { index, payment in
                                                BarMark(
                                                    x: .value("Mes", index + 1),
                                                    y: .value("Neto", payment.netInterest)
                                                )
                                                .foregroundStyle(Color.app.success)
                                            }
                                        }
                                        .frame(height: 200)
                                    }
                                }
                            }
                        }
                    }
                    .padding(Spacing.lg.rawValue)
                }
            }
            .navigationTitle("Simulación")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cerrar") { dismiss() }
                }
            }
        }
    }

    private func runSimulation() async {
        let request = SimulatePaymentRequest(
            capital: Double(customCapital),
            rate: Double(customRate),
            taxRate: nil,
            months: Int(months)
        )
        await viewModel.simulate(id: certificate.id, request: request)
    }
}
