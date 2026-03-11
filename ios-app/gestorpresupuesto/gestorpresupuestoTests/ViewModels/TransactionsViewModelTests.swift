import Testing
import Foundation
@testable import gestorpresupuesto

@Suite("TransactionsViewModel Tests")
struct TransactionsViewModelTests {

    @MainActor private func makeSUT() -> (TransactionsViewModel, MockTransactionRepository, MockCategoryRepository, MockAccountRepository) {
        let txnRepo = MockTransactionRepository()
        let catRepo = MockCategoryRepository()
        let accRepo = MockAccountRepository()
        let vm = TransactionsViewModel(
            transactionRepository: txnRepo,
            categoryRepository: catRepo,
            accountRepository: accRepo
        )
        return (vm, txnRepo, catRepo, accRepo)
    }

    // MARK: - Loading

    @Test @MainActor func loadTransactions_success() async {
        let (vm, txnRepo, _, _) = makeSUT()
        txnRepo.getAllResult = .success(.fixture(
            data: [.fixture()],
            hasNextPage: false
        ))

        await vm.loadTransactions()

        #expect(vm.transactions.count == 1)
        #expect(!vm.hasMorePages)
        #expect(!vm.isLoading)
    }

    @Test @MainActor func loadTransactions_error() async {
        let (vm, txnRepo, _, _) = makeSUT()
        txnRepo.getAllResult = .failure(MockError.forced)

        await vm.loadTransactions()

        #expect(vm.transactions.isEmpty)
        #expect(vm.error != nil)
    }

    @Test @MainActor func loadTransactions_pagination_appendsData() async {
        let (vm, txnRepo, _, _) = makeSUT()
        txnRepo.getAllResult = .success(.fixture(
            data: [.fixture(id: "t1")],
            currentPage: 1,
            hasNextPage: true
        ))

        await vm.loadTransactions()
        #expect(vm.transactions.count == 1)

        txnRepo.getAllResult = .success(.fixture(
            data: [.fixture(id: "t2")],
            currentPage: 2,
            hasNextPage: false
        ))

        await vm.loadTransactions()
        #expect(vm.transactions.count == 2)
    }

    @Test @MainActor func loadTransactions_stopsWhenNoMorePages() async {
        let (vm, txnRepo, _, _) = makeSUT()
        txnRepo.getAllResult = .success(.fixture(data: [], hasNextPage: false))

        await vm.loadTransactions()
        vm.hasMorePages = false

        await vm.loadTransactions()
        #expect(txnRepo.getAllCallCount == 1)
    }

    // MARK: - Computed Properties

    @Test @MainActor func totalIncome_calculatesCorrectly() {
        let (vm, _, _, _) = makeSUT()
        vm.transactions = [
            .fixture(id: "1", amount: 1000, typeTransaction: "income"),
            .fixture(id: "2", amount: 2000, typeTransaction: "income"),
            .fixture(id: "3", amount: 500, typeTransaction: "expense"),
        ]
        #expect(vm.totalIncome == 3000)
    }

    @Test @MainActor func totalExpenses_calculatesCorrectly() {
        let (vm, _, _, _) = makeSUT()
        vm.transactions = [
            .fixture(id: "1", amount: 1000, typeTransaction: "income"),
            .fixture(id: "2", amount: -500, typeTransaction: "expense"),
            .fixture(id: "3", amount: -300, typeTransaction: "expense"),
        ]
        #expect(vm.totalExpenses == 800)
    }

    @Test @MainActor func netAmount_calculatesCorrectly() {
        let (vm, _, _, _) = makeSUT()
        vm.transactions = [
            .fixture(id: "1", amount: 5000, typeTransaction: "income"),
            .fixture(id: "2", amount: -2000, typeTransaction: "expense"),
        ]
        #expect(vm.netAmount == vm.totalIncome - vm.totalExpenses)
    }

    // MARK: - Filters

    @Test @MainActor func hasActiveFilters_defaultIsFalse() {
        let (vm, _, _, _) = makeSUT()
        #expect(!vm.hasActiveFilters)
    }

    @Test @MainActor func hasActiveFilters_withTypeFilter() {
        let (vm, _, _, _) = makeSUT()
        vm.selectedType = .income
        #expect(vm.hasActiveFilters)
    }

    @Test @MainActor func hasActiveFilters_withCategoryFilter() {
        let (vm, _, _, _) = makeSUT()
        vm.selectedCategoryId = "cat-1"
        #expect(vm.hasActiveFilters)
    }

    @Test @MainActor func hasActiveFilters_withSearchText() {
        let (vm, _, _, _) = makeSUT()
        vm.searchText = "groceries"
        #expect(vm.hasActiveFilters)
    }

    @Test @MainActor func clearFilters_resetsAll() {
        let (vm, _, _, _) = makeSUT()
        vm.selectedPeriod = .today
        vm.selectedType = .income
        vm.selectedCategoryId = "cat-1"
        vm.selectedAccountId = "acc-1"
        vm.searchText = "test"
        vm.amountMin = "100"
        vm.amountMax = "5000"

        vm.clearFilters()

        #expect(vm.selectedPeriod == .thisMonth)
        #expect(vm.selectedType == .all)
        #expect(vm.selectedCategoryId == nil)
        #expect(vm.selectedAccountId == nil)
        #expect(vm.searchText.isEmpty)
        #expect(vm.amountMin.isEmpty)
        #expect(vm.amountMax.isEmpty)
    }

    // MARK: - FilterPeriod

    @Test func filterPeriod_all_returnsNil() {
        let range = FilterPeriod.all.dateRange
        #expect(range.from == nil)
        #expect(range.to == nil)
    }

    @Test func filterPeriod_today_returnsSameDate() {
        let range = FilterPeriod.today.dateRange
        #expect(range.from == range.to)
        #expect(range.from != nil)
    }

    @Test func filterPeriod_thisMonth_startsOnFirst() {
        let range = FilterPeriod.thisMonth.dateRange
        #expect(range.from != nil)
        #expect(range.from!.hasSuffix("-01"))
    }

    // MARK: - FilterType

    @Test func filterType_apiValues() {
        #expect(FilterType.all.apiValue == nil)
        #expect(FilterType.income.apiValue == "income")
        #expect(FilterType.expense.apiValue == "expense")
    }

    // MARK: - Delete

    @Test @MainActor func deleteTransaction_success_removesFromList() async {
        let (vm, txnRepo, _, _) = makeSUT()
        vm.transactions = [.fixture(id: "t1"), .fixture(id: "t2")]

        await vm.deleteTransaction("t1")

        #expect(vm.transactions.count == 1)
        #expect(vm.transactions.first?.id == "t2")
        #expect(txnRepo.deleteCallCount == 1)
    }

    @Test @MainActor func deleteTransaction_error_showsError() async {
        let (vm, txnRepo, _, _) = makeSUT()
        txnRepo.deleteError = MockError.forced
        vm.transactions = [.fixture(id: "t1")]

        await vm.deleteTransaction("t1")

        #expect(vm.error != nil)
    }
}
