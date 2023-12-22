import type {
  AccoutInfoInterface,
  PostAccountInterface,
} from "../interface/account.interface";

export class AccountRepotory {
  private url = `http://localhost:8080/account`;

  private config = {
    headers: {
      "content-Type": "application/json",
      Authorization: "",
    },
  };
  constructor(token: string) {
    this.config.headers.Authorization = `Bearer ${token}`;
  }
  public async findAll(): Promise<AccoutInfoInterface[]> {
    try {
      const response = await fetch(this.url, this.config);
      const result = await response.json();
      return result;
    } catch (error) {
      return [];
    }
  }
  public async create(account: PostAccountInterface): Promise<void> {
    const options = {
      method: "POST",
      headers: {
        ...this.config.headers,
      },
      body: JSON.stringify(account),
    };
    fetch(this.url, options);
  }
  public async delete(accountId: string): Promise<void> {
    const options = {
      method: "DELETE",
      headers: {
        ...this.config.headers,
      },
    };
    fetch(`${this.url}/${accountId}`, options);
  }
}
