export type ApiErrorPayload = {
	error?: {
		code?: string
		message?: string
		details?: unknown
		type?: string
		retryable?: boolean
	}
	message?: string
	err?: string
}

export class ApiError extends Error {
	status?: number
	code?: string
	details?: unknown
	requestId?: string
	type?: string
	retryable?: boolean

	constructor(message: string, init?: Partial<ApiError>) {
		super(message)
		this.name = 'ApiError'
		Object.assign(this, init)
	}
}

export async function toApiError(response: Response, fallbackMessage?: string): Promise<ApiError> {
	const requestId = response.headers.get('X-Request-ID') || undefined
	const fallback = fallbackMessage || `Request failed (${response.status})`

	let payload: ApiErrorPayload | null = null
	try {
		payload = await response.json()
	} catch {
		payload = null
	}

	const message = payload?.error?.message || payload?.message || payload?.err || fallback

	return new ApiError(message, {
		status: response.status,
		code: payload?.error?.code,
		details: payload?.error?.details,
		requestId,
		type: payload?.error?.type,
		retryable: payload?.error?.retryable,
	})
}

export function normalizeUserError(error: unknown, context?: string): string {
	if (error instanceof ApiError) {
		if (error.code === 'RATE_LIMIT_EXCEEDED') {
			return 'Too many requests. Please try again in a moment.'
		}
		if (error.code === 'UNAUTHORIZED' || error.status === 401) {
			return 'Your session has expired. Please sign in again.'
		}
		if (error.code === 'FORBIDDEN' || error.status === 403) {
			return 'You do not have permission for this action.'
		}
		if (error.code === 'ACCOUNT_CURRENCY_MISMATCH') {
			return 'The transaction currency does not match the selected account currency.'
		}
		if (error.requestId) {
			return `${error.message} (Support ID: ${error.requestId})`
		}
		return error.message
	}

	if (error instanceof Error) {
		return context ? `${context}: ${error.message}` : error.message
	}

	return context || 'An unexpected error occurred'
}
