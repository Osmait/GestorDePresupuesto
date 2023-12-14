import type { Transactions } from "../interface/transaction.interface";

export class TrasactionRepotory {
  private url = `${import.meta.env.HOST}/transaction`;
  private headers: any = {
    "Content-Type": "application/json",
  };

  async get(id: string): Promise<Transactions[]> {
    try {
      const response = await fetch(`${this.url}/${id}`, this.headers);
      console.log(response);
      const result = await response.json();
      return result;
    } catch (error) {
      console.log(error);
      return [];
    }
  }
  async create(transaction: Transactions) {
    const options = {
      method: "POST",
      headers: {
        ...this.headers,
      },
      body: JSON.stringify(transaction),
    };
    console.log(options);
    const response = await fetch(this.url, options);
    console.log(response);
  }
  async delele(id: string) {
    const options = {
      method: "DELETE",
      headers: {
        ...this.headers,
      },
    };
    fetch(`${this.url}/${id}`, options);
  }
}
