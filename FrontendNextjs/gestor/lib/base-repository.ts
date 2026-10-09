import { recoverSessionAfterUnauthorized } from '@/lib/client-session'

/** Same-origin route that forwards browser requests to the backend with the session's token. */
export const BACKEND_PROXY_PATH = '/api/backend'

export interface RepositoryOptions {
	/**
	 * Absolute backend URL. Only set on the server (see `lib/server/repositories.ts`);
	 * browser code always goes through the same-origin proxy.
	 */
	baseUrl?: string
	/** Server-side token provider. Browser code never sees the backend token. */
	getAccessToken?: () => Promise<string | null>
	/** Server-side extra request headers (e.g. the UI locale as Accept-Language). */
	getRequestHeaders?: () => Promise<Record<string, string>>
}

/**
 * Repositories never refresh tokens. In the browser they call the proxy (the
 * session cookie authenticates the request); on the server they get the token
 * from an injected provider. A 401 in the browser triggers at most one shared
 * session re-fetch and a single retry.
 */
export abstract class BaseRepository {
	protected readonly baseUrl: string
	private readonly getAccessToken?: () => Promise<string | null>
	private readonly getRequestHeaders?: () => Promise<Record<string, string>>

	constructor(options: RepositoryOptions = {}) {
		this.baseUrl = options.baseUrl ?? BACKEND_PROXY_PATH
		this.getAccessToken = options.getAccessToken
		this.getRequestHeaders = options.getRequestHeaders
	}

	private get isServerRepository(): boolean {
		return this.getAccessToken !== undefined
	}

	protected async getAuthHeaders(): Promise<Record<string, string>> {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			...(this.getRequestHeaders ? await this.getRequestHeaders() : {}),
		}
		if (this.getAccessToken) {
			const token = await this.getAccessToken()
			if (token) headers.Authorization = `Bearer ${token}`
		}
		return headers
	}

	protected async authenticatedFetch(
		endpoint: string,
		options: RequestInit = {},
		allowRetry = true,
	): Promise<Response> {
		if (!this.isServerRepository && typeof window === 'undefined') {
			throw new Error('Browser repositories cannot run on the server; use lib/server/repositories instead')
		}

		const headers = await this.getAuthHeaders()
		const response = await fetch(`${this.baseUrl}${endpoint}`, {
			...options,
			headers: {
				...headers,
				...(options.headers as Record<string, string> | undefined),
			},
		})

		if (response.status === 401 && allowRetry && !this.isServerRepository) {
			const recovered = await recoverSessionAfterUnauthorized()
			if (recovered) return this.authenticatedFetch(endpoint, options, false)
			throw Object.assign(new Error('Session expired. Please log in again.'), { status: 401 })
		}

		if (!response.ok) {
			throw await this.toError(response)
		}

		return response
	}

	private async toError(response: Response) {
		let errorMessage = `HTTP error! status: ${response.status} - ${response.statusText}`
		let errorCode: string | undefined
		let errorDetails: unknown
		const requestId = response.headers?.get('X-Request-ID') || undefined
		try {
			const errorData = await response.json()
			if (errorData?.error) {
				if (typeof errorData.error === 'string') {
					errorMessage = errorData.error
				} else {
					errorMessage = errorData.error.message || errorMessage
					errorCode = errorData.error.code
					errorDetails = errorData.error.details
				}
			} else if (typeof errorData?.err === 'string') {
				errorMessage = errorData.err
			} else if (typeof errorData?.message === 'string') {
				errorMessage = errorData.message
			}
		} catch (_e) {
			// ignore json parse error
		}

		const error = new Error(errorMessage) as Error & {
			status?: number
			code?: string
			details?: unknown
			requestId?: string
		}
		error.status = response.status
		error.code = errorCode
		error.details = errorDetails
		error.requestId = requestId
		return error
	}

	protected async get<T>(endpoint: string, init?: Pick<RequestInit, 'signal'>): Promise<T> {
		const response = await this.authenticatedFetch(endpoint, init)
		return response.json()
	}

	protected async post<T>(endpoint: string, data?: any): Promise<T | undefined> {
		const response = await this.authenticatedFetch(endpoint, {
			method: 'POST',
			body: data ? JSON.stringify(data) : undefined,
		})

		if (response.headers.get('content-type')?.includes('application/json')) {
			return response.json()
		}
	}

	protected async put<T>(endpoint: string, data?: any): Promise<T | undefined> {
		const response = await this.authenticatedFetch(endpoint, {
			method: 'PUT',
			body: data ? JSON.stringify(data) : undefined,
		})

		if (response.headers.get('content-type')?.includes('application/json')) {
			return response.json()
		}
	}

	protected async deleteRequest(endpoint: string): Promise<void> {
		await this.authenticatedFetch(endpoint, {
			method: 'DELETE',
		})
	}

	protected async patch<T>(endpoint: string, data?: any): Promise<T | undefined> {
		const response = await this.authenticatedFetch(endpoint, {
			method: 'PATCH',
			body: data ? JSON.stringify(data) : undefined,
		})

		if (response.headers.get('content-type')?.includes('application/json')) {
			return response.json()
		}
	}
}
