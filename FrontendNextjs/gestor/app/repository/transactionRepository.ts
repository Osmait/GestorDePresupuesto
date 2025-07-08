import { Transaction, TypeTransaction } from "@/types/transaction";
import { BaseRepository } from "@/lib/base-repository";

export class TransactionRepository extends BaseRepository {
  private getTypeTransactionString(typeTransaction: TypeTransaction): string {
    if (typeTransaction === TypeTransaction.INCOME) return "income";
    if (typeTransaction === TypeTransaction.BILL) return "bill";
    return "";
  }

  private buildTransactionBody(
    name: string,
    description: string,
    amount: number,
    typeTransaction: TypeTransaction,
    account_id: string,
    category_id: string,
    budget_id?: string,
  ) {
    return {
      name,
      description,
      amount,
      type_transation: this.getTypeTransactionString(typeTransaction),
      account_id,
      category_id,
      budget_id: budget_id || null,
    };
  }

  async findAll(): Promise<Transaction[]> {
    try {
      const transactions = await this.get<Transaction[]>("/transaction");
      console.log("transactions data", transactions);
      return transactions;
    } catch (error) {
      console.error("Error fetching transactions:", error);
      return [];
    }
  }

  async create(
    name: string,
    description: string,
    amount: number,
    typeTransaction: TypeTransaction,
    account_id: string,
    category_id: string,
    budget_id?: string,
  ): Promise<void> {
    try {
      const body = this.buildTransactionBody(
        name, description, amount, typeTransaction, account_id, category_id, budget_id
      );
      const data = await this.post("/transaction", body);
      console.log("transaction created", data);
    } catch (error) {
      console.error("Error creating transaction:", error);
      throw error;
    }
  }

  async update(
    id: string,
    name: string,
    description: string,
    amount: number,
    typeTransaction: TypeTransaction,
    account_id: string,
    category_id: string,
    budget_id?: string,
  ): Promise<void> {
    try {
      const body = this.buildTransactionBody(
        name, description, amount, typeTransaction, account_id, category_id, budget_id
      );
      await this.put(`/transaction/${id}`, body);
    } catch (error) {
      console.error("Error updating transaction:", error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.deleteRequest(`/transaction/${id}`);
    } catch (error) {
      console.error("Error deleting transaction:", error);
      throw error;
    }
  }

  async findById(id: string): Promise<Transaction | null> {
    try {
      return await this.get<Transaction>(`/transaction/${id}`);
    } catch (error) {
      console.error("Error fetching transaction by id:", error);
      return null;
    }
  }
}
