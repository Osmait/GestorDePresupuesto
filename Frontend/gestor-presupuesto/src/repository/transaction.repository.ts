import type { Transactions } from "../interface/transaction.interface";

export class TrasactionRepotory {
  private url = `${import.meta.env.API}/transaction`;
  private config = {
    headers: {
      "content-Type": "application/json",
      Authorization: "",
    },
  };
  constructor(token: string) {
    this.config.headers.Authorization = `Bearer ${token}`;
  }

  async get(id?: string): Promise<Transactions[]> {
    const transactionUrl = id ? `${this.url}/${id}` : this.url;
    try {
      const response = await fetch(transactionUrl, this.config);
      const result = await response.json();
      return result;
    } catch (error) {
      return [];
    }
  }
  async create(transaction: Transactions) {
    const options = {
      method: "POST",
      headers: {
        ...this.config.headers,
      },
      body: JSON.stringify(transaction),
    };
    const response = await fetch(this.url, options);
  }
  async delele(id: string) {
    const options = {
      method: "DELETE",
      headers: {
        ...this.config.headers,
      },
    };
    fetch(`${this.url}/${id}`, options);
  }
}
