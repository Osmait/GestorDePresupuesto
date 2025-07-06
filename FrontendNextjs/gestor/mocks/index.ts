// Exportar todas las clases mock para fácil acceso
export { AccountRepositoryMock } from "./accountRepositoryMock";
export { AuthRepositoryMock } from "./authRepositoryMock";
export { BudgetRepositoryMock } from "./budgetRepositoryMock";
export { CategoryRepositoryMock } from "./categoryRepositoryMock";
export { TransactionRepositoryMock } from "./transactionRepositoryMock";

// Exportar tipos principales
export type {
  IAccountRepository,
  IAuthRepository,
  IBudgetRepository,
  ICategoryRepository,
  ITransactionRepository,
} from "../lib/repositoryConfig";

// Exportar configuración
export {
  accountRepository,
  authRepository,
  budgetRepository,
  categoryRepository,
  transactionRepository,
  isMockMode,
  getRepositoryConfig,
} from "../lib/repositoryConfig";

// Exportar hooks
export {
  useAccounts,
  useAuth,
  useBudgets,
  useCategories,
  useTransactions,
  useDashboard,
} from "../hooks/useRepositories"; 