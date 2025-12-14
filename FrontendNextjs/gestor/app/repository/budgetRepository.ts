import { Budget } from "@/types/budget";
import { BaseRepository } from "@/lib/base-repository";

export class BudgetRepository extends BaseRepository {
  async findAll(): Promise<Budget[]> {
    try {
      const budgets = await this.get<Budget[]>("/budget");
      console.log("budgets data", budgets);
      return budgets;
    } catch (error) {
      console.error("Error fetching budgets:", error);
      return [];
    }
  }

  async create(category_id: string, amount: number): Promise<void> {
    try {
      await this.post("/budget", { category_id, amount });
    } catch (error) {
      console.error("Error creating budget:", error);
      throw error;
    }
  }


  async delete(id: string): Promise<void> {
    try {
      await this.deleteRequest(`/budget/${id}`);
    } catch (error) {
      console.error("Error deleting budget:", error);
      throw error;
    }
  }

  async update(id: string, category_id: string, amount: number): Promise<void> {
    try {
      await this.put(`/budget/${id}`, { category_id, amount });
    } catch (error) {
      console.error("Error updating budget:", error);
      throw error;
    }
  }

  async findById(id: string): Promise<Budget | null> {
    try {
      return await this.get<Budget>(`/budget/${id}`);
    } catch (error) {
      console.error("Error fetching budget by id:", error);
      return null;
    }
  }
}
