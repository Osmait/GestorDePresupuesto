import Foundation
import Combine

@MainActor
class CreditCardsViewModel: BaseViewModel {
    @Published var creditCards: [CreditCard] = []
    @Published var summary: CreditCardSummary?
    @Published var payments: [CardPayment] = []
    @Published var accounts: [AccountResponse] = []

    private let creditCardRepository: CreditCardRepository
    private let accountRepository: AccountRepository

    init(
        creditCardRepository: CreditCardRepository? = nil,
        accountRepository: AccountRepository? = nil
    ) {
        let container = DependencyContainer.shared
        self.creditCardRepository = creditCardRepository ?? container.resolve(CreditCardRepository.self)
        self.accountRepository = accountRepository ?? container.resolve(AccountRepository.self)
    }

    func loadCreditCards() async {
        isLoading = true
        error = nil

        do {
            async let cardsTask = creditCardRepository.getAll()
            async let summaryTask = creditCardRepository.getSummary()
            async let accountsTask = accountRepository.getAll()

            creditCards = try await cardsTask
            summary = try await summaryTask
            accounts = try await accountsTask
        } catch {
            showError(error.localizedDescription)
        }

        isLoading = false
    }

    func createCreditCard(request: CreateCreditCardRequest) async throws -> CreditCard {
        let card = try await creditCardRepository.create(request)
        showSuccess("Tarjeta creada")
        await loadCreditCards()
        return card
    }

    func deleteCreditCard(_ id: String) async {
        do {
            try await creditCardRepository.delete(id)
            creditCards.removeAll { $0.id == id }
            showSuccess("Tarjeta eliminada")
        } catch {
            showError(error.localizedDescription)
        }
    }

    func loadPayments(cardId: String) async {
        do {
            payments = try await creditCardRepository.getPayments(cardId: cardId)
        } catch {
            showError(error.localizedDescription)
        }
    }

    func createPayment(cardId: String, request: CreateCardPaymentRequest) async throws -> CardPayment {
        let payment = try await creditCardRepository.createPayment(cardId: cardId, request: request)
        showSuccess("Pago registrado")
        await loadCreditCards()
        return payment
    }
}
