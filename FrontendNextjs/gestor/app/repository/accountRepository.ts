import { Account } from "@/types/account";
import { BaseRepository } from "@/lib/base-repository";

export class AccountRepository extends BaseRepository {
  async findAll(): Promise<Account[]> {
    const data = await this.get<any[]>("/account");

    // Normalizar la respuesta para que sea un array de Account plano
    const accounts = data.map((item: any) => ({
      ...item.account_info,
      current_balance: item.current_balance,
    }));
    return accounts;
  }

  async create(name: string, bank: string, initial_balance: number): Promise<void> {
    await this.post("/account", { name, bank, initial_balance });
  }

  async update(id: string, name: string, bank: string): Promise<void> {
    await this.put(`/account/${id}`, { name, bank });
  }

  async delete(id: string): Promise<void> {
    await this.deleteRequest(`/account/${id}`);
  }

  async findById(id: string): Promise<Account> {
    const data = await this.get<any>(`/account/${id}`);
    return {
      ...data.account_info,
      current_balance: data.current_balance,
    };
  }
}
