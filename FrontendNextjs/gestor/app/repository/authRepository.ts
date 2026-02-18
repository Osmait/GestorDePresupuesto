// Auth response from backend /auth/login endpoint
export interface AuthTokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export class AuthRepository {
  private url = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8080";

  // Legacy login - returns just the token string
  async login(email: string, password: string) {
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
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

  // New login with refresh token support
  async loginWithTokens(email: string, password: string): Promise<AuthTokenResponse | null> {
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    };
    try {
      const response = await fetch(`${this.url}/auth/login`, options);
      if (!response.ok) {
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error("Login error:", error);
      return null;
    }
  }

  // Refresh tokens
  async refreshTokens(refreshToken: string): Promise<AuthTokenResponse | null> {
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    };
    try {
      const response = await fetch(`${this.url}/auth/refresh`, options);
      if (!response.ok) {
        console.error("Token refresh failed:", response.status);
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error("Refresh error:", error);
      return null;
    }
  }

  // Logout - revoke refresh token
  async logout(refreshToken: string): Promise<boolean> {
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    };
    try {
      const response = await fetch(`${this.url}/auth/logout`, options);
      return response.ok;
    } catch (error) {
      console.error("Logout error:", error);
      return false;
    }
  }

  // Logout from all devices
  async logoutAll(accessToken: string): Promise<boolean> {
    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    };
    try {
      const response = await fetch(`${this.url}/auth/logout-all`, options);
      return response.ok;
    } catch (error) {
      console.error("Logout all error:", error);
      return false;
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
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, last_name: lastName, email, password }),
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
        "Content-Type": "application/json",
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
