import { Transaction, TypeTransaction } from "@/types/transaction";

export class TransactionRepositoryMock {
  private mockTransactions: Transaction[] = [
    {
      id: "transaction-1",
      name: "Compra en supermercado",
      description: "Compra semanal de alimentos",
      amount: 150.75,
      type_transaction: TypeTransaction.BILL,
      account_id: "1",
      category_id: "category-1",
      budget_id: "budget-1",
      created_at: new Date("2024-01-15T10:30:00Z"),
    },
    {
      id: "transaction-2",
      name: "Salario mensual",
      description: "Pago de salario enero",
      amount: 2500.00,
      type_transaction: TypeTransaction.INCOME,
      account_id: "1",
      category_id: "category-5",
      created_at: new Date("2024-01-01T08:00:00Z"),
    },
    {
      id: "transaction-3",
      name: "Gasolina",
      description: "Tanque lleno de gasolina",
      amount: 60.00,
      type_transaction: TypeTransaction.BILL,
      account_id: "2",
      category_id: "category-2",
      budget_id: "budget-2",
      created_at: new Date("2024-01-16T14:20:00Z"),
    },
    {
      id: "transaction-4",
      name: "Cine",
      description: "Entrada de película con amigos",
      amount: 25.50,
      type_transaction: TypeTransaction.BILL,
      account_id: "1",
      category_id: "category-3",
      budget_id: "budget-3",
      created_at: new Date("2024-01-17T19:45:00Z"),
    },
    {
      id: "transaction-5",
      name: "Consulta médica",
      description: "Revisión general",
      amount: 80.00,
      type_transaction: TypeTransaction.BILL,
      account_id: "3",
      category_id: "category-4",
      budget_id: "budget-4",
      created_at: new Date("2024-01-18T11:15:00Z"),
    },
    {
      id: "transaction-6",
      name: "Venta online",
      description: "Ingresos por venta de productos",
      amount: 350.00,
      type_transaction: TypeTransaction.INCOME,
      account_id: "2",
      category_id: "category-8",
      created_at: new Date("2024-01-19T16:30:00Z"),
    },
    {
      id: "transaction-7",
      name: "Compra ropa",
      description: "Nuevas camisas para trabajo",
      amount: 120.00,
      type_transaction: TypeTransaction.BILL,
      account_id: "1",
      category_id: "category-7",
      created_at: new Date("2024-01-20T13:00:00Z"),
    },
    {
      id: "transaction-8",
      name: "Pago de servicios",
      description: "Luz, agua, internet",
      amount: 180.25,
      type_transaction: TypeTransaction.BILL,
      account_id: "3",
      category_id: "category-6",
      created_at: new Date("2024-01-21T09:30:00Z"),
    },
    // Transacciones adicionales para 2023-2025
    // 2023
    {
      id: 'transaction-2023-01', name: 'Supermercado', description: 'Compra mensual', amount: 120, type_transaction: TypeTransaction.BILL, account_id: '1', category_id: 'category-1', created_at: new Date('2023-01-10T10:00:00Z')
    },
    {
      id: 'transaction-2023-02', name: 'Salario', description: 'Pago mensual', amount: 2500, type_transaction: TypeTransaction.INCOME, account_id: '1', category_id: 'category-5', created_at: new Date('2023-01-31T08:00:00Z')
    },
    {
      id: 'transaction-2023-03', name: 'Gasolina', description: 'Tanque lleno', amount: 60, type_transaction: TypeTransaction.BILL, account_id: '2', category_id: 'category-2', created_at: new Date('2023-02-15T14:20:00Z')
    },
    {
      id: 'transaction-2023-04', name: 'Cine', description: 'Entretenimiento', amount: 30, type_transaction: TypeTransaction.BILL, account_id: '1', category_id: 'category-3', created_at: new Date('2023-03-05T19:45:00Z')
    },
    {
      id: 'transaction-2023-05', name: 'Venta online', description: 'Ingreso extra', amount: 400, type_transaction: TypeTransaction.INCOME, account_id: '2', category_id: 'category-8', created_at: new Date('2023-04-12T16:30:00Z')
    },
    {
      id: 'transaction-2023-06', name: 'Pago servicios', description: 'Luz y agua', amount: 180, type_transaction: TypeTransaction.BILL, account_id: '3', category_id: 'category-6', created_at: new Date('2023-05-21T09:30:00Z')
    },
    // 2024
    {
      id: 'transaction-2024-01', name: 'Supermercado', description: 'Compra mensual', amount: 130, type_transaction: TypeTransaction.BILL, account_id: '1', category_id: 'category-1', created_at: new Date('2024-01-10T10:00:00Z')
    },
    {
      id: 'transaction-2024-02', name: 'Salario', description: 'Pago mensual', amount: 2600, type_transaction: TypeTransaction.INCOME, account_id: '1', category_id: 'category-5', created_at: new Date('2024-01-31T08:00:00Z')
    },
    {
      id: 'transaction-2024-03', name: 'Gasolina', description: 'Tanque lleno', amount: 65, type_transaction: TypeTransaction.BILL, account_id: '2', category_id: 'category-2', created_at: new Date('2024-02-15T14:20:00Z')
    },
    {
      id: 'transaction-2024-04', name: 'Cine', description: 'Entretenimiento', amount: 35, type_transaction: TypeTransaction.BILL, account_id: '1', category_id: 'category-3', created_at: new Date('2024-03-05T19:45:00Z')
    },
    {
      id: 'transaction-2024-05', name: 'Venta online', description: 'Ingreso extra', amount: 420, type_transaction: TypeTransaction.INCOME, account_id: '2', category_id: 'category-8', created_at: new Date('2024-04-12T16:30:00Z')
    },
    {
      id: 'transaction-2024-06', name: 'Pago servicios', description: 'Luz y agua', amount: 185, type_transaction: TypeTransaction.BILL, account_id: '3', category_id: 'category-6', created_at: new Date('2024-05-21T09:30:00Z')
    },
    // 2025
    {
      id: 'transaction-2025-01', name: 'Supermercado', description: 'Compra mensual', amount: 140, type_transaction: TypeTransaction.BILL, account_id: '1', category_id: 'category-1', created_at: new Date('2025-01-10T10:00:00Z')
    },
    {
      id: 'transaction-2025-02', name: 'Salario', description: 'Pago mensual', amount: 2700, type_transaction: TypeTransaction.INCOME, account_id: '1', category_id: 'category-5', created_at: new Date('2025-01-31T08:00:00Z')
    },
    {
      id: 'transaction-2025-03', name: 'Gasolina', description: 'Tanque lleno', amount: 70, type_transaction: TypeTransaction.BILL, account_id: '2', category_id: 'category-2', created_at: new Date('2025-02-15T14:20:00Z')
    },
    {
      id: 'transaction-2025-04', name: 'Cine', description: 'Entretenimiento', amount: 40, type_transaction: TypeTransaction.BILL, account_id: '1', category_id: 'category-3', created_at: new Date('2025-03-05T19:45:00Z')
    },
    {
      id: 'transaction-2025-05', name: 'Venta online', description: 'Ingreso extra', amount: 450, type_transaction: TypeTransaction.INCOME, account_id: '2', category_id: 'category-8', created_at: new Date('2025-04-12T16:30:00Z')
    },
    {
      id: 'transaction-2025-06', name: 'Pago servicios', description: 'Luz y agua', amount: 190, type_transaction: TypeTransaction.BILL, account_id: '3', category_id: 'category-6', created_at: new Date('2025-05-21T09:30:00Z')
    },
    {
      id: 'transaction-2025-07', name: 'Supermercado', description: 'Compra mensual', amount: 145, type_transaction: TypeTransaction.BILL, account_id: '1', category_id: 'category-1', created_at: new Date('2025-07-10T10:00:00Z')
    },
    {
      id: 'transaction-2025-08', name: 'Restaurante', description: 'Cena con amigos', amount: 80, type_transaction: TypeTransaction.BILL, account_id: '2', category_id: 'category-9', created_at: new Date('2025-07-05T20:00:00Z')
    },
    {
      id: 'transaction-2025-09', name: 'Gimnasio', description: 'Pago mensual', amount: 50, type_transaction: TypeTransaction.BILL, account_id: '3', category_id: 'category-10', created_at: new Date('2025-07-02T08:00:00Z')
    },
    {
      id: 'transaction-2025-10', name: 'Freelance', description: 'Proyecto web', amount: 1200, type_transaction: TypeTransaction.INCOME, account_id: '2', category_id: 'category-11', created_at: new Date('2025-07-10T10:00:00Z')
    },
    {
      id: 'transaction-2025-11', name: 'Farmacia', description: 'Medicinas', amount: 60, type_transaction: TypeTransaction.BILL, account_id: '1', category_id: 'category-4', created_at: new Date('2025-07-12T15:00:00Z')
    },
    {
      id: 'transaction-2025-12', name: 'Supermercado', description: 'Compra semanal', amount: 200, type_transaction: TypeTransaction.BILL, account_id: '3', category_id: 'category-1', created_at: new Date('2025-07-15T18:00:00Z')
    },
    {
      id: 'transaction-2025-13', name: 'Venta de libro', description: 'Ingreso extra', amount: 90, type_transaction: TypeTransaction.INCOME, account_id: '1', category_id: 'category-12', created_at: new Date('2025-07-18T11:00:00Z')
    },
    // Transacciones adicionales para julio 2025
    {
      id: 'transaction-2025-07-01',
      name: 'Café matutino',
      description: 'Café en cafetería local',
      amount: 4.5,
      type_transaction: TypeTransaction.BILL,
      account_id: '1',
      category_id: 'category-3',
      created_at: new Date('2025-07-01T08:30:00Z'),
    },
    {
      id: 'transaction-2025-07-02',
      name: 'Ingreso freelance',
      description: 'Pago por diseño gráfico',
      amount: 300,
      type_transaction: TypeTransaction.INCOME,
      account_id: '2',
      category_id: 'category-11',
      created_at: new Date('2025-07-02T12:00:00Z'),
    },
    {
      id: 'transaction-2025-07-03',
      name: 'Supermercado',
      description: 'Compra semanal de víveres',
      amount: 95.2,
      type_transaction: TypeTransaction.BILL,
      account_id: '3',
      category_id: 'category-1',
      created_at: new Date('2025-07-03T17:45:00Z'),
    },
    {
      id: 'transaction-2025-07-04',
      name: 'Restaurante',
      description: 'Cena familiar',
      amount: 60,
      type_transaction: TypeTransaction.BILL,
      account_id: '2',
      category_id: 'category-9',
      created_at: new Date('2025-07-04T20:15:00Z'),
    },
    {
      id: 'transaction-2025-07-05',
      name: 'Venta de artículo',
      description: 'Venta de bicicleta usada',
      amount: 150,
      type_transaction: TypeTransaction.INCOME,
      account_id: '1',
      category_id: 'category-8',
      created_at: new Date('2025-07-05T10:00:00Z'),
    },
    {
      id: 'transaction-2025-07-06',
      name: 'Farmacia',
      description: 'Compra de medicamentos',
      amount: 32.8,
      type_transaction: TypeTransaction.BILL,
      account_id: '3',
      category_id: 'category-4',
      created_at: new Date('2025-07-06T15:30:00Z'),
    },
  ];

