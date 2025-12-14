// Configuración centralizada para repositorios
// MODO DESARROLLO: Solo mocks activados para evitar problemas con next/headers

const USE_MOCKS = false // Cambiado a false para usar el backend real

// Importar solo los mocks
import { AccountRepositoryMock } from '@/mocks/accountRepositoryMock'
import { AuthRepositoryMock } from '@/mocks/authRepositoryMock'
import { BudgetRepositoryMock } from '@/mocks/budgetRepositoryMock'
import { BudgetRepository } from '@/app/repository/budgetRepository'
import { CategoryRepositoryMock } from '@/mocks/categoryRepositoryMock'
import { TransactionRepositoryMock } from '@/mocks/transactionRepositoryMock'
import { AnalyticsRepositoryMock } from '@/mocks/analyticsRepositoryMock'
// Importar el repositorio real
import { AuthRepository } from '@/app/repository/authRepository'
import { AccountRepository } from '@/app/repository/accountRepository'
import { TransactionRepository } from '@/app/repository/transactionRepository'
import { CategoryRepository } from '@/app/repository/categoryRepository'
import { AnalyticsRepository } from '@/app/repository/analyticsRepository'
import { SearchRepository } from '@/app/repository/searchRepository'
import { InvestmentRepository } from '@/app/repository/investmentRepository'

// Crear instancias únicas
let accountRepositoryInstance: AccountRepository | null = null;
let authRepositoryInstance: AuthRepository | null = null;
let budgetRepositoryInstance: BudgetRepository | null = null;
let categoryRepositoryInstance: CategoryRepository | null = null;
let transactionRepositoryInstance: TransactionRepository | null = null;
let analyticsRepositoryInstance: AnalyticsRepository | null = null;
let searchRepositoryInstance: SearchRepository | null = null;
let investmentRepositoryInstance: InvestmentRepository | null = null;

// Funciones para obtener repositorios (con singleton pattern)
export const getAccountRepository = async () => {
  if (!accountRepositoryInstance) {
    accountRepositoryInstance = new AccountRepository();
  }
  return accountRepositoryInstance;
};

export const getAuthRepository = async () => {
  if (!authRepositoryInstance) {
    authRepositoryInstance = new AuthRepository();
  }
  return authRepositoryInstance;
};

export const getBudgetRepository = async () => {
  if (!budgetRepositoryInstance) {
    budgetRepositoryInstance = new BudgetRepository();
  }
  return budgetRepositoryInstance;
};

export const getCategoryRepository = async () => {
  if (!categoryRepositoryInstance) {
    categoryRepositoryInstance = new CategoryRepository();
  }
  return categoryRepositoryInstance;
};

export const getTransactionRepository = async () => {
  if (!transactionRepositoryInstance) {
    transactionRepositoryInstance = new TransactionRepository();
  }
  return transactionRepositoryInstance;
};

export const getAnalyticsRepository = async () => {
  if (!analyticsRepositoryInstance) {
    analyticsRepositoryInstance = new AnalyticsRepository();
  }
  return analyticsRepositoryInstance;
};

export const getSearchRepository = async () => {
  if (!searchRepositoryInstance) {
    searchRepositoryInstance = new SearchRepository();
  }
  return searchRepositoryInstance;
};

export const getInvestmentRepository = async () => {
  if (!investmentRepositoryInstance) {
    investmentRepositoryInstance = new InvestmentRepository();
  }
  return investmentRepositoryInstance;
};

// Exportar instancias directas para compatibilidad
export const accountRepository = new AccountRepository();
export const authRepository = new AuthRepository();
export const budgetRepository = new BudgetRepository();
export const categoryRepository = new CategoryRepository();
export const transactionRepository = new TransactionRepository();
export const analyticsRepository = new AnalyticsRepository();
export const searchRepository = new SearchRepository();
export const investmentRepository = new InvestmentRepository();

// Función para verificar si estamos en modo mock
export const isMockMode = (): boolean => USE_MOCKS;

// Función para obtener el estado de la configuración
export const getRepositoryConfig = () => ({
  useMocks: USE_MOCKS,
  mode: USE_MOCKS ? 'mock' : 'production',
});

// Tipos
export type IAccountRepository = AccountRepositoryMock;
export type IAuthRepository = AuthRepositoryMock;
export type IBudgetRepository = BudgetRepository;
export type ICategoryRepository = CategoryRepositoryMock;
export type ITransactionRepository = TransactionRepositoryMock;
export type IAnalyticsRepository = AnalyticsRepository;
export type ISearchRepository = SearchRepository;
export type IInvestmentRepository = InvestmentRepository; 