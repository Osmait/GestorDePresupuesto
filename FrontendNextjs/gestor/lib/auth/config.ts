import 'server-only'
import type { NextAuthConfig, User } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { z } from 'zod'
import { getJwtExpiryMs } from '@/lib/auth/jwt-utils'
import { ensureFreshToken } from '@/lib/auth/token-refresh'
import { getBackendUrl } from '@/lib/backend-url'
import { clientIpHeaders } from '@/lib/server/client-ip'

const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(1),
})

const tokenSchema = z.string().min(1).max(4096)

/**
 * Validates a backend access token by asking the backend who it belongs to and
 * builds the next-auth user from the answer. Expiry comes from the token's own
 * `exp` claim, never from client-supplied values.
 *
 * `requestHeaders` are the headers of the browser's sign-in request, used to
 * pass its IP to the backend (`clientIpHeaders`).
 */
export async function userFromAccessToken(
	accessToken: string,
	refreshToken: string,
	requestHeaders?: Headers,
): Promise<User | null> {
	const accessTokenExpires = getJwtExpiryMs(accessToken)
	if (!accessTokenExpires || accessTokenExpires <= Date.now()) return null

	const response = await fetch(`${getBackendUrl()}/profile`, {
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${accessToken}`,
			...clientIpHeaders(requestHeaders),
		},
		cache: 'no-store',
	})
	if (!response.ok) return null

	const profile = await response.json()
	if (!profile?.id) return null

	return {
		id: String(profile.id),
		email: profile.email,
		name: profile.name,
		lastName: profile.last_name,
		role: profile.role ?? 'USER',
		accessToken,
		refreshToken,
		accessTokenExpires,
	}
}

async function loginWithPassword(email: string, password: string, requestHeaders?: Headers): Promise<User | null> {
	// The client IP keys the backend's login lockout and rate limits.
	const response = await fetch(`${getBackendUrl()}/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...clientIpHeaders(requestHeaders) },
		body: JSON.stringify({ email, password }),
		cache: 'no-store',
	})
	if (!response.ok) return null

	const tokens = await response.json()
	if (typeof tokens?.access_token !== 'string') return null
	return userFromAccessToken(
		tokens.access_token,
		typeof tokens.refresh_token === 'string' ? tokens.refresh_token : '',
		requestHeaders,
	)
}

export const authConfig = {
	providers: [
		Credentials({
			id: 'passkey',
			name: 'passkey',
			credentials: {
				accessToken: { type: 'text' },
				refreshToken: { type: 'text' },
			},
			async authorize(credentials, request) {
				try {
					const accessToken = tokenSchema.safeParse(credentials?.accessToken)
					if (!accessToken.success) return null
					const refreshToken = tokenSchema.safeParse(credentials?.refreshToken)
					return await userFromAccessToken(
						accessToken.data,
						refreshToken.success ? refreshToken.data : '',
						request?.headers,
					)
				} catch {
					return null
				}
			},
		}),
		Credentials({
			name: 'credentials',
			credentials: {
				email: { label: 'Email', type: 'email' },
				password: { label: 'Password', type: 'password' },
				demoToken: { type: 'text' },
			},
			async authorize(credentials, request) {
				try {
					// Demo login: the token issued by POST /auth/demo is only trusted
					// after the backend confirms it (profile lookup + exp claim).
					const demoToken = tokenSchema.safeParse(credentials?.demoToken)
					if (demoToken.success) {
						return await userFromAccessToken(demoToken.data, '', request?.headers)
					}

					const parsed = loginSchema.safeParse(credentials)
					if (!parsed.success) return null
					return await loginWithPassword(parsed.data.email, parsed.data.password, request?.headers)
				} catch {
					return null
				}
			},
		}),
	],
	callbacks: {
		async jwt({ token, user }) {
			if (user) {
				return {
					...token,
					id: user.id,
					lastName: user.lastName,
					role: user.role,
					accessToken: user.accessToken,
					refreshToken: user.refreshToken,
					accessTokenExpires: user.accessTokenExpires,
					error: undefined,
				}
			}
			return ensureFreshToken(token)
		},
		async session({ session, token }) {
			// Only non-sensitive fields: this object is returned by /api/auth/session.
			session.user.id = token.id ?? ''
			session.user.lastName = token.lastName ?? ''
			session.user.role = token.role ?? 'USER'
			if (token.error) session.error = token.error
			return session
		},
	},
	pages: {
		signIn: '/login',
	},
	session: {
		strategy: 'jwt',
		maxAge: 7 * 24 * 60 * 60, // 7 days (matches the backend refresh token)
	},
} satisfies NextAuthConfig
