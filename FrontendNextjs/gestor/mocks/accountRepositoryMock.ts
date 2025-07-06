import { Account } from '@/types/account'

export class AccountRepositoryMock {
  private mockAccounts: Account[] = [
    {
      id: "1",
      name_account: "Cuenta Principal",
      bank: "Banco Nacional",
      balance: 15000.50,
      user_id: "user-123",
      created_at: new Date("2024-01-15T10:30:00Z"),
    },
    {
      id: "2",
      name_account: "Cuenta Ahorros",
      bank: "Banco Popular",
      balance: 8500.25,
      user_id: "user-123",
      created_at: new Date("2024-02-01T14:20:00Z"),
    },
    {
      id: "3",
      name_account: "Cuenta Corriente",
      bank: "Banco Industrial",
      balance: 3200.75,
      user_id: "user-123",
      created_at: new Date("2024-02-15T09:45:00Z"),
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
      created_at: new Date(),
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
} 