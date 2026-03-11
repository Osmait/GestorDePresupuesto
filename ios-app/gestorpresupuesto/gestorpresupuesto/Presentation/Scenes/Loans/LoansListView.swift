import SwiftUI

struct LoansListView: View {
    @StateObject private var viewModel = LoansViewModel()
    @State private var showAddLoan = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: Spacing.lg.rawValue) {
                        if viewModel.loans.isEmpty && viewModel.isLoading {
                            LoansSkeleton()
                        } else {
                            if !viewModel.isLoading, let summary = viewModel.summary {
                                VStack(spacing: Spacing.md.rawValue) {
                                    StatCard(
                                        title: "Activos",
                                        value: "\(summary.activeLoans)",
                                        icon: "doc.text.fill",
                                        colors: [Color.app.accent, Color.app.accent.opacity(0.7)]
                                    )
                                    StatCard(
                                        title: "Pendiente",
                                        value: summary.totalPending.currencyFormatted,
                                        icon: "hourglass",
                                        colors: [Color.app.warning, Color.app.warning.opacity(0.7)]
                                    )
                                    StatCard(
                                        title: "Cobrado",
                                        value: summary.totalCollected.currencyFormatted,
                                        icon: "checkmark.circle.fill",
                                        colors: [Color.app.success, Color.app.success.opacity(0.7)]
                                    )
                                    StatCard(
                                        title: "Intereses",
                                        value: summary.totalInterestEarned.currencyFormatted,
                                        icon: "percent",
                                        colors: [Color.app.accent, Color.app.accent.opacity(0.7)]
                                    )
                                }
                            }

                            if viewModel.loans.isEmpty && !viewModel.isLoading {
                                EmptyStateView(
                                    icon: "doc.text",
                                    title: "Sin préstamos",
                                    message: "Registra tu primer préstamo"
                                )
                            } else {
                                LazyVStack(spacing: Spacing.md.rawValue) {
                                    ForEach(viewModel.loans) { loan in
                                        NavigationLink(destination: LoanDetailView(loan: loan, viewModel: viewModel)) {
                                            loanRow(loan)
                                        }
                                    }
                                }
                            }
                        }
                    }
                    .padding(Spacing.lg.rawValue)
                }
            }
            .navigationTitle("Préstamos")
            .notificationToolbar()
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button { showAddLoan = true } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showAddLoan) {
                AddLoanView(viewModel: viewModel)
            }
            .refreshable { await viewModel.loadLoans() }
            .task { await viewModel.loadLoans() }
            .errorBanner(isPresented: $viewModel.showErrorBanner, message: viewModel.errorBannerMessage)
            .toast(isPresented: $viewModel.showToast, type: viewModel.toastType, message: viewModel.toastMessage)
        }
    }

    private func loanRow(_ loan: Loan) -> some View {
        SurfaceCard {
            VStack(alignment: .leading, spacing: Spacing.sm.rawValue) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(loan.borrowerName)
                            .font(.app(.headline))
                            .foregroundStyle(Color.app.textPrimary)
                        Text(loan.currency)
                            .font(.app(.caption))
                            .foregroundStyle(Color.app.textSecondary)
                    }
                    Spacer()
                    StatusBadge.forLoanStatus(loan.status)
                }

                GradientProgressBar(
                    progress: loan.progressPercent,
                    height: 6,
                    showLabel: false
                )

                HStack {
                    Text("Pendiente")
                        .font(.caption2)
                        .foregroundStyle(Color.app.textTertiary)
                    Spacer()
                    Text(loan.pendingAmount.currencyFormatted)
                        .font(.app(.subheadline))
                        .fontWeight(.semibold)
                        .foregroundStyle(Color.app.textPrimary)
                }
            }
        }
    }
}
