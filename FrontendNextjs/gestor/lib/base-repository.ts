import { getSession } from "next-auth/react";
import { auth } from "@/auth";

export abstract class BaseRepository {
  protected readonly baseUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8080";

  protected async getAuthToken(): Promise<string | null> {
    try {
      // Intentar primero auth() (para Server Components)
      if (typeof window === 'undefined') {
        const session = await auth();
        return (session as any)?.accessToken || null;
      } else {
        // Para Client Components
        const session = await getSession();
        return (session as any)?.accessToken || null;
      }
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
    options: RequestInit = {},
    retryCount = 0
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

    // Handle 401 Unauthorized - token might be expired
    if (response.status === 401 && retryCount === 0) {
      // On client side, force session refresh which triggers JWT callback
      if (typeof window !== 'undefined') {
        try {
          // Force a session refresh - this will trigger the jwt callback
          // which will attempt to refresh the token
          const { getSession: refreshSession } = await import('next-auth/react');
          const newSession = await refreshSession();
          
          // Check if session has error (refresh failed)
          if ((newSession as any)?.error === "RefreshAccessTokenError") {
            // Redirect to login
            const { signOut } = await import('next-auth/react');
            await signOut({ callbackUrl: '/login' });
            throw new Error("Session expired. Please log in again.");
          }
          
          // Retry the request with the new token
          if (newSession?.accessToken) {
            return this.authenticatedFetch(endpoint, options, retryCount + 1);
          }
        } catch (refreshError) {
          console.error("Error refreshing session:", refreshError);
          throw new Error("Session expired. Please log in again.");
        }
      }
    }

    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status} - ${response.statusText}`;
      let errorCode: string | undefined;
      let errorDetails: unknown;
      const requestId = response.headers.get('X-Request-ID') || undefined;
      try {
        const errorData = await response.json();
        if (errorData?.error) {
          if (typeof errorData.error === 'string') {
            errorMessage = errorData.error;
          } else {
            errorMessage = errorData.error.message || errorMessage;
            errorCode = errorData.error.code;
            errorDetails = errorData.error.details;
          }
        } else if (typeof errorData?.err === 'string') {
          errorMessage = errorData.err;
        } else if (typeof errorData?.message === 'string') {
          errorMessage = errorData.message;
        }
      } catch (e) {
        // ignore json parse error
      }

      const error = new Error(errorMessage) as Error & {
        status?: number;
        code?: string;
        details?: unknown;
        requestId?: string;
      };
      error.status = response.status;
      error.code = errorCode;
      error.details = errorDetails;
      error.requestId = requestId;
      throw error;
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
