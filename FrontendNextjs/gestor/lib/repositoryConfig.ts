// Browser-side repositories (they talk to the backend through the /api/backend proxy).
// Server Components must use `@/lib/server/repositories` instead.

import { AccountRepository } from '@/app/repository/accountRepository'
import { AdminRepository } from '@/app/repository/adminRepository'
import { AnalyticsRepository } from '@/app/repository/analyticsRepository'
import { APIKeyRepository } from '@/app/repository/apiKeyRepository'
import { AuthRepository } from '@/app/repository/authRepository'
import { BudgetRepository } from '@/app/repository/budgetRepository'
import { CategoryRepository } from '@/app/repository/categoryRepository'
import { CertificateRepository } from '@/app/repository/certificateRepository'
import { CreditCardRepository } from '@/app/repository/creditcardRepository'
import { ExchangeRateRepository } from '@/app/repository/exchangeRateRepository'
import { FeatureFlagRepository } from '@/app/repository/featureFlagRepository'
import { InvestmentRepository } from '@/app/repository/investmentRepository'
import { LoanRepository } from '@/app/repository/loanRepository'
import { MonthlyPlanRepository } from '@/app/repository/monthlyPlanRepository'
import { NotificationRepository } from '@/app/repository/notificationRepository'
import { SearchRepository } from '@/app/repository/searchRepository'
import { TransactionRepository } from '@/app/repository/transactionRepository'

/** Lazily builds a single instance per repository. */
function lazySingleton<T>(create: () => T): () => T {
	let instance: T | undefined
	return () => {
		if (instance === undefined) instance = create()
		return instance
	}
}

export const getAccountRepository = lazySingleton(() => new AccountRepository())
export const getAuthRepository = lazySingleton(() => new AuthRepository())
export const getBudgetRepository = lazySingleton(() => new BudgetRepository())
export const getCategoryRepository = lazySingleton(() => new CategoryRepository())
export const getTransactionRepository = lazySingleton(() => new TransactionRepository())
export const getAnalyticsRepository = lazySingleton(() => new AnalyticsRepository())
export const getSearchRepository = lazySingleton(() => new SearchRepository())
export const getInvestmentRepository = lazySingleton(() => new InvestmentRepository())
export const getCertificateRepository = lazySingleton(() => new CertificateRepository())
export const getExchangeRateRepository = lazySingleton(() => new ExchangeRateRepository())
export const getCreditCardRepository = lazySingleton(() => new CreditCardRepository())
export const getLoanRepository = lazySingleton(() => new LoanRepository())
export const getAPIKeyRepository = lazySingleton(() => new APIKeyRepository())
export const getMonthlyPlanRepository = lazySingleton(() => new MonthlyPlanRepository())
export const getAdminRepository = lazySingleton(() => new AdminRepository())
export const getNotificationRepository = lazySingleton(() => new NotificationRepository())
export const getFeatureFlagRepository = lazySingleton(() => new FeatureFlagRepository())

// Tipos
export type IAccountRepository = AccountRepository
export type IAuthRepository = AuthRepository
export type IBudgetRepository = BudgetRepository
export type ICategoryRepository = CategoryRepository
export type ITransactionRepository = TransactionRepository
export type IAnalyticsRepository = AnalyticsRepository
export type ISearchRepository = SearchRepository
export type IInvestmentRepository = InvestmentRepository
export type ICertificateRepository = CertificateRepository
export type IExchangeRateRepository = ExchangeRateRepository
export type ICreditCardRepository = CreditCardRepository
export type ILoanRepository = LoanRepository
export type IAPIKeyRepository = APIKeyRepository
export type IMonthlyPlanRepository = MonthlyPlanRepository
