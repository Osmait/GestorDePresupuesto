import { useState, useEffect, useCallback } from 'react'
import { Account } from '@/types/account'
import { Category } from '@/types/category'
import { Transaction, TypeTransaction } from '@/types/transaction'
import { Budget } from '@/types/budget'
import { User } from '@/types/user'
import {
	getAccountRepository,
	getAuthRepository,
	getBudgetRepository,
	getCategoryRepository,
	getTransactionRepository,
	isMockMode,
	getAnalyticsRepository,
} from '@/lib/repositoryConfig'

// Hook para manejar cuentas
export function useAccounts() {
	const [accounts, setAccounts] = useState<Account[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const loadAccounts = useCallback(async () => {
		try {
			setIsLoading(true)
			setError(null)
			const accountRepository = await getAccountRepository()
			const data = await accountRepository.findAll()
			setAccounts(data)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error loading accounts')
		} finally {
			setIsLoading(false)
		}
	}, [])

  const createAccount = useCallback(async (
    name: string,
    bank: string,
    balance: number,
    userId: string
  ) => {
    try {
      setError(null);
      const accountRepository = await getAccountRepository();
      await accountRepository.create(name, bank, balance, userId);
      await loadAccounts(); // Recargar después de crear
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating account");
      throw err;
    }
  }, [loadAccounts]);

  const deleteAccount = useCallback(async (id: string) => {
    try {
      setError(null);
      const accountRepository = await getAccountRepository();
      await accountRepository.delete(id);
      await loadAccounts(); // Recargar después de eliminar
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting account");
      throw err;
    }
  }, [loadAccounts]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

	return {
		accounts,
		isLoading,
		error,
		createAccount,
		deleteAccount,
		refetch: loadAccounts,
	}
}

// Hook para manejar categorías
export const useCategories = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const categoryRepository = await getCategoryRepository();
      const data = await categoryRepository.findAll();
      setCategories(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading categories");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createCategory = useCallback(async (
    name: string,
    icon: string,
    color: string
  ) => {
    try {
      setError(null);
      const categoryRepository = await getCategoryRepository();
      await categoryRepository.create(name, icon, color);
      await loadCategories(); // Recargar después de crear
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating category");
      throw err;
    }
  }, [loadCategories]);

  const deleteCategory = useCallback(async (id: string) => {
    try {
      setError(null);
      const categoryRepository = await getCategoryRepository();
      await categoryRepository.delete(id);
      await loadCategories(); // Recargar después de eliminar
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting category");
      throw err;
    }
  }, [loadCategories]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  return {
    categories,
    isLoading,
    error,
    createCategory,
    deleteCategory,
    refetch: loadCategories,
  };
};

// Hook para manejar transacciones
export const useTransactions = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTransactions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const transactionRepository = await getTransactionRepository();
      const data = await transactionRepository.findAll();
      setTransactions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading transactions");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createTransaction = useCallback(async (
    name: string,
    description: string,
    amount: number,
    type: TypeTransaction,
    accountId: string,
    categoryId: string,
    budgetId?: string
  ) => {
    try {
      setError(null);
      const transactionRepository = await getTransactionRepository();
      await transactionRepository.create(
        name,
        description,
        amount,
        type,
        accountId,
        categoryId,
        budgetId
      );
      await loadTransactions(); // Recargar después de crear
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating transaction");
      throw err;
    }
  }, [loadTransactions]);

  const deleteTransaction = useCallback(async (id: string) => {
    try {
      setError(null);
      const transactionRepository = await getTransactionRepository();
      await transactionRepository.delete(id);
      await loadTransactions(); // Recargar después de eliminar
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting transaction");
      throw err;
    }
  }, [loadTransactions]);

  // Métodos adicionales para mocks
  const getTransactionsByAccount = useCallback(async (accountId: string) => {
    if (!isMockMode()) {
      throw new Error("This method is only available in mock mode");
    }
    
    try {
      const transactionRepository = await getTransactionRepository();
      const mockRepo = transactionRepository as any;
      return await mockRepo.findByAccount(accountId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error filtering transactions");
      throw err;
    }
  }, []);

  const getTransactionsByCategory = useCallback(async (categoryId: string) => {
    if (!isMockMode()) {
      throw new Error("This method is only available in mock mode");
    }
    
    try {
      const transactionRepository = await getTransactionRepository();
      const mockRepo = transactionRepository as any;
      return await mockRepo.findByCategory(categoryId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error filtering transactions");
      throw err;
    }
  }, []);

  const getTransactionStatistics = useCallback(async () => {
    if (!isMockMode()) {
      throw new Error("This method is only available in mock mode");
    }
    
    try {
      const transactionRepository = await getTransactionRepository();
      const mockRepo = transactionRepository as any;
      return await mockRepo.getStatistics();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error getting statistics");
      throw err;
    }
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  return {
    transactions,
    isLoading,
    error,
    createTransaction,
    deleteTransaction,
    getTransactionsByAccount,
    getTransactionsByCategory,
    getTransactionStatistics,
    refetch: loadTransactions,
  };
};

// Hook para manejar presupuestos
export const useBudgets = () => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBudgets = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const budgetRepository = await getBudgetRepository();
      const data = await budgetRepository.findAll();
      setBudgets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading budgets");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createBudget = useCallback(async (
    categoryId: string,
    amount: number
  ) => {
    try {
      setError(null);
      const budgetRepository = await getBudgetRepository();
      await budgetRepository.create(categoryId, amount);
      await loadBudgets(); // Recargar después de crear
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating budget");
      throw err;
    }
  }, [loadBudgets]);

  const deleteBudget = useCallback(async (id: string) => {
    try {
      setError(null);
      const budgetRepository = await getBudgetRepository();
      await budgetRepository.delete(id);
      await loadBudgets(); // Recargar después de eliminar
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting budget");
      throw err;
    }
  }, [loadBudgets]);

  useEffect(() => {
    loadBudgets();
  }, [loadBudgets]);

  return {
    budgets,
    isLoading,
    error,
    createBudget,
    deleteBudget,
    refetch: loadBudgets,
  };
};

