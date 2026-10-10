import { DefaultSession, DefaultUser } from 'next-auth'
import { DefaultJWT } from 'next-auth/jwt'

declare module 'next-auth' {
	// The session is serialized to the browser: it must never carry backend tokens.
	interface Session {
		user: {
			id: string
			lastName: string
			role: string
		} & DefaultSession['user']
		error?: 'RefreshTokenError'
	}

	interface User extends DefaultUser {
		lastName: string
		accessToken: string
		refreshToken: string
		accessTokenExpires: number
		role: string
	}
}

declare module 'next-auth/jwt' {
	// Lives only inside the encrypted session cookie.
	interface JWT extends DefaultJWT {
		id?: string
		accessToken?: string
		refreshToken?: string
		accessTokenExpires?: number
		lastName?: string
		role?: string
		error?: 'RefreshTokenError'
	}
}
