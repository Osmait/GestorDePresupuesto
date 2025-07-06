// Configuración centralizada para repositorios
// MODO DESARROLLO: Solo mocks activados para evitar problemas con next/headers

const USE_MOCKS = true // SIEMPRE true durante desarrollo

// Importar solo los mocks
import { AccountRepositoryMock } from '@/mocks/accountRepositoryMock'
import { AuthRepositoryMock } from '@/mocks/authRepositoryMock'
import { BudgetRepositoryMock } from '@/mocks/budgetRepositoryMock'
import { CategoryRepositoryMock } from '@/mocks/categoryRepositoryMock'
import { TransactionRepositoryMock } from '@/mocks/transactionRepositoryMock'

// Crear instancias únicas
let accountRepositoryInstance: AccountRepositoryMock | null = null;
let authRepositoryInstance: AuthRepositoryMock | null = null;
let budgetRepositoryInstance: BudgetRepositoryMock | null = null;
let categoryRepositoryInstance: CategoryRepositoryMock | null = null;
let transactionRepositoryInstance: TransactionRepositoryMock | null = null;

// Funciones para obtener repositorios (con singleton pattern)
export const getAccountRepository = async () => {
  if (!accountRepositoryInstance) {
    accountRepositoryInstance = new AccountRepositoryMock();
  }
  return accountRepositoryInstance;
};

export const getAuthRepository = async () => {
  if (!authRepositoryInstance) {
    authRepositoryInstance = new AuthRepositoryMock();
  }
  return authRepositoryInstance;
};

export const getBudgetRepository = async () => {
  if (!budgetRepositoryInstance) {
    budgetRepositoryInstance = new BudgetRepositoryMock();
  }
  return budgetRepositoryInstance;
};

export const getCategoryRepository = async () => {
  if (!categoryRepositoryInstance) {
    categoryRepositoryInstance = new CategoryRepositoryMock();
  }
  return categoryRepositoryInstance;
};

export const getTransactionRepository = async () => {
  if (!transactionRepositoryInstance) {
    transactionRepositoryInstance = new TransactionRepositoryMock();
  }
  return transactionRepositoryInstance;
};

// Exportar instancias directas para compatibilidad
export const accountRepository = new AccountRepositoryMock();
export const authRepository = new AuthRepositoryMock();
export const budgetRepository = new BudgetRepositoryMock();
export const categoryRepository = new CategoryRepositoryMock();
export const transactionRepository = new TransactionRepositoryMock();

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
export type IBudgetRepository = BudgetRepositoryMock;
export type ICategoryRepository = CategoryRepositoryMock;
export type ITransactionRepository = TransactionRepositoryMock; 