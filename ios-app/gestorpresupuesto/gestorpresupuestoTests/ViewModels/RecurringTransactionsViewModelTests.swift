import Testing
@testable import gestorpresupuesto

@Suite("RecurringTransactionsViewModel Tests")
struct RecurringTransactionsViewModelTests {

    @Test @MainActor func loadRecurringTransactions_success() async {
        let mock = MockRecurringTransactionRepository()
        mock.getAllResult = .success([.fixture()])
        let vm = RecurringTransactionsViewModel(recurringRepository: mock)

        await vm.loadRecurringTransactions()

        #expect(vm.recurringTransactions.count == 1)
        #expect(!vm.isLoading)
    }

    @Test @MainActor func loadRecurringTransactions_error() async {
        let mock = MockRecurringTransactionRepository()
        mock.getAllResult = .failure(MockError.forced)
        let vm = RecurringTransactionsViewModel(recurringRepository: mock)

        await vm.loadRecurringTransactions()

        #expect(vm.error != nil)
    }

    @Test @MainActor func incomeTransactions_filtersCorrectly() {
        let mock = MockRecurringTransactionRepository()
        let vm = RecurringTransactionsViewModel(recurringRepository: mock)
        vm.recurringTransactions = [
            .fixture(id: "1", type: "income"),
            .fixture(id: "2", type: "bill"),
            .fixture(id: "3", type: "income"),
        ]

        #expect(vm.incomeTransactions.count == 2)
    }

    @Test @MainActor func billTransactions_filtersCorrectly() {
        let mock = MockRecurringTransactionRepository()
        let vm = RecurringTransactionsViewModel(recurringRepository: mock)
        vm.recurringTransactions = [
            .fixture(id: "1", type: "income"),
            .fixture(id: "2", type: "bill"),
        ]

        #expect(vm.billTransactions.count == 1)
    }

    @Test @MainActor func totalIncome_sumsIncomeOnly() {
        let mock = MockRecurringTransactionRepository()
        let vm = RecurringTransactionsViewModel(recurringRepository: mock)
        vm.recurringTransactions = [
            .fixture(id: "1", amount: 50000, type: "income"),
            .fixture(id: "2", amount: 30000, type: "income"),
            .fixture(id: "3", amount: 5000, type: "bill"),
        ]

        #expect(vm.totalIncome == 80000)
    }

    @Test @MainActor func totalBills_sumsBillsOnly() {
        let mock = MockRecurringTransactionRepository()
        let vm = RecurringTransactionsViewModel(recurringRepository: mock)
        vm.recurringTransactions = [
            .fixture(id: "1", amount: 50000, type: "income"),
            .fixture(id: "2", amount: 2000, type: "bill"),
            .fixture(id: "3", amount: 3000, type: "bill"),
        ]

        #expect(vm.totalBills == 5000)
    }

    @Test @MainActor func deleteRecurringTransaction_success() async {
        let mock = MockRecurringTransactionRepository()
        let vm = RecurringTransactionsViewModel(recurringRepository: mock)
        vm.recurringTransactions = [.fixture(id: "r1")]

        await vm.deleteRecurringTransaction("r1")

        #expect(vm.recurringTransactions.isEmpty)
    }

    @Test @MainActor func deleteRecurringTransaction_error() async {
        let mock = MockRecurringTransactionRepository()
        mock.deleteError = MockError.forced
        let vm = RecurringTransactionsViewModel(recurringRepository: mock)

        await vm.deleteRecurringTransaction("r1")

        #expect(vm.error != nil)
    }
}
