import Testing
@testable import gestorpresupuesto

@Suite("InvestmentsViewModel Tests")
struct InvestmentsViewModelTests {

    @MainActor private func makeSUT() -> (InvestmentsViewModel, MockInvestmentRepository, MockAccountRepository) {
        let invRepo = MockInvestmentRepository()
        let accRepo = MockAccountRepository()
        let vm = InvestmentsViewModel(
            investmentRepository: invRepo,
            accountRepository: accRepo
        )
        return (vm, invRepo, accRepo)
    }

    @Test @MainActor func loadInvestments_success() async {
        let (vm, invRepo, accRepo) = makeSUT()
        invRepo.getAllResult = .success([.fixture()])
        invRepo.getFundingBalancesResult = .success([])
        accRepo.getAllResult = .success([.fixture()])

        await vm.loadInvestments()

        #expect(vm.investments.count == 1)
        #expect(vm.accounts.count == 1)
        #expect(!vm.isLoading)
    }

    @Test @MainActor func loadInvestments_error() async {
        let (vm, invRepo, _) = makeSUT()
        invRepo.getAllResult = .failure(MockError.forced)

        await vm.loadInvestments()

        #expect(vm.error != nil)
    }

    @Test @MainActor func filteredInvestments_noFilter_returnsAll() {
        let (vm, _, _) = makeSUT()
        vm.investments = [
            .fixture(id: "1", type: .stock),
            .fixture(id: "2", type: .crypto),
        ]
        vm.selectedTypeFilter = nil

        #expect(vm.filteredInvestments.count == 2)
    }

    @Test @MainActor func filteredInvestments_withFilter() {
        let (vm, _, _) = makeSUT()
        vm.investments = [
            .fixture(id: "1", type: .stock),
            .fixture(id: "2", type: .crypto),
            .fixture(id: "3", type: .stock),
        ]
        vm.selectedTypeFilter = .stock

        #expect(vm.filteredInvestments.count == 2)
    }

    @Test @MainActor func totalPortfolioValue_calculatesCorrectly() {
        let (vm, _, _) = makeSUT()
        vm.investments = [
            .fixture(id: "1", quantity: 10, currentPrice: 100),
            .fixture(id: "2", quantity: 5, currentPrice: 200),
        ]

        #expect(vm.totalPortfolioValue == 2000)
    }

    @Test @MainActor func totalGainLoss_calculatesCorrectly() {
        let (vm, _, _) = makeSUT()
        vm.investments = [
            .fixture(id: "1", quantity: 10, purchasePrice: 100, currentPrice: 120),
            .fixture(id: "2", quantity: 5, purchasePrice: 200, currentPrice: 180),
        ]

        #expect(vm.totalGainLoss == (200 + (-100)))
    }

    @Test @MainActor func deleteInvestment_success_removesFromList() async {
        let (vm, invRepo, _) = makeSUT()
        vm.investments = [.fixture(id: "inv-1"), .fixture(id: "inv-2")]

        await vm.deleteInvestment("inv-1")

        #expect(vm.investments.count == 1)
        #expect(invRepo.deleteCallCount == 1)
    }

    @Test @MainActor func deleteInvestment_error_showsError() async {
        let (vm, invRepo, _) = makeSUT()
        invRepo.deleteError = MockError.forced
        vm.investments = [.fixture(id: "inv-1")]

        await vm.deleteInvestment("inv-1")

        #expect(vm.error != nil)
    }

    @Test @MainActor func getQuote_error_returnsNil() async {
        let (vm, invRepo, _) = makeSUT()
        invRepo.getQuoteResult = .failure(MockError.forced)

        let result = await vm.getQuote(symbol: "AAPL")

        #expect(result == nil)
    }

    @Test @MainActor func createInvestment_success_reloads() async throws {
        let (vm, invRepo, accRepo) = makeSUT()
        invRepo.createResult = .success(.fixture())
        invRepo.getAllResult = .success([.fixture()])
        invRepo.getFundingBalancesResult = .success([])
        accRepo.getAllResult = .success([])

        let result = try await vm.createInvestment(request: CreateInvestmentRequest(
            name: "AAPL", symbol: "AAPL", type: "stock",
            quantity: 10, purchasePrice: 150, currentPrice: 160,
            settlementCurrency: "USD"
        ))

        #expect(result.name == "Apple Inc")
    }
}
