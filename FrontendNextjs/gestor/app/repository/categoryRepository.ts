import { Category } from "@/types/category";
import Cookies from "js-cookie";

export class CategoryRepository {
  private url = "http://127.0.0.1:8080";

  async findAll(): Promise<Category[]> {
    const token = Cookies.get("x-token");
    const options = {
      headers: {
        "Content-Type": "application/json", // Especificamos que estamos enviando datos JSON
        Authorization: `Bearer ${token}`,
      },
    };
    try {
      const response = await fetch(`${this.url}/category`, options);
      const category: Category[] = await response.json();
      return category;
    } catch (error) {
      return [];
    }
  }

  async create(name: string, icon: string, color: string): Promise<void> {
    const token = Cookies.get("x-token");
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json", // Especificamos que estamos enviando datos JSON
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, icon, color }), // Convertimos el objeto JavaScript a formato JSON
    };
    try {
      await fetch(`${this.url}/category`, options);
    } catch (error) {
      console.log(error);
    }
  }

  async delete(id: string) {
    const token = Cookies.get("x-token");
    const options = {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json", // Especificamos que estamos enviando datos JSON
        Authorization: `Bearer ${token}`,
      },
    };
    try {
      await fetch(`${this.url}/category/${id}`, options);
    } catch (error) {
      console.log(error);
    }
  }
}
