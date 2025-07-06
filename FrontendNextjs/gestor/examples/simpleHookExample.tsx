"use client";

import { useDashboard } from "@/hooks/useRepositories";
import { TypeTransaction } from "@/types/transaction";

const SimpleHookExample = () => {
  const { accounts, categories, transactions, auth, isLoading, hasError } = useDashboard();

  const handleLogin = async () => {
    try {
      await auth.login("juan.perez@example.com", "password123");
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleCreateAccount = async () => {
    try {
      await accounts.createAccount("Nueva Cuenta", "Banco Demo", 1000, "user-123");
    } catch (error) {
      console.error("Account creation failed:", error);
    }
  };

  const handleCreateTransaction = async () => {
    if (accounts.accounts.length === 0 || categories.categories.length === 0) {
      console.error("Need at least one account and one category");
      return;
    }

    try {
      await transactions.createTransaction(
        "Transacción de Ejemplo",
        "Descripción de prueba",
        100,
        TypeTransaction.BILL,
        accounts.accounts[0].id,
        categories.categories[0].id
      );
    } catch (error) {
      console.error("Transaction creation failed:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Cargando datos...</div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-600">
          Error: {hasError}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Hook Usage Example</h1>
      
      {/* Auth Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Authentication</h2>
        {auth.user ? (
          <div className="space-y-2">
            <p className="text-green-600">
              ✓ Logged in as: {auth.user.name} {auth.user.last_name}
            </p>
            <button
              onClick={auth.logout}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogin}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Login as Juan Pérez
          </button>
        )}
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Accounts</h3>
          <p className="text-2xl font-bold text-blue-600">{accounts.accounts.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Categories</h3>
          <p className="text-2xl font-bold text-green-600">{categories.categories.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 text-center">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Transactions</h3>
          <p className="text-2xl font-bold text-purple-600">{transactions.transactions.length}</p>
        </div>
      </div>

      {/* Actions Section */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Actions</h2>
        <div className="space-x-4">
          <button
            onClick={handleCreateAccount}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Create Account
          </button>
          <button
            onClick={handleCreateTransaction}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            Create Transaction
          </button>
        </div>
      </div>

      {/* Quick View Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Accounts */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Accounts</h2>
          <div className="space-y-3">
            {accounts.accounts.slice(0, 3).map(account => (
              <div key={account.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium">{account.name_account}</p>
                  <p className="text-sm text-gray-600">{account.bank}</p>
                </div>
                <p className="font-bold text-green-600">${account.balance.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Categories */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Categories</h2>
          <div className="grid grid-cols-2 gap-3">
            {categories.categories.slice(0, 6).map(category => (
              <div key={category.id} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                <span className="text-lg">{category.icon}</span>
                <span className="text-sm font-medium">{category.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-lg shadow p-6 mt-8">
        <h2 className="text-xl font-semibold mb-4">Recent Transactions</h2>
        <div className="space-y-3">
          {transactions.transactions.slice(0, 5).map(transaction => (
            <div key={transaction.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
              <div>
                <p className="font-medium">{transaction.name}</p>
                <p className="text-sm text-gray-600">{transaction.description}</p>
              </div>
              <p className={`font-bold ${
                transaction.type_transaction === TypeTransaction.INCOME 
                  ? 'text-green-600' 
                  : 'text-red-600'
              }`}>
                {transaction.type_transaction === TypeTransaction.INCOME ? '+' : '-'}
                ${transaction.amount.toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SimpleHookExample; 