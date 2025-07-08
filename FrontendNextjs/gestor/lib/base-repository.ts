import { getSession } from "next-auth/react";

export abstract class BaseRepository {
  protected readonly baseUrl = "http://127.0.0.1:8080";

  protected async getAuthToken(): Promise<string | null> {
    try {
      const session = await getSession();
      return (session as any)?.accessToken || null;
    } catch (error) {
      console.error("Error getting session:", error);
      return null;
    }
  }

  protected async getAuthHeaders(): Promise<HeadersInit> {
    const token = await this.getAuthToken();
    return {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  protected async authenticatedFetch(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<Response> {
    const headers = await this.getAuthHeaders();
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} - ${response.statusText}`);
    }

    return response;
  }

  protected async get<T>(endpoint: string): Promise<T> {
    const response = await this.authenticatedFetch(endpoint);
    return response.json();
  }

  protected async post<T>(endpoint: string, data?: any): Promise<T | void> {
    const response = await this.authenticatedFetch(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
    
    if (response.headers.get("content-type")?.includes("application/json")) {
      return response.json();
    }
  }

  protected async put<T>(endpoint: string, data?: any): Promise<T | void> {
    const response = await this.authenticatedFetch(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
    
    if (response.headers.get("content-type")?.includes("application/json")) {
      return response.json();
    }
  }

  protected async deleteRequest(endpoint: string): Promise<void> {
    await this.authenticatedFetch(endpoint, {
      method: "DELETE",
    });
  }
}