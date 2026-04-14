import { BaseRepository } from '@/lib/base-repository'

export interface PasskeySummary {
	id: string
	name: string
	credential_id: string
	transports: string[]
	created_at: string
	last_used_at?: string | null
}

export interface PasskeyLoginTokens {
	access_token: string
	refresh_token: string
	token_type: string
	expires_in: number
}

export interface BeginRegistrationResponse {
	session_id: string
	options: unknown
}

export interface BeginLoginResponse {
	session_id: string
	options: unknown
}

export class PasskeyRepository extends BaseRepository {
	async beginRegistration(): Promise<BeginRegistrationResponse> {
		return (await this.post<BeginRegistrationResponse>('/auth/passkey/register/begin', {})) as BeginRegistrationResponse
	}

	async finishRegistration(sessionId: string, name: string, attestationResponse: unknown): Promise<PasskeySummary> {
		return (await this.post<PasskeySummary>('/auth/passkey/register/finish', {
			session_id: sessionId,
			name,
			attestation_response: attestationResponse,
		})) as PasskeySummary
	}

	async beginLogin(): Promise<BeginLoginResponse> {
		// The login endpoints are public so we bypass the authenticatedFetch
		// retry pipeline and talk to the backend directly.
		const res = await fetch(`${this.baseUrl}/auth/passkey/login/begin`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: '{}',
		})
		if (!res.ok) throw new Error(`begin login failed: ${res.status}`)
		return (await res.json()) as BeginLoginResponse
	}

	async finishLogin(sessionId: string, assertionResponse: unknown): Promise<PasskeyLoginTokens> {
		const res = await fetch(`${this.baseUrl}/auth/passkey/login/finish`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				session_id: sessionId,
				assertion_response: assertionResponse,
			}),
		})
		if (!res.ok) {
			const text = await res.text().catch(() => '')
			throw new Error(`finish login failed: ${res.status} ${text}`)
		}
		return (await res.json()) as PasskeyLoginTokens
	}

	async list(): Promise<PasskeySummary[]> {
		return (await this.get<PasskeySummary[]>('/auth/passkey')) ?? []
	}

	async delete(id: string): Promise<void> {
		return this.deleteRequest(`/auth/passkey/${id}`)
	}
}

let passkeyRepositoryInstance: PasskeyRepository | null = null

export const getPasskeyRepository = async () => {
	if (!passkeyRepositoryInstance) {
		passkeyRepositoryInstance = new PasskeyRepository()
	}
	return passkeyRepositoryInstance
}

export const passkeyRepository = new PasskeyRepository()
