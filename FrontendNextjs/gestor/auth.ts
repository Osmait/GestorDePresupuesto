import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"
import type { JWT } from "next-auth/jwt"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const BASE_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8080";

// Refresh access token using the refresh token
async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: token.refreshToken }),
    })

    if (!response.ok) {
      console.error("Failed to refresh token:", response.status)
      return {
        ...token,
        error: "RefreshAccessTokenError",
      }
    }

    const newTokens = await response.json()

    return {
      ...token,
      accessToken: newTokens.access_token,
      refreshToken: newTokens.refresh_token,
      accessTokenExpires: Date.now() + newTokens.expires_in * 1000,
      error: undefined,
    }
  } catch (error) {
    console.error("Error refreshing access token:", error)
    return {
      ...token,
      error: "RefreshAccessTokenError",
    }
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          let accessToken = "";
          let refreshToken = "";
          let expiresIn = 72 * 60 * 60; // Default 72h in seconds

          // 1. Check for Demo Token
          const creds = credentials as any;
          if (creds?.demoToken) {
            accessToken = creds.demoToken;
            // Demo tokens don't have refresh tokens
            refreshToken = "";
          } else {
            // 2. Normal Login Flow - Use new /auth/login endpoint
            if (!credentials?.email || !credentials?.password) {
              return null
            }
            const { email, password } = loginSchema.parse(credentials)

            const response = await fetch(`${BASE_URL}/auth/login`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password }),
            })

            if (!response.ok) {
              // Fallback to legacy endpoint if new one fails
              const legacyResponse = await fetch(`${BASE_URL}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
              })
              
              if (!legacyResponse.ok) return null
              accessToken = await legacyResponse.json()
              refreshToken = ""
            } else {
              const tokenResponse = await response.json()
              accessToken = tokenResponse.access_token
              refreshToken = tokenResponse.refresh_token || ""
              expiresIn = tokenResponse.expires_in || expiresIn
            }
          }

          // 3. Get User Profile (Common for both flows)
          const profileResponse = await fetch(`${BASE_URL}/profile`, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
          })

          if (!profileResponse.ok) return null

          const user = await profileResponse.json()

          return {
            id: user.id.toString(),
            email: user.email,
            name: user.name,
            lastName: user.last_name,
            accessToken: accessToken,
            refreshToken: refreshToken,
            expiresIn: expiresIn,
            role: user.role ?? "USER",
          }
        } catch (error) {
          console.error("Auth error:", error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user
    },
    async jwt({ token, user }) {
      // Initial sign in
      if (user) {
        return {
          ...token,
          accessToken: user.accessToken,
          refreshToken: user.refreshToken,
          accessTokenExpires: Date.now() + user.expiresIn * 1000,
          id: user.id,
          lastName: user.lastName,
          role: user.role,
        }
      }

      // Return previous token if the access token has not expired yet
      // Add 30 second buffer before expiration to refresh proactively
      if (Date.now() < (token.accessTokenExpires as number) - 30000) {
        return token
      }

      // Access token has expired (or will expire soon), try to refresh it
      // Only refresh if we have a refresh token
      if (token.refreshToken) {
        return await refreshAccessToken(token)
      }

      // No refresh token available, return current token
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.lastName = token.lastName as string;
        session.accessToken = token.accessToken as string;
        session.user.role = token.role as string;
        
        // Pass error to client so it can handle sign out
        if (token.error) {
          session.error = token.error;
        }
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    // Set maxAge to match refresh token expiration (7 days)
    maxAge: 7 * 24 * 60 * 60,
  },
})
