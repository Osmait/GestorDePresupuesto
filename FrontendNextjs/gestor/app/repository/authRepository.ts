import Cookies from "js-cookie";
export class AuthRepository {
  private url = "http://127.0.0.1:8080";

  async login(email: string, password: string) {
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json", // Especificamos que estamos enviando datos JSON
      },
      body: JSON.stringify({ email, password }), // Convertimos el objeto JavaScript a formato JSON
    };
    try {
      const response = await fetch(`${this.url}/login`, options);
      const token = await response.json();
      Cookies.set("x-token", token);
      const user = await this.getProfile(token);
      console.log(user);
      return user;
    } catch (error) {
      console.log(error);
    }
  }
  async getProfile(token: string) {
    const options = {
      headers: {
        "Content-Type": "application/json", // Especificamos que estamos enviando datos JSON
        Authorization: `Bearer ${token}`,
      },
    };
    try {
      const response = await fetch(`${this.url}/profile`, options);
      const user = await response.json();
      return user;
    } catch (error) {
      console.log(error);
    }
  }
}