  findAll = async (): Promise<Transaction[]> => {
    // Simular delay del servidor (reducido)
    await new Promise(resolve => setTimeout(resolve, 200));
    return [...this.mockTransactions];
  };

  create = async (
    name: string,
    description: string,
    amount: number,
    typeTransaction: TypeTransaction,
    account_id: string,
    category_id: string,
    budget_id?: string,
  ): Promise<void> => {
    // Simular delay del servidor
    await new Promise(resolve => setTimeout(resolve, 700));
    
    const newTransaction: Transaction = {
      id: `transaction-${Date.now()}`,
      name,
      description,
      amount,
      type_transaction: typeTransaction,
      account_id,
      category_id,
      budget_id: budget_id || undefined,
      created_at: new Date(),
    };

    this.mockTransactions.push(newTransaction);
  };

  delete = async (id: string): Promise<void> => {
    // Simular delay del servidor
    await new Promise(resolve => setTimeout(resolve, 450));
    
    const index = this.mockTransactions.findIndex(transaction => transaction.id === id);
    if (index === -1) {
      throw new Error(`Transaction with id ${id} not found`);
    }
    
    this.mockTransactions.splice(index, 1);
  };

  // Métodos adicionales útiles para el frontend

  // Obtener transacciones por cuenta
  findByAccount = async (account_id: string): Promise<Transaction[]> => {
    // Simular delay del servidor
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return this.mockTransactions.filter(t => t.account_id === account_id);
  };

