import type {
  AccoutInfoInterface,
  PostAccountInterface,
} from "../interface/account.interface";

export class AccountRepotory {
  private url = `${import.meta.env.HOST}/account`;

  private headers: any = {
    "Content-Type": "application/json",
  };

  public async findAll(): Promise<AccoutInfoInterface[]> {
    console.log(import.meta.env.HOST);
    const response = await fetch(this.url, this.headers);
    const result = await response.json();
    return result;
  }
  public async create(account: PostAccountInterface): Promise<void> {
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
