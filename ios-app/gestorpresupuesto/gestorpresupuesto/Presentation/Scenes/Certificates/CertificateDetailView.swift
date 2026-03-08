import SwiftUI

struct CertificateDetailView: View {
    let certificate: Certificate
    @ObservedObject var viewModel: CertificatesViewModel
    @State private var showSimulation = false

    var body: some View {
        ZStack {
            Color.app.background.ignoresSafeArea()

            ScrollView {
                VStack(spacing: Spacing.lg.rawValue) {
                    // Info Card
                    SurfaceCard {
                        VStack(spacing: Spacing.md.rawValue) {
                            HStack {
                                Text(certificate.bank)
                                    .font(.app(.title3))
                                    .fontWeight(.bold)
                                Spacer()
                                StatusBadge.forCertificateStatus(certificate.status)
                            }

                            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: Spacing.md.rawValue) {
                                infoCell("Capital", certificate.effectiveCapital.currencyFormatted)
                                infoCell("Tasa", "\(String(format: "%.2f", certificate.currentInterestRate))%")
                                infoCell("Impuesto", "\(String(format: "%.2f", certificate.currentTaxRate))%")
                                infoCell("Día de corte", "\(certificate.cutDay)")
                                infoCell("Tipo", certificate.interestType.displayName)
                                infoCell("Moneda", certificate.currency)
                            }

                            if certificate.reinvestInterest {
                                HStack {
                                    Image(systemName: "arrow.clockwise")
                                        .foregroundStyle(Color.app.success)
                                    Text("Reinversión de intereses activa")
                                        .font(.app(.caption))
                                        .foregroundStyle(Color.app.success)
                                }
                            }
                        }
                    }

                    // Projected Payment
                    if let projected = certificate.projectedPayment {
                        SurfaceCard {
                            VStack(spacing: Spacing.sm.rawValue) {
                                Text("Próximo Pago Proyectado")
                                    .font(.app(.subheadline))
                                    .fontWeight(.medium)

                                HStack {
                                    VStack {
                                        Text("Bruto")
                                            .font(.caption2)
                                            .foregroundStyle(Color.app.textTertiary)
                                        Text(projected.grossInterest.currencyFormatted)
                                            .font(.app(.subheadline))
                                    }
                                    Spacer()
                                    VStack {
                                        Text("Impuesto")
                                            .font(.caption2)
                                            .foregroundStyle(Color.app.textTertiary)
                                        Text(projected.taxWithheld.currencyFormatted)
                                            .font(.app(.subheadline))
                                            .foregroundStyle(Color.app.error)
                                    }
                                    Spacer()
                                    VStack {
                                        Text("Neto")
                                            .font(.caption2)
                                            .foregroundStyle(Color.app.textTertiary)
                                        Text(projected.netInterest.currencyFormatted)
                                            .font(.app(.subheadline))
                                            .fontWeight(.semibold)
                                            .foregroundStyle(Color.app.success)
                                    }
                                }
                            }
                        }
                    }

                    // Payment History
                    if let detail = viewModel.selectedCertificate {
                        VStack(alignment: .leading, spacing: Spacing.md.rawValue) {
                            Text("Historial de Pagos")
                                .font(.app(.headline))
                                .foregroundStyle(Color.app.textPrimary)

                            if detail.payments.isEmpty {
                                Text("Sin pagos registrados")
                                    .font(.app(.caption))
                                    .foregroundStyle(Color.app.textTertiary)
                                    .frame(maxWidth: .infinity, alignment: .center)
                                    .padding(.vertical, Spacing.lg.rawValue)
                            } else {
                                ForEach(detail.payments) { payment in
                                    SurfaceCard {
                                        HStack {
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text(payment.paymentDate)
                                                    .font(.app(.caption))
                                                Text("\(payment.periodStart) - \(payment.periodEnd)")
                                                    .font(.caption2)
                                                    .foregroundStyle(Color.app.textTertiary)
                                            }
                                            Spacer()
                                            Text(payment.netInterest.currencyFormatted)
                                                .font(.app(.subheadline))
                                                .fontWeight(.semibold)
                                                .foregroundStyle(Color.app.success)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                .padding(Spacing.lg.rawValue)
            }
        }
        .navigationTitle("Certificado")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Simular") { showSimulation = true }
            }
        }
        .sheet(isPresented: $showSimulation) {
            CertificateSimulationView(certificate: certificate, viewModel: viewModel)
        }
        .task {
            await viewModel.loadCertificateDetail(certificate.id)
        }
    }

    private func infoCell(_ title: String, _ value: String) -> some View {
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
