import { Account } from "@/types/account";
import { cookies } from "next/headers";
export class AccountRepository {
  private url = "http://127.0.0.1:8080";

  async findAll(): Promise<Account[]> {
    const token = cookies().get("x-token");
    const options = {
      headers: {
        "Content-Type": "application/json", // Especificamos que estamos enviando datos JSON
        Authorization: `Bearer ${token}`,
      },
    };
    try {
      const response = await fetch(`${this.url}/account`, options);
      const account: Account[] = await response.json();
      return account;
    } catch (error) {
      return [];
    }
  }

  async create(
    name_account: string,
    bank: string,
    balance: number,
    user_id: string,
  ): Promise<void> {
    const token = cookies().get("x-token");
    const options = {
      headers: {
        method: "POST",
        "Content-Type": "application/json", // Especificamos que estamos enviando datos JSON
        Authorization: `Bearer ${token}`,
      },

      body: JSON.stringify({ name_account, bank, balance, user_id }), // Convertimos el objeto JavaScript a formato JSON
    };
    try {
      await fetch(`${this.url}/account`, options);
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
      await fetch(`${this.url}/account/${id}`, options);
    } catch (error) {
      console.log(error);
    }
  }
}
