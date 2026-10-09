interface BackendJwtClaims {
	id?: string
	exp?: number
	iat?: number
}

function decodeBase64Url(segment: string): string {
	const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
	const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
	const binary = atob(padded)
	const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
	return new TextDecoder().decode(bytes)
}

/**
 * Decodes (without verifying) the payload of a backend access token.
 * Signature verification is the backend's job; we only read claims such as
 * `exp` to schedule refreshes. Returns null for malformed tokens.
 */
export function decodeJwtClaims(token: string): BackendJwtClaims | null {
	const parts = token.split('.')
	if (parts.length !== 3 || !parts[1]) return null
	try {
		const claims = JSON.parse(decodeBase64Url(parts[1]))
		return claims && typeof claims === 'object' ? (claims as BackendJwtClaims) : null
	} catch {
		return null
	}
}

/** Expiry of a backend access token in epoch milliseconds, taken from its `exp` claim. */
export function getJwtExpiryMs(token: string): number | null {
	const exp = decodeJwtClaims(token)?.exp
	return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : null
}
