import { Transaction, TypeTransaction } from "@/types/transaction";
import { cookies } from "next/headers";
export class TransactionRepository {
  private url = "http://127.0.0.1:8080";

  async findAll(): Promise<Transaction[]> {
    const token = cookies().get("x-token");
    const options = {
      headers: {
        "Content-Type": "application/json", // Especificamos que estamos enviando datos JSON
        Authorization: `Bearer ${token}`,
      },
    };
    try {
      const response = await fetch(`${this.url}/transaction`, options);
      const account: Transaction[] = await response.json();
      return account;
    } catch (error) {
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
    const token = cookies().get("x-token");
    const options = {
      headers: {
        method: "POST",
        "Content-Type": "application/json", // Especificamos que estamos enviando datos JSON
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name,
        description,
        amount,
        typeTransaction,
        account_id,
        category_id,
        budget_id: budget_id ? budget_id : null,
      }), // Convertimos el objeto JavaScript a formato JSON
    };
    try {
      await fetch(`${this.url}/transaction`, options);
    } catch (error) {
      console.log(error);
    }
  }
  async delete(id: string) {
    const token = cookies().get("x-token");
    const options = {
      headers: {
        method: "DELETE",
        "Content-Type": "application/json", // Especificamos que estamos enviando datos JSON
        Authorization: `Bearer ${token}`,
      },
    };
    try {
      await fetch(`${this.url}/transaction/${id}`, options);
    } catch (error) {
      console.log(error);
    }
  }
}
