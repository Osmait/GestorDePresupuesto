// Configuración centralizada para repositorios
// MODO DESARROLLO: Solo mocks activados para evitar problemas con next/headers

const USE_MOCKS = false // Cambiado a false para usar el backend real

import { AccountRepository } from '@/app/repository/accountRepository'
import { AnalyticsRepository } from '@/app/repository/analyticsRepository'
import { APIKeyRepository } from '@/app/repository/apiKeyRepository'
import { AuthRepository } from '@/app/repository/authRepository'
import { BudgetRepository } from '@/app/repository/budgetRepository'
import { CategoryRepository } from '@/app/repository/categoryRepository'
import { CertificateRepository } from '@/app/repository/certificateRepository'
import { CreditCardRepository } from '@/app/repository/creditcardRepository'
import { ExchangeRateRepository } from '@/app/repository/exchangeRateRepository'
import { InvestmentRepository } from '@/app/repository/investmentRepository'
import { LoanRepository } from '@/app/repository/loanRepository'
import { MonthlyPlanRepository } from '@/app/repository/monthlyPlanRepository'
import { SearchRepository } from '@/app/repository/searchRepository'
import { TransactionRepository } from '@/app/repository/transactionRepository'

// Crear instancias únicas
let accountRepositoryInstance: AccountRepository | null = null
let authRepositoryInstance: AuthRepository | null = null
let budgetRepositoryInstance: BudgetRepository | null = null
let categoryRepositoryInstance: CategoryRepository | null = null
let transactionRepositoryInstance: TransactionRepository | null = null
let analyticsRepositoryInstance: AnalyticsRepository | null = null
let searchRepositoryInstance: SearchRepository | null = null
let investmentRepositoryInstance: InvestmentRepository | null = null
let certificateRepositoryInstance: CertificateRepository | null = null
let exchangeRateRepositoryInstance: ExchangeRateRepository | null = null
let creditCardRepositoryInstance: CreditCardRepository | null = null
let loanRepositoryInstance: LoanRepository | null = null
let apiKeyRepositoryInstance: APIKeyRepository | null = null
let monthlyPlanRepositoryInstance: MonthlyPlanRepository | null = null

// Funciones para obtener repositorios (con singleton pattern)
export const getAccountRepository = async () => {
	if (!accountRepositoryInstance) {
		accountRepositoryInstance = new AccountRepository()
	}
	return accountRepositoryInstance
}

export const getAuthRepository = async () => {
	if (!authRepositoryInstance) {
		authRepositoryInstance = new AuthRepository()
	}
	return authRepositoryInstance
}

export const getBudgetRepository = async () => {
	if (!budgetRepositoryInstance) {
		budgetRepositoryInstance = new BudgetRepository()
	}
	return budgetRepositoryInstance
}

export const getCategoryRepository = async () => {
	if (!categoryRepositoryInstance) {
		categoryRepositoryInstance = new CategoryRepository()
	}
	return categoryRepositoryInstance
}

export const getTransactionRepository = async () => {
	if (!transactionRepositoryInstance) {
		transactionRepositoryInstance = new TransactionRepository()
	}
	return transactionRepositoryInstance
}

export const getAnalyticsRepository = async () => {
	if (!analyticsRepositoryInstance) {
		analyticsRepositoryInstance = new AnalyticsRepository()
	}
	return analyticsRepositoryInstance
}

export const getSearchRepository = async () => {
	if (!searchRepositoryInstance) {
		searchRepositoryInstance = new SearchRepository()
	}
	return searchRepositoryInstance
}

export const getInvestmentRepository = async () => {
	if (!investmentRepositoryInstance) {
		investmentRepositoryInstance = new InvestmentRepository()
	}
	return investmentRepositoryInstance
}

export const getCertificateRepository = async () => {
	if (!certificateRepositoryInstance) {
		certificateRepositoryInstance = new CertificateRepository()
	}
	return certificateRepositoryInstance
}

export const getExchangeRateRepository = async () => {
	if (!exchangeRateRepositoryInstance) {
		exchangeRateRepositoryInstance = new ExchangeRateRepository()
	}
	return exchangeRateRepositoryInstance
}

export const getCreditCardRepository = async () => {
	if (!creditCardRepositoryInstance) {
		creditCardRepositoryInstance = new CreditCardRepository()
	}
	return creditCardRepositoryInstance
}

export const getLoanRepository = async () => {
	if (!loanRepositoryInstance) {
		loanRepositoryInstance = new LoanRepository()
	}
	return loanRepositoryInstance
}

export const getAPIKeyRepository = async () => {
	if (!apiKeyRepositoryInstance) {
		apiKeyRepositoryInstance = new APIKeyRepository()
	}
	return apiKeyRepositoryInstance
}

export const getMonthlyPlanRepository = async () => {
	if (!monthlyPlanRepositoryInstance) {
		monthlyPlanRepositoryInstance = new MonthlyPlanRepository()
	}
	return monthlyPlanRepositoryInstance
}

// Exportar instancias directas para compatibilidad
export const accountRepository = new AccountRepository()
export const authRepository = new AuthRepository()
export const budgetRepository = new BudgetRepository()
export const categoryRepository = new CategoryRepository()
export const transactionRepository = new TransactionRepository()
export const analyticsRepository = new AnalyticsRepository()
export const searchRepository = new SearchRepository()
export const investmentRepository = new InvestmentRepository()
export const certificateRepository = new CertificateRepository()
export const exchangeRateRepository = new ExchangeRateRepository()
export const creditCardRepository = new CreditCardRepository()
export const loanRepository = new LoanRepository()
export const apiKeyRepository = new APIKeyRepository()
export const monthlyPlanRepository = new MonthlyPlanRepository()

// Función para verificar si estamos en modo mock
export const isMockMode = (): boolean => USE_MOCKS

// Función para obtener el estado de la configuración
export const getRepositoryConfig = () => ({
	useMocks: USE_MOCKS,
	mode: USE_MOCKS ? 'mock' : 'production',
})

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
