import SwiftUI

/// "Inicio" tab root (MainTabView wraps it in a NavigationStack). Charts live
/// in the Análisis tab; this screen answers "how am I doing this month?".
struct DashboardView: View {
    @StateObject private var viewModel = DashboardViewModel()
    @State private var showSearch = false
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    var onOpenMonthlyPlan: () -> Void = {}

    var body: some View {
        ZStack {
            Color.app.background.ignoresSafeArea()

            ScrollView {
                if viewModel.isLoading && viewModel.accounts.isEmpty {
                    DashboardSkeleton()
                } else if let error = viewModel.error, viewModel.accounts.isEmpty {
                    EmptyStateView(
                        icon: "exclamationmark.triangle",
                        title: "Error al cargar",
                        message: error,
                        actionTitle: "Reintentar"
                    ) {
                        Task { await viewModel.refresh() }
                    }
                } else {
                    content
                        .padding(.horizontal, .lg)
                        .padding(.bottom, .xl)
                }
            }
            .refreshable {
                await viewModel.refresh()
            }
            .errorBanner(isPresented: $viewModel.showErrorBanner, message: viewModel.errorBannerMessage)
        }
        .navigationTitle("Inicio")
        .notificationToolbar()
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showSearch = true } label: {
                    Image(systemName: "magnifyingglass")
                }
                .accessibilityLabel("Buscar")
            }
        }
        .sheet(isPresented: $showSearch) {
            SearchView()
        }
        .task {
            if viewModel.accounts.isEmpty {
                await viewModel.loadAll()
            }
        }
    }
}

extension DashboardView {
    /// iPad (regular width): the month on the left, budgets and recent
    /// activity on the right. iPhone: one column.
    @ViewBuilder
    fileprivate var content: some View {
        if horizontalSizeClass == .regular {
            HStack(alignment: .top, spacing: .xl) {
                VStack(alignment: .leading, spacing: .lg) {
                    monthOverview
                    patrimony
                }
                .frame(maxWidth: .infinity, alignment: .top)

                VStack(alignment: .leading, spacing: .lg) {
                    activity
                }
                .frame(maxWidth: .infinity, alignment: .top)
                .padding(.top, .xs)
            }
        } else {
            LazyVStack(alignment: .leading, spacing: .lg) {
                monthOverview
                activity
                patrimony
            }
        }
    }

    @ViewBuilder
    private var monthOverview: some View {
        BalanceHeader(
            totalBalance: viewModel.totalBalance,
            accountsCount: viewModel.accounts.count
        )

        HStack(spacing: .md) {
            StatCard(
                title: "Ingresos",
                value: viewModel.totalIncome.currencyFormatted,
                icon: "arrow.up.right",
                colors: Color.app.gradientIncome
            )
            StatCard(
                title: "Gastos",
                value: abs(viewModel.totalExpenses).currencyFormatted,
                icon: "arrow.down.right",
                colors: Color.app.gradientExpense
            )
        }

        if let summary = viewModel.monthlyPlanSummary {
            Button(action: onOpenMonthlyPlan) {
                MonthlyPlanDashboardCard(summary: summary, nextBill: viewModel.nextBill)
            }
            .buttonStyle(.plain)
        }
    }

    @ViewBuilder
    private var activity: some View {
        if !viewModel.budgets.isEmpty {
            BudgetsSection(budgets: viewModel.budgets)
        }

        if !viewModel.recentTransactions.isEmpty {
            RecentTransactionsSection(transactions: viewModel.recentTransactions)
        }
    }

    @ViewBuilder
    private var patrimony: some View {
        if viewModel.investmentsTotal + viewModel.certificatesTotal > 0 {
            PatrimonySection(
                accountsTotal: viewModel.totalBalance,
                investmentsTotal: viewModel.investmentsTotal,
                certificatesTotal: viewModel.certificatesTotal
            )
        }
    }
}

// MARK: - Balance

struct BalanceHeader: View {
    let totalBalance: Double
    let accountsCount: Int

