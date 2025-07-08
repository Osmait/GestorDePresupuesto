import { Category } from "@/types/category";
import { BaseRepository } from "@/lib/base-repository";

export class CategoryRepository extends BaseRepository {
  async findAll(): Promise<Category[]> {
    try {
      const categories = await this.get<Category[]>("/category");
      console.log("categories data", categories);
      return categories;
    } catch (error) {
      console.error("Error fetching categories:", error);
      return [];
    }
  }

  async create(name: string, icon: string, color: string): Promise<void> {
    try {
      await this.post("/category", { name, icon, color });
    } catch (error) {
      console.error("Error creating category:", error);
      throw error;
    }
  }

  async update(id: string, name: string, icon: string, color: string): Promise<void> {
    try {
      await this.put(`/category/${id}`, { name, icon, color });
    } catch (error) {
      console.error("Error updating category:", error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.deleteRequest(`/category/${id}`);
    } catch (error) {
      console.error("Error deleting category:", error);
      throw error;
    }
  }

  async findById(id: string): Promise<Category | null> {
    try {
      return await this.get<Category>(`/category/${id}`);
    } catch (error) {
      console.error("Error fetching category by id:", error);
      return null;
    }
  }
}
