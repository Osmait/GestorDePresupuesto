import SwiftUI
import Charts

struct DashboardView: View {
    @StateObject private var viewModel = DashboardViewModel()
    @State private var showContent = false
    
    var body: some View {
        NavigationStack {
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
                    VStack(spacing: .lg) {
                        BalanceStatCard(
                            totalBalance: viewModel.totalBalance,
                            income: viewModel.totalIncome,
                            expenses: viewModel.totalExpenses
                        )
                        .transition(.opacity.combined(with: .scale(scale: 0.95)))
                        
                        if !viewModel.categoryExpenses.isEmpty {
                            ExpensesByCategoryCard(expenses: viewModel.categoryExpenses)
                                .transition(.opacity.combined(with: .move(edge: .leading)))
                        }
                        
                        if !viewModel.budgets.isEmpty {
                            BudgetsSection(budgets: viewModel.budgets)
                                .transition(.opacity)
                        }
                        
                        if !viewModel.recentTransactions.isEmpty {
                            RecentTransactionsSection(transactions: viewModel.recentTransactions)
                                .transition(.opacity)
                        }
                        
                        Spacer(minLength: 100)
                    }
                    .padding()
                }
            }
            .refreshable {
                await viewModel.refresh()
            }
            .errorBanner(isPresented: $viewModel.showErrorBanner, message: viewModel.errorBannerMessage)
        }
        .navigationTitle("Dashboard")
        .task {
            if viewModel.accounts.isEmpty {
                await viewModel.loadAll()
            }
        }
        }
    }
}

struct ExpensesByCategoryCard: View {
    let expenses: [CategoryExpense]
    
    var body: some View {
        GlassCard(cornerRadius: .xl, padding: .lg) {
            VStack(alignment: .leading, spacing: .md) {
                Text("Gastos por Categoría")
                    .font(.app(.headline))
                    .foregroundStyle(Color.app.textPrimary)
                
                Chart(expenses.prefix(5)) { expense in
                    BarMark(
                        x: .value("Monto", expense.totalAmount),
                        y: .value("Categoría", expense.categoryName)
                    )
                    .foregroundStyle(
                        LinearGradient(
                            colors: Color.app.gradientPrimary,
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .cornerRadius(4)
                }
                .chartXAxis(.hidden)
                .frame(height: CGFloat(min(expenses.count, 5)) * 36 + 20)
            }
        }
    }
}

struct BudgetsSection: View {
    let budgets: [BudgetResponse]
    
    var body: some View {
        VStack(alignment: .leading, spacing: .md) {
            Text("Presupuestos")
                .font(.app(.headline))
                .foregroundStyle(Color.app.textPrimary)
                .padding(.horizontal)
            
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: .md) {
                    ForEach(budgets.prefix(5)) { budget in
                        BudgetProgressCard(budget: budget)
                    }
                }
                .padding(.horizontal)
            }
        }
    }
}

struct RecentTransactionsSection: View {
    let transactions: [Transaction]
    
    var body: some View {
        VStack(alignment: .leading, spacing: .md) {
            Text("Transacciones Recientes")
                .font(.app(.headline))
                .foregroundStyle(Color.app.textPrimary)
                .padding(.horizontal)
            
            VStack(spacing: .sm) {
                ForEach(transactions.prefix(5)) { transaction in
                    TransactionRow(transaction: transaction)
                }
            }
            .padding(.horizontal)
        }
    }
}

struct TransactionRow: View {
    let transaction: Transaction
    
    var body: some View {
        GlassCard(cornerRadius: .lg, padding: .md) {
            HStack(spacing: .md) {
                ZStack {
                    Circle()
                        .fill(transaction.isIncome 
                            ? Color.app.success.opacity(0.15)
                            : Color.app.error.opacity(0.15))
                        .frame(width: 44, height: 44)
                    
                    Image(systemName: transaction.isIncome ? "arrow.up" : "arrow.down")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(transaction.isIncome ? Color.app.success : Color.app.error)
                }
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(transaction.name)
                        .font(.app(.subheadline))
                        .fontWeight(.medium)
                        .foregroundStyle(Color.app.textPrimary)
                        .lineLimit(1)
                    
                    Text(transaction.createdAt.shortFormatted)
                        .font(.caption)
                        .foregroundStyle(Color.app.textTertiary)
                }
                
                Spacer()
                
                Text((transaction.isIncome ? "+" : "-") + transaction.amount.currencyFormatted)
                    .font(.app(.subheadline))
                    .fontWeight(.semibold)
                    .foregroundStyle(transaction.isIncome ? Color.app.success : Color.app.error)
            }
        }
    }
}

#Preview {
    DashboardView()
}
