import { Account } from '@/types/account'

export class AccountRepositoryMock {
  private mockAccounts: Account[] = [
    {
      id: "1",
      name_account: "Cuenta Principal",
      bank: "Banco Nacional",
      balance: 15000.50,
      user_id: "user-123",
      created_at: "2024-01-15T10:30:00Z",
    },
    {
      id: "2",
      name_account: "Cuenta Ahorros",
      bank: "Banco Popular",
      balance: 8500.25,
      user_id: "user-123",
      created_at: "2024-02-01T14:20:00Z",
    },
    {
      id: "3",
      name_account: "Cuenta Corriente",
      bank: "Banco Industrial",
      balance: 3200.75,
      user_id: "user-123",
      created_at: "2024-02-15T09:45:00Z",
    },
  ];

  findAll = async (): Promise<Account[]> => {
    // Simular delay del servidor (reducido)
    await new Promise(resolve => setTimeout(resolve, 100));
    return [...this.mockAccounts];
  };

  create = async (
    name_account: string,
    bank: string,
    balance: number,
    user_id: string,
  ): Promise<void> => {
    // Simular delay del servidor
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const newAccount: Account = {
      id: `account-${Date.now()}`,
      name_account,
      bank,
      balance,
      user_id,
      created_at: new Date().toISOString(),
    };

    this.mockAccounts.push(newAccount);
  };

  delete = async (id: string): Promise<void> => {
    // Simular delay del servidor
    await new Promise(resolve => setTimeout(resolve, 400));
    
    const index = this.mockAccounts.findIndex(account => account.id === id);
    if (index === -1) {
      throw new Error(`Account with id ${id} not found`);
    }
    
    this.mockAccounts.splice(index, 1);
  };

  /**
   * Obtiene cuentas filtradas y paginadas como lo haría el backend.
   * @param filters Filtros y opciones de paginación
   */
  async getAccounts(filters: {
    userId?: string
    name?: string
    bank?: string
    dateFrom?: string
    dateTo?: string
    limit?: number
    offset?: number
  }): Promise<Account[]> {
    let accs = [...this.mockAccounts]
    if (filters.userId) {
      accs = accs.filter(a => a.user_id === filters.userId)
    }
    if (filters.name) {
      const s = filters.name.toLowerCase()
      accs = accs.filter(a => a.name_account.toLowerCase().includes(s))
    }
    if (filters.bank) {
      const s = filters.bank.toLowerCase()
      accs = accs.filter(a => a.bank.toLowerCase().includes(s))
    }
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom)
      accs = accs.filter(a => new Date(a.created_at) >= from)
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo)
      accs = accs.filter(a => new Date(a.created_at) <= to)
    }
    if (filters.offset !== undefined) {
      accs = accs.slice(filters.offset)
    }
    if (filters.limit !== undefined) {
      accs = accs.slice(0, filters.limit)
    }
    return accs.map(a => ({ ...a, created_at: a.created_at }))
  }
} 