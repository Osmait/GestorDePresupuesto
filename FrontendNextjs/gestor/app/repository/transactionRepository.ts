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
    currency?: string,
  ) {
    const body: Record<string, any> = {
      name,
      description,
      amount,
      type_transation: this.getTypeTransactionString(typeTransaction),
      account_id,
      category_id,
      budget_id: budget_id || null,
      currency: currency && currency.length === 3 ? currency : "DOP",
    };
    return body;
  }

  async findAll(filters?: TransactionFilters): Promise<PaginatedTransactionResponse> {
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
      return response;
  }

  async findAllSimple(): Promise<Transaction[]> {
    try {
      const allTransactions: Transaction[] = [];
      const pageSize = 100;
      let page = 1;
      let hasNextPage = true;
      let safetyCounter = 0;

      while (hasNextPage && safetyCounter < 100) {
        const response = await this.findAll({
          page,
          limit: pageSize,
          sort_by: 'created_at',
          sort_order: 'desc',
        });

        const pageData = response.data || [];
        allTransactions.push(...pageData);

        const pagination = response.pagination;
        hasNextPage = Boolean(pagination?.has_next_page) && pageData.length > 0;

        if (hasNextPage) {
          const nextPage = pagination?.next_page;
          page = (typeof nextPage === 'number' && nextPage > page) ? nextPage : page + 1;
        }

        safetyCounter += 1;
      }

      return allTransactions;
    } catch (error) {
      throw error;
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
    currency?: string,
    created_at?: Date,
  ): Promise<void> {
    try {
      const body = {
        ...this.buildTransactionBody(
          name, description, amount, typeTransaction, account_id, category_id, budget_id, currency
        ),
        created_at: created_at ? created_at.toISOString() : new Date().toISOString()
      };

      await this.post("/transaction", body);
    } catch (error) {
      console.error("[TransactionRepository] Error creating transaction:", error);
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
    currency?: string,
    created_at?: Date,
  ): Promise<void> {
    try {
      const body = {
        ...this.buildTransactionBody(
          name, description, amount, typeTransaction, account_id, category_id, budget_id, currency
        ),
        created_at: created_at ? created_at.toISOString() : undefined
      };
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
      return await this.get<Transaction>(`/transaction/${id}`);
  }
}
