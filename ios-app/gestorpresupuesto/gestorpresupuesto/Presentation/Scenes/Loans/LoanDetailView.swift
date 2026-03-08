import SwiftUI

struct LoanDetailView: View {
    let loan: Loan
    @ObservedObject var viewModel: LoansViewModel
    @State private var showPaymentSheet = false

    var body: some View {
        ZStack {
            Color.app.background.ignoresSafeArea()

            ScrollView {
                VStack(spacing: Spacing.lg.rawValue) {
                    // Summary
                    SurfaceCard {
                        VStack(spacing: Spacing.md.rawValue) {
                            HStack {
                                Text(loan.borrowerName)
                                    .font(.app(.title3))
                                    .fontWeight(.bold)
                                Spacer()
                                StatusBadge.forLoanStatus(loan.status)
                            }

                            GradientProgressBar(
                                progress: loan.progressPercent,
                                height: 8,
                                showLabel: false
                            )

                            HStack {
                                VStack(alignment: .leading) {
                                    Text("Principal")
                                        .font(.caption2)
                                        .foregroundStyle(Color.app.textTertiary)
                                    Text(loan.principalAmount.currencyFormatted)
                                        .font(.app(.subheadline))
                                        .fontWeight(.semibold)
                                }
                                Spacer()
                                VStack(alignment: .center) {
                                    Text("Interés")
                                        .font(.caption2)
                                        .foregroundStyle(Color.app.textTertiary)
                                    Text(loan.totalInterest.currencyFormatted)
                                        .font(.app(.subheadline))
                                }
                                Spacer()
                                VStack(alignment: .trailing) {
                                    Text("Pendiente")
                                        .font(.caption2)
                                        .foregroundStyle(Color.app.textTertiary)
                                    Text(loan.pendingAmount.currencyFormatted)
                                        .font(.app(.subheadline))
                                        .fontWeight(.semibold)
                                        .foregroundStyle(Color.app.error)
                                }
                            }
                        }
                    }

                    // Installments
                    if let details = viewModel.selectedLoanDetails {
                        VStack(alignment: .leading, spacing: Spacing.md.rawValue) {
                            Text("Cuotas")
                                .font(.app(.headline))
                                .foregroundStyle(Color.app.textPrimary)

                            ForEach(details.installments) { installment in
                                SurfaceCard {
                                    HStack {
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text("Cuota #\(installment.installmentNumber)")
                                                .font(.app(.subheadline))
                                                .fontWeight(.medium)
                                            Text(installment.dueDate)
                                                .font(.caption2)
                                                .foregroundStyle(Color.app.textTertiary)
                                        }
                                        Spacer()
                                        VStack(alignment: .trailing, spacing: 2) {
                                            Text(installment.expectedAmount.currencyFormatted)
                                                .font(.app(.subheadline))
                                                .fontWeight(.semibold)
                                            Text(installment.status.rawValue.capitalized)
                                                .font(.caption2)
                                                .foregroundStyle(installment.status == .paid ? Color.app.success : Color.app.textSecondary)
                                        }
                                    }
                                }
                            }
                        }

                        // Payments
                        VStack(alignment: .leading, spacing: Spacing.md.rawValue) {
                            Text("Pagos Recibidos")
                                .font(.app(.headline))
                                .foregroundStyle(Color.app.textPrimary)

                            if details.payments.isEmpty {
                                Text("Sin pagos registrados")
                                    .font(.app(.caption))
                                    .foregroundStyle(Color.app.textTertiary)
                                    .frame(maxWidth: .infinity, alignment: .center)
                                    .padding(.vertical, Spacing.lg.rawValue)
                            } else {
                                ForEach(details.payments) { payment in
                                    SurfaceCard {
                                        HStack {
                                            VStack(alignment: .leading, spacing: 2) {
                                                Text(payment.paymentDate)
                                                    .font(.app(.caption))
                                                    .foregroundStyle(Color.app.textSecondary)
                                                if !payment.notes.isEmpty {
                                                    Text(payment.notes)
                                                        .font(.caption2)
                                                        .foregroundStyle(Color.app.textTertiary)
                                                }
                                            }
                                            Spacer()
                                            Text(payment.amount.currencyFormatted)
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
        .navigationTitle("Préstamo")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if loan.status == .active {
                ToolbarItem(placement: .primaryAction) {
                    Button("Cobrar") { showPaymentSheet = true }
                        .fontWeight(.semibold)
                }
            }
        }
        .sheet(isPresented: $showPaymentSheet) {
            RegisterLoanPaymentView(loan: loan, viewModel: viewModel)
        }
        .task {
            await viewModel.loadLoanDetails(loan.id)
        }
    }
}
