import { Budget } from "@/types/budget";
import { BaseRepository } from "@/lib/base-repository";

export class BudgetRepository extends BaseRepository {
  async findAll(): Promise<Budget[]> {
    return this.get<Budget[]>("/budget");
  }

  async create(category_id: string, amount: number): Promise<void> {
    await this.post("/budget", { category_id, amount });
  }


  async delete(id: string): Promise<void> {
    await this.deleteRequest(`/budget/${id}`);
  }

  async update(id: string, category_id: string, amount: number): Promise<void> {
    await this.put(`/budget/${id}`, { category_id, amount });
  }

  async findById(id: string): Promise<Budget> {
    return this.get<Budget>(`/budget/${id}`);
  }
}