  // Obtener transacciones por categoría
  findByCategory = async (category_id: string): Promise<Transaction[]> => {
    // Simular delay del servidor
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return this.mockTransactions.filter(t => t.category_id === category_id);
  };

  // Obtener transacciones por tipo
  findByType = async (type: TypeTransaction): Promise<Transaction[]> => {
    // Simular delay del servidor
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return this.mockTransactions.filter(t => t.type_transaction === type);
  };

  // Obtener transacciones por rango de fechas
  findByDateRange = async (startDate: Date, endDate: Date): Promise<Transaction[]> => {
    // Simular delay del servidor
    await new Promise(resolve => setTimeout(resolve, 350));
    
    return this.mockTransactions.filter(t => {
      const transactionDate = new Date(t.created_at);
      return transactionDate >= startDate && transactionDate <= endDate;
    });
  };

  // Obtener estadísticas de transacciones
  getStatistics = async (): Promise<{
    totalIncome: number;
    totalExpenses: number;
    transactionCount: number;
    averageTransaction: number;
  }> => {
    // Simular delay del servidor
    await new Promise(resolve => setTimeout(resolve, 400));
    
    const incomeTransactions = this.mockTransactions.filter(t => t.type_transaction === TypeTransaction.INCOME);
    const expenseTransactions = this.mockTransactions.filter(t => t.type_transaction === TypeTransaction.BILL);
    
    const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalExpenses = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
    const transactionCount = this.mockTransactions.length;
    const averageTransaction = transactionCount > 0 ? (totalIncome + totalExpenses) / transactionCount : 0;
    
    return {
      totalIncome,
      totalExpenses,
      transactionCount,
      averageTransaction,
    };
  };

