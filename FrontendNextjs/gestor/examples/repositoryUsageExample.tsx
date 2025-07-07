"use client";

import { useState, useEffect } from "react";
import { Account } from "@/types/account";
import { Category } from "@/types/category";
import { Transaction, TypeTransaction } from "@/types/transaction";
import { Budget } from "@/types/budget";
import { User } from "@/types/user";
import {
  accountRepository,
  authRepository,
  budgetRepository,
  categoryRepository,
  transactionRepository,
  isMockMode,
  getRepositoryConfig,
} from "@/lib/repositoryConfig";

// Ejemplo de componente que usa los repositorios
const DashboardExample = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar datos al montar el componente
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Cargar todos los datos en paralelo
        const [accountsData, categoriesData, transactionsData, budgetsData] = 
          await Promise.all([
            accountRepository.findAll(),
            categoryRepository.findAll(),
            transactionRepository.findAll(),
            budgetRepository.findAll(),
          ]);

        setAccounts(accountsData);
        setCategories(categoriesData);
        setTransactions(transactionsData);
        setBudgets(budgetsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error loading data");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Función para crear una nueva cuenta
  const handleCreateAccount = async (
    name: string,
    bank: string,
    balance: number
  ) => {
    try {
      await accountRepository.create(name, bank, balance, "user-123");
      // Recargar cuentas después de crear
      const updatedAccounts = await accountRepository.findAll();
      setAccounts(updatedAccounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating account");
    }
  };

  // Función para crear una nueva transacción
  const handleCreateTransaction = async (
    name: string,
    description: string,
    amount: number,
    type: TypeTransaction,
    accountId: string,
    categoryId: string,
    budgetId?: string
  ) => {
    try {
      await transactionRepository.create(
        name,
        description,
        amount,
        type,
        accountId,
        categoryId,
        budgetId
      );
      // Recargar transacciones después de crear
      const updatedTransactions = await transactionRepository.findAll();
      setTransactions(updatedTransactions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating transaction");
    }
  };

  // Función para login
  const handleLogin = async (email: string, password: string) => {
    try {
      const userData = await authRepository.login(email, password);
      setUser(userData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };

  // Función para eliminar cuenta
  const handleDeleteAccount = async (accountId: string) => {
    try {
      await accountRepository.delete(accountId);
      // Recargar cuentas después de eliminar
      const updatedAccounts = await accountRepository.findAll();
      setAccounts(updatedAccounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting account");
    }
  };

  // Calcular totales
  const calculateTotals = () => {
    const totalIncome = transactions
      .filter(t => t.type_transaction === TypeTransaction.INCOME)
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = transactions
      .filter(t => t.type_transaction === TypeTransaction.BILL)
      .reduce((sum, t) => sum + t.amount, 0);

    const totalBalance = (accounts ?? []).reduce((sum, a) => sum + a.initial_balance, 0);

    return { totalIncome, totalExpenses, totalBalance };
  };

  const { totalIncome, totalExpenses, totalBalance } = calculateTotals();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header con información del modo */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Dashboard de Ejemplo
        </h1>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-blue-800">
            <strong>Modo actual:</strong> {getRepositoryConfig().mode}
            {isMockMode() && " (usando datos simulados)"}
          </p>
        </div>
      </div>

      {/* Mostrar error si existe */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">
            <strong>Error:</strong> {error}
          </p>
          <button
            onClick={() => setError(null)}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Resumen financiero */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            Balance Total
          </h3>
          <p className="text-2xl font-bold text-green-600">
            ${totalBalance.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            Ingresos
          </h3>
          <p className="text-2xl font-bold text-blue-600">
            ${totalIncome.toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">
            Gastos
          </h3>
          <p className="text-2xl font-bold text-red-600">
            ${totalExpenses.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Sección de Cuentas */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">
            Cuentas ({accounts?.length ?? 0})
          </h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.isArray(accounts) && accounts.map(account => (
              <div
                key={account.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <h3 className="font-semibold text-gray-800 mb-1">
                  {account.name}
                </h3>
                <p className="text-sm text-gray-600 mb-2">{account.bank}</p>
                <p className="text-lg font-bold text-green-600 mb-3">
                  ${account.initial_balance.toLocaleString()}
                </p>
                <button
                  onClick={() => handleDeleteAccount(account.id)}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sección de Categorías */}
      <div className="bg-white rounded-lg shadow mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">
            Categorías ({categories.length})
          </h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {categories.map(category => (
              <div
                key={category.id}
                className="border border-gray-200 rounded-lg p-4 text-center hover:shadow-md transition-shadow"
              >
                <div className="text-2xl mb-2">{category.icon}</div>
                <h3 className="font-semibold text-gray-800 text-sm">
                  {category.name}
                </h3>
                <div
                  className="w-4 h-4 rounded-full mx-auto mt-2"
                  style={{ backgroundColor: category.color }}
                ></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sección de Transacciones Recientes */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">
            Transacciones Recientes ({transactions.length})
          </h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {transactions.slice(0, 5).map(transaction => (
              <div
                key={transaction.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
              >
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800 mb-1">
                    {transaction.name}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {transaction.description}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(transaction.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`font-bold ${
                      transaction.type_transaction === TypeTransaction.INCOME
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {transaction.type_transaction === TypeTransaction.INCOME
                      ? "+"
                      : "-"}
                    ${transaction.amount.toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ejemplo de formulario de login */}
      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          Ejemplo de Login
        </h2>
        <button
          onClick={() => handleLogin("juan.perez@example.com", "password123")}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Login como Juan Pérez
        </button>
        {user && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
            <p className="text-green-800">
              <strong>Usuario logueado:</strong> {user.name} {user.last_name}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardExample; 