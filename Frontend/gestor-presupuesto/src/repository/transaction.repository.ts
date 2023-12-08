import type { Transactions } from "../interface/transaction.interface";

export class TrasactionRepotory {
  private url = `http:localhost:8080/transaction`;
  private headers: any = {
    "Content-Type": "application/json",
  };

  async get() {
    const response = await fetch(this.url, this.headers);
    const result = await response.json();
    console.log(result);
    return result;
  }
  async create(transaction: Transactions) {
    const options = {
      method: "POST",
      headers: {
        ...this.headers,
      },
      body: JSON.stringify(transaction),
    };
    fetch(this.url, options);
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
