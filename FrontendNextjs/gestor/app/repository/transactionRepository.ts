import { Transaction, TypeTransaction, PaginatedTransactionResponse, TransactionFilters } from "@/types/transaction";
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

  async findAll(filters?: TransactionFilters): Promise<PaginatedTransactionResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            queryParams.append(key, String(value));
          }
        });
      }
      
      const url = `/transaction${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await this.get<PaginatedTransactionResponse>(url);
      console.log("paginated transactions data", response);
      return response;
    } catch (error) {
      console.error("Error fetching transactions:", error);
      return {
        data: [],
        pagination: {
          current_page: 1,
          has_next_page: false,
          has_prev_page: false,
          next_page: 1,
          per_page: 20,
          prev_page: 1,
          total_pages: 1,
          total_records: 0
        }
      };
    }
  }

  async findAllSimple(): Promise<Transaction[]> {
    try {
      const response = await this.findAll({ limit: 1000 }); // Get a large limit for simple cases
      console.log("simple transactions data", response);
      return response.data;
    } catch (error) {
      console.error("Error fetching simple transactions:", error);
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
      console.log("body", body);
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
