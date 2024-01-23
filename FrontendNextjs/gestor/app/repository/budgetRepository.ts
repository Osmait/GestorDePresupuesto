import { Budget } from "@/types/budget";
import { cookies } from "next/headers";
export class BudgetRepository {
  private url = "http://127.0.0.1:8080";

  async findAll(): Promise<Budget[]> {
    const token = cookies().get("x-token");
    const options = {
      headers: {
        "Content-Type": "application/json", // Especificamos que estamos enviando datos JSON
        Authorization: `Bearer ${token}`,
      },
    };
    try {
      const response = await fetch(`${this.url}/budget`, options);
      const account: Budget[] = await response.json();
      return account;
    } catch (error) {
      return [];
    }
  }

  async create(category_id: string, amount: number): Promise<void> {
    const token = cookies().get("x-token");
    const options = {
      headers: {
        method: "POST",
        "Content-Type": "application/json", // Especificamos que estamos enviando datos JSON
        Authorization: `Bearer ${token}`,
      },

      body: JSON.stringify({ category_id, amount }), // Convertimos el objeto JavaScript a formato JSON
    };
    try {
      await fetch(`${this.url}/budget`, options);
    } catch (error) {
      console.log(error);
    }
  }

  async delete(id: string): Promise<void> {
    const token = cookies().get("x-token");
    const options = {
      headers: {
        method: "DELETE",
        "Content-Type": "application/json", // Especificamos que estamos enviando datos JSON
        Authorization: `Bearer ${token}`,
      },
    };
    try {
      await fetch(`${this.url}/budget/${id}`, options);
    } catch (error) {
      console.log(error);
    }
  }
}
