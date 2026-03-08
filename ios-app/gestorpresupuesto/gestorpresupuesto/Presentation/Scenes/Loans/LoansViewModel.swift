import Foundation
import Combine

@MainActor
class LoansViewModel: BaseViewModel {
    @Published var loans: [Loan] = []
    @Published var summary: LoanSummary?
    @Published var selectedLoanDetails: LoanDetails?
    @Published var accounts: [AccountResponse] = []

    private let loanRepository: LoanRepository
    private let accountRepository: AccountRepository

    init(
        loanRepository: LoanRepository? = nil,
        accountRepository: AccountRepository? = nil
    ) {
        let container = DependencyContainer.shared
        self.loanRepository = loanRepository ?? container.resolve(LoanRepository.self)
        self.accountRepository = accountRepository ?? container.resolve(AccountRepository.self)
    }

    func loadLoans() async {
        isLoading = true
        error = nil

        do {
            async let loansTask = loanRepository.getAll()
            async let summaryTask = loanRepository.getSummary()
            async let accountsTask = accountRepository.getAll()

            loans = try await loansTask
            summary = try await summaryTask
            accounts = try await accountsTask
        } catch {
            showError(error.localizedDescription)
        }

        isLoading = false
    }

    func loadLoanDetails(_ id: String) async {
        do {
            selectedLoanDetails = try await loanRepository.getById(id)
        } catch {
            showError(error.localizedDescription)
        }
    }

    func createLoan(request: CreateLoanRequest) async throws -> Loan {
        let loan = try await loanRepository.create(request)
        showSuccess("Préstamo creado")
        await loadLoans()
        return loan
    }

    func registerPayment(loanId: String, request: RegisterLoanPaymentRequest) async throws -> LoanPayment {
        let payment = try await loanRepository.registerPayment(id: loanId, request: request)
        showSuccess("Pago registrado")
        await loadLoanDetails(loanId)
        await loadLoans()
        return payment
    }
}
