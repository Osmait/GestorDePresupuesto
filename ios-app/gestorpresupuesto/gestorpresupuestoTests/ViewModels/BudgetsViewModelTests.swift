import Testing
@testable import gestorpresupuesto

@Suite("BudgetsViewModel Tests")
struct BudgetsViewModelTests {

    @Test @MainActor func loadBudgets_success() async {
        let mock = MockBudgetRepository()
        mock.getAllResult = .success([.fixture()])
        let vm = BudgetsViewModel(budgetRepository: mock)

        await vm.loadBudgets()

        #expect(vm.budgets.count == 1)
        #expect(!vm.isLoading)
    }

    @Test @MainActor func loadBudgets_error() async {
        let mock = MockBudgetRepository()
        mock.getAllResult = .failure(MockError.forced)
        let vm = BudgetsViewModel(budgetRepository: mock)

        await vm.loadBudgets()

        #expect(vm.error != nil)
    }

    @Test @MainActor func createBudget_success() async throws {
        let mock = MockBudgetRepository()
        mock.createResult = .success(.fixture())
        mock.getAllResult = .success([.fixture()])
        let vm = BudgetsViewModel(budgetRepository: mock)

        let budget = try await vm.createBudget(request: CreateBudgetRequest(
            categoryId: "cat-1", amount: 5000
        ))

        #expect(budget.amount == 5000)
    }

    @Test @MainActor func updateBudget_success() async throws {
        let mock = MockBudgetRepository()
        mock.updateResult = .success(.fixture())
        mock.getAllResult = .success([.fixture()])
        let vm = BudgetsViewModel(budgetRepository: mock)

        _ = try await vm.updateBudget("bud-1", request: UpdateBudgetRequest(
            categoryId: "cat-1", amount: 8000
        ))

        #expect(mock.getAllCallCount >= 1)
    }

    @Test @MainActor func deleteBudget_success() async {
        let mock = MockBudgetRepository()
        let vm = BudgetsViewModel(budgetRepository: mock)
        vm.budgets = [.fixture(id: "bud-1")]

        await vm.deleteBudget("bud-1")

        #expect(vm.budgets.isEmpty)
    }

    @Test @MainActor func deleteBudget_error() async {
        let mock = MockBudgetRepository()
        mock.deleteError = MockError.forced
        let vm = BudgetsViewModel(budgetRepository: mock)

        await vm.deleteBudget("bud-1")

        #expect(vm.error != nil)
    }

    @Test @MainActor func loadBudgets_clearsErrorOnSuccess() async {
        let mock = MockBudgetRepository()
        mock.getAllResult = .success([])
        let vm = BudgetsViewModel(budgetRepository: mock)
        vm.error = "Previous error"

        await vm.loadBudgets()

        #expect(vm.error == nil)
    }
}
