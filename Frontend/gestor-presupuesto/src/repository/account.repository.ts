import type {
  AccountInterface,
  AccoutInfoInterface,
} from "../interface/account.interface";

export class AccountRepotory {
  private url = `http:localhost:8080/account`;
  private headers: any = {
    "Content-Type": "application/json",
  };

  public async findAll(): Promise<AccoutInfoInterface[]> {
    const response = await fetch(this.url, this.headers);
    const result = await response.json();
    return result;
  }
  public async create(account: AccountInterface): Promise<void> {
    const options = {
      method: "POST",
      headers: {
        ...this.headers,
      },
      body: JSON.stringify(account),
    };
    fetch(this.url, options);
  }
  public async delete(accountId: string): Promise<void> {
    const options = {
      method: "DELETE",
      headers: {
        ...this.headers,
      },
    };
    fetch(`${this.url}/${accountId}`, options);
  }
}
