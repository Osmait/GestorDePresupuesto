import NextAuth, { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { z } from "zod"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          let token = "";

          // 1. Check for Demo Token
          if (credentials?.demoToken) {
            token = credentials.demoToken;
          } else {
            // 2. Normal Login Flow
            if (!credentials?.email || !credentials?.password) {
              return null
            }
            const { email, password } = loginSchema.parse(credentials)

            const response = await fetch("http://127.0.0.1:8080/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password }),
            })

            if (!response.ok) return null
            token = await response.json()
          }

          // 3. Get User Profile (Common for both flows)
          const profileResponse = await fetch("http://127.0.0.1:8080/profile", {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          })

          if (!profileResponse.ok) return null

          const user = await profileResponse.json()

          return {
            id: user.id.toString(),
            email: user.email,
            name: user.name,
            lastName: user.last_name,
            accessToken: token,
          }
        } catch (error) {
          console.error("Auth error:", error)
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = (user as any).accessToken
        token.id = user.id
        token.lastName = (user as any).lastName
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        (session.user as any).id = token.id as string;
        (session.user as any).lastName = token.lastName as string;
        (session as any).accessToken = token.accessToken as string
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
}

export default NextAuth(authOptions)