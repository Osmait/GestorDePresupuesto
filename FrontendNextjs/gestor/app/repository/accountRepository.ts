import { Account } from "@/types/account";
import { BaseRepository } from "@/lib/base-repository";

export class AccountRepository extends BaseRepository {
  async findAll(): Promise<Account[]> {
    try {
      const data = await this.get<any[]>("/account");
      
      // Normalizar la respuesta para que sea un array de Account plano
      const accounts = data.map((item: any) => ({
        ...item.account_info,
        current_balance: item.current_balance,
      }));
      return accounts;
    } catch (error) {
      console.error("Error fetching accounts:", error);
      return [];
    }
  }

  async create(name: string, bank: string, initial_balance: number): Promise<void> {
    try {
      await this.post("/account", { name, bank, initial_balance });
    } catch (error) {
      console.error("Error creating account:", error);
      throw error;
    }
  }

  async update(id: string, name: string, bank: string): Promise<void> {
    try {
      await this.put(`/account/${id}`, { name, bank });
    } catch (error) {
      console.error("Error updating account:", error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.deleteRequest(`/account/${id}`);
    } catch (error) {
      console.error("Error deleting account:", error);
      throw error;
    }
  }

  async findById(id: string): Promise<Account | null> {
    try {
      const data = await this.get<any>(`/account/${id}`);
      return {
        ...data.account_info,
        current_balance: data.current_balance,
      };
    } catch (error) {
      console.error("Error fetching account by id:", error);
      return null;
    }
  }
}
