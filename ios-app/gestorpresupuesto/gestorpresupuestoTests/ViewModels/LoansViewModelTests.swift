import Testing
@testable import gestorpresupuesto

@Suite("LoansViewModel Tests")
struct LoansViewModelTests {

    @MainActor private func makeSUT() -> (LoansViewModel, MockLoanRepository, MockAccountRepository) {
        let loanRepo = MockLoanRepository()
        let accRepo = MockAccountRepository()
        let vm = LoansViewModel(
            loanRepository: loanRepo,
            accountRepository: accRepo
        )
        return (vm, loanRepo, accRepo)
    }

    @Test @MainActor func loadLoans_success() async {
        let (vm, loanRepo, accRepo) = makeSUT()
        loanRepo.getAllResult = .success([.fixture()])
        loanRepo.getSummaryResult = .success(.fixture())
        accRepo.getAllResult = .success([.fixture()])

        await vm.loadLoans()

        #expect(vm.loans.count == 1)
        #expect(vm.summary != nil)
        #expect(!vm.isLoading)
    }

    @Test @MainActor func loadLoans_error() async {
        let (vm, loanRepo, _) = makeSUT()
        loanRepo.getAllResult = .failure(MockError.forced)

        await vm.loadLoans()

        #expect(vm.error != nil)
    }

    @Test @MainActor func createLoan_success() async throws {
        let (vm, loanRepo, accRepo) = makeSUT()
        loanRepo.createResult = .success(.fixture())
        loanRepo.getAllResult = .success([.fixture()])
        loanRepo.getSummaryResult = .success(.fixture())
        accRepo.getAllResult = .success([])

        let loan = try await vm.createLoan(request: CreateLoanRequest(
            borrowerName: "Juan", borrowerContact: "809-555-1234",
            principalAmount: 50000, currency: "DOP",
            interestMode: "fixed_total", annualRate: 12,
            termMonths: 12, startDate: nil,
            sourceAccountId: "acc-1", notes: nil
        ))

        #expect(loan.borrowerName == "Juan Pérez")
    }

    @Test @MainActor func registerPayment_success() async throws {
        let (vm, loanRepo, accRepo) = makeSUT()
        loanRepo.registerPaymentResult = .success(.fixture())
        loanRepo.getByIdResult = .success(LoanDetails(
            loan: .fixture(), installments: [], payments: [.fixture()]
        ))
        loanRepo.getAllResult = .success([.fixture()])
        loanRepo.getSummaryResult = .success(.fixture())
        accRepo.getAllResult = .success([])

        let payment = try await vm.registerPayment(
            loanId: "loan-1",
            request: RegisterLoanPaymentRequest(
                destinationAccountId: "acc-1",
                amount: 5000, paymentDate: nil, notes: nil
            )
        )

        #expect(payment.amount == 5000)
    }

    @Test @MainActor func loadLoanDetails_success() async {
        let (vm, loanRepo, _) = makeSUT()
        loanRepo.getByIdResult = .success(LoanDetails(
            loan: .fixture(), installments: [], payments: []
        ))

        await vm.loadLoanDetails("loan-1")

        #expect(vm.selectedLoanDetails != nil)
    }

    @Test @MainActor func loadLoanDetails_error() async {
        let (vm, loanRepo, _) = makeSUT()
        loanRepo.getByIdResult = .failure(MockError.forced)

        await vm.loadLoanDetails("loan-1")

        #expect(vm.error != nil)
    }

    @Test @MainActor func loadLoans_clearsError() async {
        let (vm, loanRepo, accRepo) = makeSUT()
        loanRepo.getAllResult = .success([])
        loanRepo.getSummaryResult = .success(.fixture())
        accRepo.getAllResult = .success([])
        vm.error = "old error"

        await vm.loadLoans()

        #expect(vm.error == nil)
    }
}
