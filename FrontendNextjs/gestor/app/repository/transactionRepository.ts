import { Transaction, TypeTransaction } from "@/types/transaction";
import Cookies from "js-cookie";

export class TransactionRepository {
  private url = "http://127.0.0.1:8080";

  async findAll(): Promise<Transaction[]> {
    const token = Cookies.get("x-token");
    const options = {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    };
    try {
      const response = await fetch(`${this.url}/transaction`, options);
      const transactions: Transaction[] = await response.json();
      console.log(transactions);
      return transactions;
    } catch (error) {
      console.log(error);
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
    const token = Cookies.get("x-token");
    let typeTransactionString = "";
    if (typeTransaction === TypeTransaction.INCOME) typeTransactionString = "income";
    else if (typeTransaction === TypeTransaction.BILL) typeTransactionString = "bill";
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name,
        description,
        amount,
        type_transation: typeTransactionString,
        account_id,
        category_id,
        budget_id: budget_id ? budget_id : null,
      }),
    };
    console.log(options);
    try {
      const response = await fetch(`${this.url}/transaction`, options);
      const data = await response.json();
      console.log(data);
    } catch (error) {
      console.log(error);
    }
  }

  async delete(id: string): Promise<void> {
    const token = Cookies.get("x-token");
    const options = {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
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
