import { formatCurrency } from '@/lib/utils'

const MAX_DETAIL_LENGTH = 300

/**
 * Backend error text that is safe to show to the user: the message of a 4xx
 * answer from the API (validation / business rule, e.g. "insufficient funds").
 * Server errors (5xx), auth errors, network failures and the repository's
 * generic `HTTP error! …` fallback return null — show only a generic message then.
 */
export function getSafeErrorDetail(error: unknown): string | null {
	if (!(error instanceof Error)) return null
	const status = (error as Error & { status?: unknown }).status
	if (typeof status !== 'number' || status < 400 || status >= 500 || status === 401) return null
	const message = error.message.trim()
	if (!message || message.startsWith('HTTP error!') || message.length > MAX_DETAIL_LENGTH) return null
	return message
}

/** Stable backend error code of a transfer that would overdraw its source account. */
export const INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS'

/** The backend's stable error code (`error.code` of an apperrors body), if any. */
export function getApiErrorCode(error: unknown): string | null {
	if (!(error instanceof Error)) return null
	const code = (error as Error & { code?: unknown }).code
	return typeof code === 'string' && code ? code : null
}

export interface InsufficientFundsInfo {
	/** Balance of the source account, in its currency (null when not reported). */
	available: number | null
	currency: string | null
}

/**
 * Returns the overdraft details when `error` is the backend's INSUFFICIENT_FUNDS
 * answer (a credit-card payment, broker funding or loan disbursement larger than
 * the source account's balance), otherwise null.
 */
export function getInsufficientFunds(error: unknown): InsufficientFundsInfo | null {
	if (getApiErrorCode(error) !== INSUFFICIENT_FUNDS) return null
	const details = (error as Error & { details?: unknown }).details
	const record = details && typeof details === 'object' ? (details as Record<string, unknown>) : {}
	const available = Number(record.available)
	return {
		available: record.available !== undefined && Number.isFinite(available) ? available : null,
		currency: typeof record.currency === 'string' && record.currency ? record.currency : null,
	}
}

type Translate = (key: string, values?: Record<string, string | number>) => string

/**
 * Translated INSUFFICIENT_FUNDS message (from the `forms` namespace) for a
 * failed transfer, or null when `error` is something else.
 */
export function getInsufficientFundsMessage(error: unknown, tForms: Translate, locale?: string | null): string | null {
	const info = getInsufficientFunds(error)
	if (!info) return null
	if (info.available === null) return tForms('insufficientFunds')
	return tForms('insufficientFundsAvailable', {
		amount: formatCurrency(info.available, info.currency, { locale }),
	})
}
