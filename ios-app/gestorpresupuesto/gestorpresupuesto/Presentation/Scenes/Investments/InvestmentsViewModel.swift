import Foundation
import Combine

@MainActor
class InvestmentsViewModel: BaseViewModel {
    @Published var investments: [Investment] = []
    @Published var fundingBalances: [FundingBalance] = []
    @Published var accounts: [AccountResponse] = []
    @Published var selectedTypeFilter: InvestmentType?

    private let investmentRepository: InvestmentRepository
    private let accountRepository: AccountRepository

    init(
        investmentRepository: InvestmentRepository? = nil,
        accountRepository: AccountRepository? = nil
    ) {
        let container = DependencyContainer.shared
        self.investmentRepository = investmentRepository ?? container.resolve(InvestmentRepository.self)
        self.accountRepository = accountRepository ?? container.resolve(AccountRepository.self)
    }

    var filteredInvestments: [Investment] {
        guard let filter = selectedTypeFilter else { return investments }
        return investments.filter { $0.type == filter }
    }

    var totalPortfolioValue: Double {
        investments.reduce(0) { $0 + $1.totalValue }
    }

    var totalGainLoss: Double {
        investments.reduce(0) { $0 + $1.gainLoss }
    }

    func loadInvestments() async {
        isLoading = true
        defer { isLoading = false }
        error = nil

        do {
            async let investmentsTask = investmentRepository.getAll()
            async let balancesTask = investmentRepository.getFundingBalances()
            async let accountsTask = accountRepository.getAll()

            investments = try await investmentsTask
            fundingBalances = try await balancesTask
            accounts = try await accountsTask
        } catch {
            showError(error.localizedDescription)
        }
    }

    func createInvestment(request: CreateInvestmentRequest) async throws -> Investment {
        let investment = try await investmentRepository.create(request)
        showSuccess("Inversión creada")
        await loadInvestments()
        return investment
    }

    func deleteInvestment(_ id: String) async {
        do {
            try await investmentRepository.delete(id)
            investments.removeAll { $0.id == id }
            showSuccess("Inversión eliminada")
        } catch {
            showError(error.localizedDescription)
        }
    }

    func fundBroker(request: FundBrokerRequest) async throws {
        try await investmentRepository.fundBroker(request)
        showSuccess("Fondeo registrado")
        await loadInvestments()
    }

    func getQuote(symbol: String) async -> QuoteResponse? {
        do {
            return try await investmentRepository.getQuote(symbol: symbol)
        } catch {
            showError(error.localizedDescription)
            return nil
        }
    }
}
