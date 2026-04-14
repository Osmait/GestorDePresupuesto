import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"
import type { JWT } from "next-auth/jwt"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const BASE_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8080";

// Buffer before token expiration to refresh proactively (5 minutes)
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

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
      id: "passkey",
      name: "passkey",
      credentials: {
        accessToken: { type: "text" },
        refreshToken: { type: "text" },
        expiresIn: { type: "text" },
      },
      async authorize(credentials) {
        try {
          const creds = credentials as any
          const accessToken: string = creds?.accessToken || ""
          const refreshToken: string = creds?.refreshToken || ""
          if (!accessToken) return null
          const expiresIn = parseInt(creds?.expiresIn || "0", 10) || 72 * 60 * 60

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
            accessToken,
            refreshToken,
            expiresIn,
            role: user.role ?? "USER",
          }
        } catch (error) {
          console.error("Passkey auth error:", error)
          return null
        }
      },
    }),
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
            refreshToken = "";
          } else {
            // 2. Normal Login Flow
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
              return null
            }

            const tokenResponse = await response.json()
            accessToken = tokenResponse.access_token
            refreshToken = tokenResponse.refresh_token || ""
            expiresIn = tokenResponse.expires_in || expiresIn
          }

          // 3. Get User Profile
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
      // 5-minute buffer before expiration to refresh proactively
      if (Date.now() < (token.accessTokenExpires as number) - REFRESH_BUFFER_MS) {
        return token
      }

      // Access token has expired (or will expire soon), try to refresh it
      if (token.refreshToken) {
        return await refreshAccessToken(token)
      }

      // No refresh token available (demo user), return token as-is
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.lastName = token.lastName as string;
        session.accessToken = token.accessToken as string;
        session.user.role = token.role as string;

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
    maxAge: 7 * 24 * 60 * 60, // 7 days (matches refresh token)
  },
})
