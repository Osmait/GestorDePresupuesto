import Testing
@testable import gestorpresupuesto

@Suite("CreditCardsViewModel Tests")
struct CreditCardsViewModelTests {

    @MainActor private func makeSUT() -> (CreditCardsViewModel, MockCreditCardRepository, MockAccountRepository) {
        let ccRepo = MockCreditCardRepository()
        let accRepo = MockAccountRepository()
        let vm = CreditCardsViewModel(
            creditCardRepository: ccRepo,
            accountRepository: accRepo
        )
        return (vm, ccRepo, accRepo)
    }

    @Test @MainActor func loadCreditCards_success() async {
        let (vm, ccRepo, accRepo) = makeSUT()
        ccRepo.getAllResult = .success([.fixture()])
        ccRepo.getSummaryResult = .success(.fixture())
        accRepo.getAllResult = .success([.fixture()])

        await vm.loadCreditCards()

        #expect(vm.creditCards.count == 1)
        #expect(vm.summary != nil)
        #expect(!vm.isLoading)
    }

    @Test @MainActor func loadCreditCards_error() async {
        let (vm, ccRepo, _) = makeSUT()
        ccRepo.getAllResult = .failure(MockError.forced)

        await vm.loadCreditCards()

        #expect(vm.error != nil)
    }

    @Test @MainActor func createCreditCard_success() async throws {
        let (vm, ccRepo, accRepo) = makeSUT()
        ccRepo.createResult = .success(.fixture())
        ccRepo.getAllResult = .success([.fixture()])
        ccRepo.getSummaryResult = .success(.fixture())
        accRepo.getAllResult = .success([])

        let card = try await vm.createCreditCard(request: CreateCreditCardRequest(
            name: "Visa", bank: "BHD", lastFourDigits: "1234",
            cutDay: 15, dueDay: 5, balances: []
        ))

        #expect(card.name == "Visa Gold")
    }

    @Test @MainActor func deleteCreditCard_success() async {
        let (vm, _, _) = makeSUT()
        vm.creditCards = [.fixture(id: "cc-1")]

        await vm.deleteCreditCard("cc-1")

        #expect(vm.creditCards.isEmpty)
    }

    @Test @MainActor func deleteCreditCard_error() async {
        let (vm, ccRepo, _) = makeSUT()
        ccRepo.deleteError = MockError.forced

        await vm.deleteCreditCard("cc-1")

        #expect(vm.error != nil)
    }

    @Test @MainActor func loadPayments_success() async {
        let (vm, ccRepo, _) = makeSUT()
        ccRepo.getPaymentsResult = .success([.fixture()])

        await vm.loadPayments(cardId: "cc-1")

        #expect(vm.payments.count == 1)
    }

    @Test @MainActor func createPayment_success() async throws {
        let (vm, ccRepo, accRepo) = makeSUT()
        ccRepo.createPaymentResult = .success(.fixture())
        ccRepo.getAllResult = .success([.fixture()])
        ccRepo.getSummaryResult = .success(.fixture())
        accRepo.getAllResult = .success([])

        let payment = try await vm.createPayment(
            cardId: "cc-1",
            request: CreateCardPaymentRequest(
                fromAccountId: "acc-1", currency: "DOP",
                amount: 5000, exchangeRate: nil,
                includesInterest: nil, interestAmount: nil, notes: nil
            )
        )

        #expect(payment.amount == 5000)
    }
}
