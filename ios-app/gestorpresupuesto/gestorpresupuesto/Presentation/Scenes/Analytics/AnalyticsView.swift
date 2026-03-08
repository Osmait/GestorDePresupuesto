import SwiftUI
import Charts

struct AnalyticsView: View {
    @StateObject private var viewModel = AnalyticsViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                Color.app.background.ignoresSafeArea()

                ScrollView {
                    VStack(spacing: Spacing.lg.rawValue) {
                        // Date Range
                        HStack(spacing: Spacing.md.rawValue) {
                            DatePickerField(title: "Desde", date: $viewModel.dateFrom)
                            DatePickerField(title: "Hasta", date: $viewModel.dateTo)
                        }

                        PrimaryButton("Filtrar", isLoading: viewModel.isLoading) {
                            Task { await viewModel.loadAnalytics() }
                        }

                        // Category Breakdown
                        if !viewModel.categoryExpenses.isEmpty {
                            SurfaceCard {
                                VStack(alignment: .leading, spacing: Spacing.md.rawValue) {
                                    Text("Gastos por Categoría")
                                        .font(.app(.headline))
                                        .foregroundStyle(Color.app.textPrimary)

                                    Chart(viewModel.categoryExpenses) { expense in
                                        SectorMark(angle: .value(expense.label, expense.totalAmount))
                                            .foregroundStyle(Color.fromHex(expense.color) ?? .gray)
                                    }
                                    .frame(height: 200)

                                    ForEach(viewModel.categoryExpenses) { expense in
                                        HStack {
                                            Circle()
                                                .fill(Color.fromHex(expense.color) ?? .gray)
                                                .frame(width: 10, height: 10)
                                            Text(expense.label)
                                                .font(.app(.caption))
                                                .foregroundStyle(Color.app.textPrimary)
                                            Spacer()
                                            Text(expense.totalAmount.currencyFormatted)
                                                .font(.app(.caption))
                                                .fontWeight(.semibold)
                                        }
                                    }
                                }
                            }
                        }

                        // Monthly Chart
                        MonthlySummaryChart(data: viewModel.monthlySummary)
                    }
                    .padding(Spacing.lg.rawValue)
                }
            }
            .navigationTitle("Analíticas")
            .task { await viewModel.loadAnalytics() }
            .refreshable { await viewModel.loadAnalytics() }
            .errorBanner(isPresented: $viewModel.showErrorBanner, message: viewModel.errorBannerMessage)
        }
    }
}
