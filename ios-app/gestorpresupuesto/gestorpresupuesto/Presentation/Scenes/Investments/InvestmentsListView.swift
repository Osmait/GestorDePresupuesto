import SwiftUI

struct InvestmentsListView: View {
    @StateObject private var viewModel = InvestmentsViewModel()
    @State private var showAddInvestment = false
    @State private var showFundBroker = false
    @State private var showDeleteConfirmation = false
    @State private var investmentToDelete: Investment?

    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: Spacing.lg.rawValue) {
                        if viewModel.investments.isEmpty && viewModel.isLoading {
                            InvestmentsSkeleton()
                        } else {
                            // Portfolio Summary
                            if !viewModel.investments.isEmpty {
                                VStack(spacing: Spacing.md.rawValue) {
                                    StatCard(
                                        title: "Valor Total",
                                        value: viewModel.totalPortfolioValue.currencyFormatted,
                                        icon: "chart.pie.fill",
                                        colors: [Color.app.accent, Color.app.accent.opacity(0.7)]
                                    )

                                    StatCard(
                                        title: "Ganancia/Pérdida",
                                        value: viewModel.totalGainLoss.currencyFormatted,
                                        icon: viewModel.totalGainLoss >= 0 ? "arrow.up.right" : "arrow.down.right",
                                        colors: viewModel.totalGainLoss >= 0
                                            ? [Color.app.success, Color.app.success.opacity(0.7)]
                                            : [Color.app.error, Color.app.error.opacity(0.7)],
                                        trend: viewModel.totalGainLoss >= 0 ? .up : .down
                                    )
                                }
                            }

                            // Funding Balances
                            if !viewModel.fundingBalances.isEmpty {
                                SurfaceCard {
                                    VStack(alignment: .leading, spacing: Spacing.sm.rawValue) {
                                        Text("Saldos de fondeo")
                                            .font(.app(.subheadline))
                                            .fontWeight(.medium)
                                        ForEach(viewModel.fundingBalances, id: \.currency) { balance in
                                            HStack {
                                                Text(balance.currency)
                                                    .font(.app(.caption))
                                                Spacer()
                                                Text(balance.available.currencyFormatted)
                                                    .font(.app(.subheadline))
                                                    .fontWeight(.semibold)
                                            }
                                        }
                                    }
                                }
                            }

                            // Type Filter
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: Spacing.sm.rawValue) {
                                    filterChip("Todos", isSelected: viewModel.selectedTypeFilter == nil) {
                                        viewModel.selectedTypeFilter = nil
                                    }
                                    ForEach(InvestmentType.allCases, id: \.self) { type in
                                        filterChip(type.displayName, isSelected: viewModel.selectedTypeFilter == type) {
                                            viewModel.selectedTypeFilter = type
                                        }
                                    }
                                }
                            }

                            if viewModel.filteredInvestments.isEmpty && !viewModel.isLoading {
                                EmptyStateView(
                                    icon: "chart.line.uptrend.xyaxis",
                                    title: "Sin inversiones",
                                    message: "Agrega tu primera inversión"
                                )
                            } else {
                                LazyVStack(spacing: Spacing.md.rawValue) {
                                    ForEach(viewModel.filteredInvestments) { investment in
                                        NavigationLink(destination: InvestmentDetailView(investment: investment, viewModel: viewModel)) {
                                            investmentRow(investment)
                                        }
                                        .contextMenu {
                                            Button(role: .destructive) {
                                                investmentToDelete = investment
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
            .navigationTitle("Inversiones")
            .notificationToolbar()
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button { showAddInvestment = true } label: {
                            Label("Nueva Inversión", systemImage: "plus")
                        }
                        Button { showFundBroker = true } label: {
                            Label("Fondear Broker", systemImage: "arrow.right.circle")
                        }
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showAddInvestment) {
                AddInvestmentView(viewModel: viewModel)
            }
            .sheet(isPresented: $showFundBroker) {
                FundBrokerView(viewModel: viewModel)
            }
            .refreshable { await viewModel.loadInvestments() }
            .task { await viewModel.loadInvestments() }
            .errorBanner(isPresented: $viewModel.showErrorBanner, message: viewModel.errorBannerMessage)
            .toast(isPresented: $viewModel.showToast, type: viewModel.toastType, message: viewModel.toastMessage)
            .deleteConfirmation(isPresented: $showDeleteConfirmation, itemName: "inversión") {
                if let investment = investmentToDelete {
                    Task { await viewModel.deleteInvestment(investment.id) }
                }
            }
        }
    }

    private func filterChip(_ title: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button {
            action()
            HapticManager.shared.selection()
        } label: {
            Text(title)
                .font(.app(.caption))
                .fontWeight(isSelected ? .semibold : .regular)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? Color.app.accent : Color.app.surface)
                .foregroundStyle(isSelected ? .white : Color.app.textSecondary)
                .clipShape(Capsule())
        }
    }

    private func investmentRow(_ investment: Investment) -> some View {
        SurfaceCard {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Image(systemName: investment.type.icon)
                            .font(.caption)
                            .foregroundStyle(Color.app.accent)
                        Text(investment.symbol)
                            .font(.app(.headline))
                            .foregroundStyle(Color.app.textPrimary)
                    }
                    Text(investment.name)
                        .font(.app(.caption))
                        .foregroundStyle(Color.app.textSecondary)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 4) {
                    Text(investment.totalValue.currencyFormatted)
                        .font(.app(.subheadline))
                        .fontWeight(.semibold)
                    GainLossIndicator(value: investment.gainLoss, percent: investment.gainLossPercent)
                }
            }
        }
    }
}
