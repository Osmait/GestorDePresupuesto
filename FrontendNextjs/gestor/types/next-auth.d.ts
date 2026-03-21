import { DefaultSession, DefaultUser } from 'next-auth'
import { DefaultJWT } from 'next-auth/jwt'

declare module 'next-auth' {
	interface Session {
		user: {
			id: string
			lastName: string
			role: string
		} & DefaultSession['user']
		accessToken: string
		error?: 'RefreshAccessTokenError'
	}

	interface User extends DefaultUser {
		lastName: string
		accessToken: string
		refreshToken: string
		expiresIn: number
		role: string
	}
}

declare module 'next-auth/jwt' {
	interface JWT extends DefaultJWT {
		accessToken: string
		refreshToken: string
		accessTokenExpires: number
		lastName: string
		role: string
		error?: 'RefreshAccessTokenError'
	}
}
