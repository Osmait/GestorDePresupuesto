import { Account } from "@/types/account";
import Cookies from "js-cookie";

export class AccountRepository {
  private url = "http://127.0.0.1:8080";

  async findAll(): Promise<Account[]> {
    const token = Cookies.get("x-token");
    console.log("token", token);
    const options = {
      headers: {
        "Content-Type": "application/json", // Especificamos que estamos enviando datos JSON
        Authorization: `Bearer ${token}`,
      },
    };

    try {
      const response = await fetch(`${this.url}/account`, options);
      const data = await response.json();
      console.log("data", data);
      // Normalizar la respuesta para que sea un array de Account plano
      const accounts = data.map((item: any) => ({
        ...item.account_info,
        current_balance: item.current_balance,
      }));
      return accounts;
    } catch (error) {
      console.log(error);
      return [];
    }
  }

  async create(
    name: string,
    bank: string,
    initial_balance: number,
  ): Promise<void> {
    const token = Cookies.get("x-token");
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json", // Especificamos que estamos enviando datos JSON
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, bank, initial_balance }), // Payload correcto para el backend
    };
    try {
      await fetch(`${this.url}/account`, options);
    } catch (error) {
      console.log(error);
    }
  }
  async delete(id: string): Promise<void> {
    const token = Cookies.get("x-token");
    const options = {
      method: "DELETE",
      headers: {
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
