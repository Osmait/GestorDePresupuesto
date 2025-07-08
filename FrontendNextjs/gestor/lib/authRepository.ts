import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"

export class AuthRepository {
  private url = "http://127.0.0.1:8080"

  // Cliente: obtener token de la sesión activa
  async getAuthToken(): Promise<string | null> {
    // En el cliente, obtenemos el token de la sesión de NextAuth
    if (typeof window !== "undefined") {
      const { getSession } = await import("next-auth/react")
      const session = await getSession()
      return session?.accessToken || null
    }
    
    // En el servidor, obtenemos el token de la sesión del servidor
    const session = await getServerSession(authOptions)
    return (session as any)?.accessToken || null
  }

  // Método para hacer requests autenticados
  async authenticatedFetch(url: string, options: RequestInit = {}) {
    const token = await this.getAuthToken()
    
    if (!token) {
      throw new Error("No hay token de autenticación disponible")
    }

    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
  }

  async getProfile() {
    try {
      const response = await this.authenticatedFetch(`${this.url}/profile`)
      
      if (!response.ok) {
        throw new Error("Error al obtener el perfil")
      }

      return await response.json()
    } catch (error) {
      console.error("Error en getProfile:", error)
      throw error
    }
  }

  async updateProfile(data: any) {
    try {
      const response = await this.authenticatedFetch(`${this.url}/profile`, {
        method: "PUT",
        body: JSON.stringify(data),
      })
      
      if (!response.ok) {
        throw new Error("Error al actualizar el perfil")
      }

      return await response.json()
    } catch (error) {
      console.error("Error en updateProfile:", error)
      throw error
    }
  }
}

export const authRepository = new AuthRepository()