import Testing
import Foundation
@testable import gestorpresupuesto

@Suite("AnalyticsViewModel Tests")
struct AnalyticsViewModelTests {

    @Test @MainActor func loadAnalytics_success() async {
        let mock = MockAnalyticsRepository()
        mock.getCategoryExpensesResult = .success([
            CategoryExpense(id: "1", label: "Comida", value: -5000, color: "#FF0000",
                          transactionCount: 10, dopTotal: nil, usdTotal: nil)
        ])
        mock.getMonthlySummaryResult = .success([
            MonthlySummary(month: "2026-01", ingresos: 50000, gastos: -30000)
        ])
        let vm = AnalyticsViewModel(analyticsRepository: mock)

        await vm.loadAnalytics()

        #expect(vm.categoryExpenses.count == 1)
        #expect(vm.monthlySummary.count == 1)
        #expect(!vm.isLoading)
    }

    @Test @MainActor func loadAnalytics_error() async {
        let mock = MockAnalyticsRepository()
        mock.getCategoryExpensesResult = .failure(MockError.forced)
        let vm = AnalyticsViewModel(analyticsRepository: mock)

        await vm.loadAnalytics()

        #expect(vm.error != nil)
    }

    @Test @MainActor func defaultDateRange_startsAtBeginningOfMonth() {
        let mock = MockAnalyticsRepository()
        let vm = AnalyticsViewModel(analyticsRepository: mock)

        let calendar = Calendar.current
        let day = calendar.component(.day, from: vm.dateFrom)
        #expect(day == 1)
    }

    @Test @MainActor func defaultDateRange_endsAtToday() {
        let mock = MockAnalyticsRepository()
        let vm = AnalyticsViewModel(analyticsRepository: mock)

        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())
        let dateToDay = calendar.startOfDay(for: vm.dateTo)
        #expect(dateToDay == today)
    }
}
