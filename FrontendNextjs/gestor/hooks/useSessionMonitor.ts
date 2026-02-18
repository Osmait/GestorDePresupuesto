"use client"

import { useSession, signOut } from "next-auth/react"
import { useEffect } from "react"

/**
 * Hook that monitors the session for refresh token errors
 * and automatically signs out the user when detected
 */
export function useSessionMonitor() {
  const { data: session } = useSession()

  useEffect(() => {
    if (session?.error === "RefreshAccessTokenError") {
      // Token refresh failed - sign out the user
      console.warn("Session expired - refresh token failed. Signing out...")
      signOut({ callbackUrl: "/login" })
    }
  }, [session?.error])

  return session
}
