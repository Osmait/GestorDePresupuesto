import Foundation
import Combine

@MainActor
class AnalyticsViewModel: BaseViewModel {
    @Published var categoryExpenses: [CategoryExpense] = []
    @Published var monthlySummary: [MonthlySummary] = []
    @Published var dateFrom: Date = Date.startOfMonth
    @Published var dateTo: Date = Date()

    private let analyticsRepository: AnalyticsRepository

    init(analyticsRepository: AnalyticsRepository? = nil) {
        self.analyticsRepository = analyticsRepository ?? DependencyContainer.shared.resolve(AnalyticsRepository.self)
    }

    func loadAnalytics() async {
        isLoading = true
        error = nil

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"

        do {
            async let expensesTask = analyticsRepository.getCategoryExpenses(
                dateFrom: formatter.string(from: dateFrom),
                dateTo: formatter.string(from: dateTo)
            )
            async let summaryTask = analyticsRepository.getMonthlySummary()

            categoryExpenses = try await expensesTask
            monthlySummary = try await summaryTask
        } catch {
            showError(error.localizedDescription)
        }

        isLoading = false
    }
}
