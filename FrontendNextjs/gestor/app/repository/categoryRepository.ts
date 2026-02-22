import { Category } from "@/types/category";
import { BaseRepository } from "@/lib/base-repository";

export class CategoryRepository extends BaseRepository {
  async findAll(): Promise<Category[]> {
    const categories = await this.get<Category[]>("/category");
    return categories ?? [];
  }

  async create(name: string, icon: string, color: string): Promise<void> {
    await this.post("/category", { name, icon, color });
  }

  async update(id: string, name: string, icon: string, color: string): Promise<void> {
    await this.put(`/category/${id}`, { name, icon, color });
  }

  async delete(id: string): Promise<void> {
    await this.deleteRequest(`/category/${id}`);
  }

  async findById(id: string): Promise<Category> {
    return this.get<Category>(`/category/${id}`);
  }
}
