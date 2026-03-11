import SwiftUI

struct CreditCardsListView: View {
    @StateObject private var viewModel = CreditCardsViewModel()
    @State private var showAddCard = false
    @State private var showDeleteConfirmation = false
    @State private var cardToDelete: CreditCard?

    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: Spacing.lg.rawValue) {
                        if viewModel.creditCards.isEmpty && viewModel.isLoading {
                            CreditCardsSkeleton()
                        } else {
                            if !viewModel.isLoading, let summary = viewModel.summary {
                                summarySection(summary)
                            }

                            if viewModel.creditCards.isEmpty && !viewModel.isLoading {
                                EmptyStateView(
                                    icon: "creditcard",
                                    title: "Sin tarjetas",
                                    message: "Agrega tu primera tarjeta de crédito"
                                )
                            } else {
                                LazyVStack(spacing: Spacing.md.rawValue) {
                                    ForEach(viewModel.creditCards) { card in
                                        NavigationLink(destination: CreditCardDetailView(card: card, viewModel: viewModel)) {
                                            creditCardRow(card)
                                        }
                                        .contextMenu {
                                            Button(role: .destructive) {
                                                cardToDelete = card
                                                showDeleteConfirmation = true
                                            } label: {
                                                Label("Eliminar", systemImage: "trash")
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
            .navigationTitle("Tarjetas de Crédito")
            .notificationToolbar()
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showAddCard = true } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showAddCard) {
                AddCreditCardView(viewModel: viewModel)
            }
            .refreshable { await viewModel.loadCreditCards() }
            .task { await viewModel.loadCreditCards() }
            .errorBanner(isPresented: $viewModel.showErrorBanner, message: viewModel.errorBannerMessage)
            .toast(isPresented: $viewModel.showToast, type: viewModel.toastType, message: viewModel.toastMessage)
            .deleteConfirmation(isPresented: $showDeleteConfirmation, itemName: "tarjeta de crédito") {
                if let card = cardToDelete {
                    Task { await viewModel.deleteCreditCard(card.id) }
                }
            }
        }
    }

    private func summarySection(_ summary: CreditCardSummary) -> some View {
        VStack(spacing: Spacing.sm.rawValue) {
            VStack(spacing: Spacing.md.rawValue) {
                StatCard(
                    title: "Tarjetas",
                    value: "\(summary.totalCards)",
                    icon: "creditcard.fill",
                    colors: [Color.app.accent, Color.app.accent.opacity(0.7)]
                )

                if let dopDebt = summary.totalDebt["DOP"] {
                    StatCard(
                        title: "Deuda DOP",
                        value: dopDebt.currencyFormatted,
                        icon: "dollarsign.circle",
                        colors: [Color.app.error, Color.app.error.opacity(0.7)]
                    )
                }
            }
        }
    }

    private func creditCardRow(_ card: CreditCard) -> some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: Spacing.sm.rawValue) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(card.name)
                            .font(.app(.headline))
                            .foregroundStyle(Color.app.textPrimary)
                        Text(card.bank)
                            .font(.app(.caption))
                            .foregroundStyle(Color.app.textSecondary)
                    }
                    Spacer()
                    if !card.lastFourDigits.isEmpty {
                        Text("•••• \(card.lastFourDigits)")
                            .font(.app(.caption))
                            .foregroundStyle(Color.app.textTertiary)
                    }
                }

                ForEach(card.balances) { balance in
                    HStack {
                        Text(balance.currency)
                            .font(.app(.caption))
                            .foregroundStyle(Color.app.textSecondary)
                        Spacer()
                        Text(balance.currentBalance.currencyFormatted)
                            .font(.app(.subheadline))
                            .fontWeight(.semibold)
                            .foregroundStyle(Color.app.textPrimary)
                    }

                    GradientProgressBar(
                        progress: balance.utilizationPercent / 100,
                        height: 6,
                        showLabel: false,
                        isCritical: balance.utilizationPercent > 80
                    )
                }
            }
        }
    }
}
