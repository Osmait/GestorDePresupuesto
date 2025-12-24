
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

      const user = await this.getProfile(token);
      return user;
    } catch (error) {
      console.log(error);
    }
  }
  async signUp(
    name: string,
    lastName: string,
    email: string,
    password: string,
  ) {
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json", // Especificamos que estamos enviando datos JSON
      },
      body: JSON.stringify({ name, last_name: lastName, email, password }), // Usar last_name como espera el backend
    };
    try {
      await fetch(`${this.url}/user`, options);
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
  async createDemoUser() {
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    };
    try {
      const response = await fetch(`${this.url}/auth/demo`, options);
      if (!response.ok) {
        const errorData = await response.text();
        console.error("Demo login failed:", errorData);
        throw new Error(errorData || "Error creating demo account");
      }
      return await response.json(); // Returns the token string
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
}
