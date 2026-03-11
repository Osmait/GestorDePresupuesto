import Testing
@testable import gestorpresupuesto

@Suite("Analytics Entity Tests")
struct AnalyticsEntityTests {

    // MARK: - CategoryExpense

    @Test func categoryExpense_totalAmount_returnsAbsoluteValue() {
        let expense = CategoryExpense(
            id: "1", label: "Comida", value: -5000,
            color: "#FF0000", transactionCount: 10,
            dopTotal: nil, usdTotal: nil
        )
        #expect(expense.totalAmount == 5000)
    }

    @Test func categoryExpense_categoryName_returnsLabel() {
        let expense = CategoryExpense(
            id: "1", label: "Transporte", value: -2000,
            color: "#00FF00", transactionCount: nil,
            dopTotal: nil, usdTotal: nil
        )
        #expect(expense.categoryName == "Transporte")
    }

    // MARK: - MonthlySummary

    @Test func monthlySummary_totalIncome() {
        let summary = MonthlySummary(month: "2026-01", ingresos: 50000, gastos: -30000)
        #expect(summary.totalIncome == 50000)
    }

    @Test func monthlySummary_totalExpenses_returnsAbsolute() {
        let summary = MonthlySummary(month: "2026-01", ingresos: 50000, gastos: -30000)
        #expect(summary.totalExpenses == 30000)
    }

    @Test func monthlySummary_netAmount() {
        let summary = MonthlySummary(month: "2026-01", ingresos: 50000, gastos: -30000)
        #expect(summary.netAmount == 20000)
    }

    @Test func monthlySummary_id_isMonth() {
        let summary = MonthlySummary(month: "2026-03", ingresos: 0, gastos: 0)
        #expect(summary.id == "2026-03")
    }

    // MARK: - Pattern

    @Test func pattern_severityColor_values() {
        let high = Pattern(type: "subscription", description: "High spending", severity: "high")
        let medium = Pattern(type: "impulse", description: "Medium spending", severity: "medium")
        let low = Pattern(type: "frequency", description: "Low spending", severity: "low")
        // Verify they don't crash - colors are SwiftUI Color which can't be easily compared
        _ = high.severityColor
        _ = medium.severityColor
        _ = low.severityColor
    }

    @Test func pattern_icon_mapping() {
        #expect(Pattern(type: "subscription", description: "", severity: "").icon == "arrow.clockwise")
        #expect(Pattern(type: "impulse", description: "", severity: "").icon == "bolt")
        #expect(Pattern(type: "frequency", description: "", severity: "").icon == "chart.line.uptrend.xyaxis")
        #expect(Pattern(type: "seasonal", description: "", severity: "").icon == "calendar")
        #expect(Pattern(type: "unknown", description: "", severity: "").icon == "lightbulb")
    }

    // MARK: - Recommendation

    @Test func recommendation_priorityIcon_mapping() {
        let high = Recommendation(title: "A", description: "", potentialSavings: 100, priority: "high")
        let medium = Recommendation(title: "B", description: "", potentialSavings: 50, priority: "medium")
        let low = Recommendation(title: "C", description: "", potentialSavings: 10, priority: "low")
        let other = Recommendation(title: "D", description: "", potentialSavings: 0, priority: "unknown")

        #expect(high.priorityIcon == "exclamationmark.3")
        #expect(medium.priorityIcon == "exclamationmark.2")
        #expect(low.priorityIcon == "exclamationmark")
        #expect(other.priorityIcon == "info.circle")
    }
}
