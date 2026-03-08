import SwiftUI

struct CreditCardDetailView: View {
    let card: CreditCard
    @ObservedObject var viewModel: CreditCardsViewModel
    @State private var showPaymentSheet = false

    var body: some View {
        ZStack {
            Color.app.background.ignoresSafeArea()

            ScrollView {
                VStack(spacing: Spacing.lg.rawValue) {
                    CreditCardVisual(card: card)

                    // Balances
                    VStack(alignment: .leading, spacing: Spacing.md.rawValue) {
                        Text("Balances")
                            .font(.app(.headline))
                            .foregroundStyle(Color.app.textPrimary)

                        ForEach(card.balances) { balance in
                            SurfaceCard {
                                VStack(spacing: Spacing.sm.rawValue) {
                                    HStack {
                                        Text(balance.currency)
                                            .font(.app(.subheadline))
                                            .fontWeight(.semibold)
                                        Spacer()
                                        Text("\(Int(balance.utilizationPercent))%")
                                            .font(.app(.caption))
                                            .foregroundStyle(balance.utilizationPercent > 80 ? Color.app.error : Color.app.success)
                                    }

                                    GradientProgressBar(
                                        progress: balance.utilizationPercent / 100,
                                        height: 8,
                                        showLabel: false,
                                        isCritical: balance.utilizationPercent > 80
                                    )

                                    HStack {
                                        VStack(alignment: .leading) {
                                            Text("Balance")
                                                .font(.caption2)
                                                .foregroundStyle(Color.app.textTertiary)
                                            Text(balance.currentBalance.currencyFormatted)
                                                .font(.app(.subheadline))
                                                .fontWeight(.semibold)
                                        }
                                        Spacer()
                                        VStack(alignment: .trailing) {
                                            Text("Disponible")
                                                .font(.caption2)
                                                .foregroundStyle(Color.app.textTertiary)
                                            Text(balance.availableCredit.currencyFormatted)
                                                .font(.app(.subheadline))
                                                .foregroundStyle(Color.app.success)
                                        }
                                    }
                                }
                            }
                        }
                    }

                    // Dates
                    SurfaceCard {
                        HStack {
                            VStack(alignment: .leading) {
                                Text("Día de corte")
                                    .font(.caption2)
                                    .foregroundStyle(Color.app.textTertiary)
                                Text("Día \(card.cutDay)")
                                    .font(.app(.subheadline))
                                    .fontWeight(.medium)
                            }
                            Spacer()
                            VStack(alignment: .trailing) {
                                Text("Día de pago")
                                    .font(.caption2)
                                    .foregroundStyle(Color.app.textTertiary)
                                Text("Día \(card.dueDay)")
                                    .font(.app(.subheadline))
                                    .fontWeight(.medium)
                            }
                        }
                    }

                    // Payment History
                    VStack(alignment: .leading, spacing: Spacing.md.rawValue) {
                        Text("Historial de Pagos")
                            .font(.app(.headline))
                            .foregroundStyle(Color.app.textPrimary)

                        if viewModel.payments.isEmpty {
                            Text("Sin pagos registrados")
                                .font(.app(.caption))
                                .foregroundStyle(Color.app.textTertiary)
                                .frame(maxWidth: .infinity, alignment: .center)
                                .padding(.vertical, Spacing.lg.rawValue)
                        } else {
                            ForEach(viewModel.payments) { payment in
                                SurfaceCard {
                                    HStack {
                                        VStack(alignment: .leading) {
                                            Text(payment.currency)
                                                .font(.app(.caption))
                                                .foregroundStyle(Color.app.textSecondary)
                                            Text(payment.paymentDate)
                                                .font(.caption2)
                                                .foregroundStyle(Color.app.textTertiary)
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
                .padding(Spacing.lg.rawValue)
            }
        }
        .navigationTitle(card.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Pagar") { showPaymentSheet = true }
                    .fontWeight(.semibold)
            }
        }
        .sheet(isPresented: $showPaymentSheet) {
            CreditCardPaymentView(card: card, viewModel: viewModel)
        }
        .task {
            await viewModel.loadPayments(cardId: card.id)
        }
    }
}