  /**
   * Obtiene transacciones filtradas, ordenadas y paginadas como lo haría el backend.
   * @param filters Filtros y opciones de paginación/ordenación
   */
  async getTransactions(filters: {
    accountId?: string
    categoryId?: string
    type?: 'INCOME' | 'BILL'
    dateFrom?: string
    dateTo?: string
    minAmount?: number
    maxAmount?: number
    search?: string
    sortBy?: 'date' | 'amount'
    sortOrder?: 'asc' | 'desc'
    limit?: number
    offset?: number
  }): Promise<Transaction[]> {
    let txs = [...this.mockTransactions]

    // Filtrado
    if (filters.accountId) {
      txs = txs.filter(t => t.account_id === filters.accountId)
    }
    if (filters.categoryId) {
      txs = txs.filter(t => t.category_id === filters.categoryId)
    }
    if (filters.type) {
      const typeVal = filters.type === 'INCOME' ? 1 : 0
      txs = txs.filter(t => t.type_transaction === typeVal)
    }
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom)
      txs = txs.filter(t => new Date(t.created_at) >= from)
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo)
      txs = txs.filter(t => new Date(t.created_at) <= to)
    }
    if (filters.minAmount !== undefined) {
      txs = txs.filter(t => t.amount >= filters.minAmount!)
    }
    if (filters.maxAmount !== undefined) {
      txs = txs.filter(t => t.amount <= filters.maxAmount!)
    }
    if (filters.search) {
      const s = filters.search.toLowerCase()
      txs = txs.filter(t =>
        t.name.toLowerCase().includes(s) ||
        (t.description && t.description.toLowerCase().includes(s))
      )
    }

    // Ordenación
    if (filters.sortBy) {
      const key = filters.sortBy === 'date' ? 'created_at' : 'amount'
      txs.sort((a, b) => {
        if (key === 'created_at') {
          return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * (filters.sortOrder === 'desc' ? -1 : 1)
        } else {
          return (a.amount - b.amount) * (filters.sortOrder === 'desc' ? -1 : 1)
        }
      })
    }

    // Paginación
    if (filters.offset !== undefined) {
      txs = txs.slice(filters.offset)
    }
    if (filters.limit !== undefined) {
      txs = txs.slice(0, filters.limit)
    }

    // Convertir fechas a string ISO para simular respuesta API
    return txs.map(t => ({ ...t, created_at: (t.created_at instanceof Date ? t.created_at.toISOString() : t.created_at) }))
  }
} 