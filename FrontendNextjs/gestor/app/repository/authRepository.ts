import { BACKEND_PROXY_PATH } from '@/lib/base-repository'

/**
 * Public (unauthenticated) auth endpoints called from the browser through the
 * backend proxy. Login, token refresh and logout are handled by next-auth on
 * the server; this repository never touches backend tokens.
 */
export class AuthRepository {
	private url = BACKEND_PROXY_PATH

	async signUp(name: string, lastName: string, email: string, password: string) {
		const response = await fetch(`${this.url}/user`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name, last_name: lastName, email, password }),
		})
		if (response && response.ok === false) {
			const message = await response.text().catch(() => '')
			throw new Error(message || 'Error al crear la cuenta')
		}
	}

	/** Creates (or reuses) a demo user and returns its access token, to be verified by next-auth. */
	async createDemoUser(): Promise<string> {
		const response = await fetch(`${this.url}/auth/demo`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
		})
		if (!response.ok) {
			const errorData = await response.text()
			throw new Error(errorData || 'Error creating demo account')
		}
		return await response.json()
	}
}