    var body: some View {
        VStack(alignment: .leading, spacing: .xs) {
            Text("Balance total")
                .font(.app(.footnote))
                .fontWeight(.medium)
                .foregroundStyle(Color.app.textSecondary)
            AmountText(value: totalBalance, tone: totalBalance < 0 ? .negative : .neutral)
                .font(.system(size: 36, weight: .semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.5)
            Text(accountsCount == 1 ? "En 1 cuenta" : "En \(accountsCount) cuentas")
                .font(.app(.footnote))
                .foregroundStyle(Color.app.textSecondary)
        }
        .padding(.top, .xs)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Monthly plan

struct MonthlyPlanDashboardCard: View {
    let summary: MonthlyPlanSummary
    let nextBill: MonthlyPlanItem?

    var body: some View {
        SurfaceCard(cornerRadius: .lg, padding: .lg) {
            VStack(alignment: .leading, spacing: .md) {
                HStack {
                    Text("Plan del mes")
                        .font(.app(.subheadline))
                        .fontWeight(.semibold)
                        .foregroundStyle(Color.app.textPrimary)
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.footnote.weight(.semibold))
                        .foregroundStyle(Color.app.textSecondary)
                        .accessibilityHidden(true)
                }

                HStack(alignment: .firstTextBaseline) {
                    Text("Disponible después de lo fijo")
                        .font(.app(.footnote))
                        .foregroundStyle(Color.app.textSecondary)
                    Spacer()
                    AmountText(value: summary.available, tone: summary.isOvercommitted ? .negative : .positive)
                        .font(.app(.headline))
                }

                ProgressView(value: min(max(summary.committedPercentage / 100, 0), 1))
                    .tint(summary.isOvercommitted ? Color.app.error : Color.app.accent)

                HStack {
                    Text("\(Int(summary.committedPercentage.rounded()))% comprometido")
                    Spacer()
                    if let nextBill, let day = nextBill.dayOfMonth {
                        Text("Próximo: \(nextBill.name) · día \(day)")
                            .lineLimit(1)
                    }
                }
                .font(.app(.caption))
                .foregroundStyle(Color.app.textSecondary)
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityHint("Abre el plan mensual")
    }
}

// MARK: - Budgets

struct BudgetsSection: View {
    let budgets: [BudgetResponse]

    /// The ones closest to (or over) their limit first.
    private var topBudgets: [BudgetResponse] {
        Array(budgets.sorted { $0.spent / max($0.amount, 1) > $1.spent / max($1.amount, 1) }.prefix(3))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: .sm) {
            SectionTitle("Presupuestos")

            SurfaceCard(cornerRadius: .lg, padding: .lg) {
                VStack(spacing: .md) {
                    ForEach(Array(topBudgets.enumerated()), id: \.element.id) { index, budget in
                        if index > 0 {
                            Divider().overlay(Color.app.border)
                        }
                        BudgetLine(budget: budget)
                    }
                }
            }
        }
    }
}

private struct BudgetLine: View {
    let budget: BudgetResponse

    private var ratio: Double {
        budget.amount > 0 ? budget.spent / budget.amount : 0
    }

    /// Same thresholds as the web: amber from 80%, red over 100%.
    private var tone: Color {
        if budget.isOverBudget { return Color.app.error }
        if ratio >= 0.8 { return Color.app.warning }
        return Color.app.accent
    }

    var body: some View {
        VStack(alignment: .leading, spacing: .sm) {
            HStack {
                Text(budget.displayName)
                    .font(.app(.subheadline))
                    .foregroundStyle(Color.app.textPrimary)
                Spacer()
                Text("\(Int((ratio * 100).rounded()))%")
                    .font(.app(.subheadline))
                    .fontWeight(.medium)
                    .monospacedDigit()
                    .foregroundStyle(ratio >= 0.8 ? tone : Color.app.textSecondary)
            }
            ProgressView(value: min(ratio, 1))
                .tint(tone)
            Text("\(budget.spent.currencyFormatted) de \(budget.amount.currencyFormatted)")
                .font(.app(.caption))
                .monospacedDigit()
                .foregroundStyle(Color.app.textSecondary)
        }
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Recent transactions

struct RecentTransactionsSection: View {
    let transactions: [Transaction]

    var body: some View {
        VStack(alignment: .leading, spacing: .sm) {
            SectionTitle("Recientes")

            SurfaceCard(cornerRadius: .lg, padding: .lg) {
                VStack(spacing: .md) {
                    ForEach(Array(transactions.prefix(5).enumerated()), id: \.element.id) { index, transaction in
                        if index > 0 {
                            Divider().overlay(Color.app.border)
                        }
                        TransactionLine(transaction: transaction)
                    }
                }
            }
        }
    }
}

/// A transaction as a bare line, for use inside a card or a List row.
struct TransactionLine: View {
    let transaction: Transaction

    var body: some View {
        HStack(spacing: .md) {
            Text(transaction.name.prefix(1).uppercased())
                .font(.app(.subheadline))
                .fontWeight(.semibold)
                .foregroundStyle(Color.app.textSecondary)
                .frame(width: 36, height: 36)
                .background(Color.app.surfaceSecondary, in: Circle())
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 2) {
                Text(transaction.name)
                    .font(.app(.callout))
                    .foregroundStyle(Color.app.textPrimary)
                    .lineLimit(1)
                Text(transaction.createdAt.shortFormatted)
                    .font(.app(.footnote))
                    .foregroundStyle(Color.app.textSecondary)
            }

            Spacer(minLength: .sm)

            AmountText(
                value: transaction.isIncome ? abs(transaction.amount) : -abs(transaction.amount),
                currency: transaction.currency ?? "DOP",
                tone: .auto,
                signed: true
            )
            .font(.app(.callout))
            .fontWeight(.medium)
        }
        .accessibilityElement(children: .combine)
    }
}

/// A transaction in its own card (list screens with one row per card).
struct TransactionRow: View {
    let transaction: Transaction

    var body: some View {
        SurfaceCard(cornerRadius: .lg, padding: .md) {
            TransactionLine(transaction: transaction)
        }
    }
}

// MARK: - Section title

struct SectionTitle: View {
    let title: String

    init(_ title: String) {
        self.title = title
    }

    var body: some View {
        Text(title)
            .font(.app(.title3))
            .foregroundStyle(Color.app.textPrimary)
            .padding(.horizontal, .xs)
            .accessibilityAddTraits(.isHeader)
    }
}

#Preview {
    NavigationStack {
        DashboardView()
    }
}
