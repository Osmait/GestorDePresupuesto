import Testing
@testable import gestorpresupuesto

@Suite("BudgetResponse Entity Tests")
struct BudgetEntityTests {

    @Test func spent_returnsAbsoluteValue() {
        let budget = BudgetResponse.fixture(currentAmount: -3000)
        #expect(budget.spent == 3000)
    }

    @Test func spent_positiveCurrentAmount() {
        let budget = BudgetResponse.fixture(currentAmount: 3000)
        #expect(budget.spent == 3000)
    }

    @Test func progress_normalCase() {
        let budget = BudgetResponse.fixture(amount: 10000, currentAmount: -5000)
        #expect(budget.progress == 0.5)
    }

    @Test func progress_cappedAtOne() {
        let budget = BudgetResponse.fixture(amount: 1000, currentAmount: -2000)
        #expect(budget.progress == 1.0)
    }

    @Test func progress_zeroAmount() {
        let budget = BudgetResponse.fixture(amount: 0, currentAmount: -500)
        #expect(budget.progress == 0)
    }

    @Test func percentageUsed_returnsCorrectPercentage() {
        let budget = BudgetResponse.fixture(amount: 10000, currentAmount: -7500)
        #expect(budget.percentageUsed == 75)
    }

    @Test func remaining_normalCase() {
        let budget = BudgetResponse.fixture(amount: 10000, currentAmount: -3000)
        #expect(budget.remaining == 7000)
    }

    @Test func remaining_overBudget_returnsZero() {
        let budget = BudgetResponse.fixture(amount: 1000, currentAmount: -2000)
        #expect(budget.remaining == 0)
    }

    @Test func isOverBudget_whenSpentExceedsAmount() {
        let budget = BudgetResponse.fixture(amount: 5000, currentAmount: -6000)
        #expect(budget.isOverBudget)
    }

    @Test func isOverBudget_whenUnderBudget() {
        let budget = BudgetResponse.fixture(amount: 5000, currentAmount: -3000)
        #expect(!budget.isOverBudget)
    }

    @Test func isWarning_between70and100Percent() {
        let budget = BudgetResponse.fixture(amount: 10000, currentAmount: -8000)
        #expect(budget.isWarning)
        #expect(!budget.isCritical)
    }

    @Test func isCritical_at100Percent() {
        let budget = BudgetResponse.fixture(amount: 5000, currentAmount: -5000)
        #expect(budget.isCritical)
        #expect(!budget.isWarning)
    }

    @Test func displayName_withCategoryName() {
        let budget = BudgetResponse.fixture(categoryName: "Comida")
        #expect(budget.displayName == "Comida")
    }

    @Test func displayName_withoutCategoryName() {
        let budget = BudgetResponse.fixture(categoryName: nil)
        #expect(budget.displayName == "Presupuesto")
    }
}
