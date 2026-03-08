import Foundation

extension DependencyContainer {
    func registerDefaults() {
        register(AuthRepository.self) { AuthRepositoryImpl() }
        register(AccountRepository.self) { AccountRepositoryImpl() }
        register(TransactionRepository.self) { TransactionRepositoryImpl() }
        register(CategoryRepository.self) { CategoryRepositoryImpl() }
        register(BudgetRepository.self) { BudgetRepositoryImpl() }
        register(AnalyticsRepository.self) { AnalyticsRepositoryImpl() }
        register(RecurringTransactionRepository.self) { RecurringTransactionRepositoryImpl() }
        register(AIRepository.self) { AIRepositoryImpl() }
        register(CreditCardRepository.self) { CreditCardRepositoryImpl() }
        register(LoanRepository.self) { LoanRepositoryImpl() }
        register(CertificateRepository.self) { CertificateRepositoryImpl() }
        register(InvestmentRepository.self) { InvestmentRepositoryImpl() }
        register(ExchangeRateRepository.self) { ExchangeRateRepositoryImpl() }
        register(SearchRepository.self) { SearchRepositoryImpl() }
    }
}