// Hook para manejar autenticación
export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const authRepository = await getAuthRepository();
      const userData = await authRepository.login(email, password);
      setUser(userData);
      return userData;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signUp = useCallback(async (
    name: string,
    lastName: string,
    email: string,
    password: string
  ) => {
    try {
      setIsLoading(true);
      setError(null);
      const authRepository = await getAuthRepository();
      await authRepository.signUp(name, lastName, email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setError(null);
  }, []);

  const getProfile = useCallback(async (token: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const authRepository = await getAuthRepository();
      const userData = await authRepository.getProfile(token);
      setUser(userData);
      return userData;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get profile");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    user,
    isLoading,
    error,
    login,
    signUp,
    logout,
    getProfile,
  };
};

// Hook para manejar analíticas
export const useAnalytics = () => {
  // No state, just direct calls (puedes agregar loading/error si lo necesitas)
  const getOverview = async (params: any) => {
    const repo = await getAnalyticsRepository()
    return repo.getOverview(params)
  }
  const getBar = async (params: any) => {
    const repo = await getAnalyticsRepository()
    return repo.getBar(params)
  }
  const getPie = async (params: any) => {
    const repo = await getAnalyticsRepository()
    return repo.getPie(params)
  }
  const getRadar = async (params: any) => {
    const repo = await getAnalyticsRepository()
    return repo.getRadar(params)
  }
  const getHeatmap = async (params: any) => {
    const repo = await getAnalyticsRepository()
    return repo.getHeatmap(params)
  }
  return { getOverview, getBar, getPie, getRadar, getHeatmap }
}

// Hook combinado para dashboard
export const useDashboard = () => {
  const accounts = useAccounts();
  const categories = useCategories();
  const transactions = useTransactions();
  const budgets = useBudgets();
  const auth = useAuth();

  const isLoading = 
    accounts.isLoading || 
    categories.isLoading || 
    transactions.isLoading || 
    budgets.isLoading || 
    auth.isLoading;

  const hasError = 
    accounts.error || 
    categories.error || 
    transactions.error || 
    budgets.error || 
    auth.error;

  const refetchAll = useCallback(async () => {
    await Promise.all([
      accounts.refetch(),
      categories.refetch(),
      transactions.refetch(),
      budgets.refetch(),
    ]);
  }, [accounts.refetch, categories.refetch, transactions.refetch, budgets.refetch]);

  return {
    accounts,
    categories,
    transactions,
    budgets,
    auth,
    isLoading,
    hasError,
    refetchAll,
  };
}; 