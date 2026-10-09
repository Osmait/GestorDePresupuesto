/**
 * True for the rejection of a fetch (or any other abortable operation) that was
 * cancelled through an AbortSignal. Covers DOMException('AbortError') thrown by
 * browsers and the plain Error with the same name used by some polyfills.
 */
export function isAbortError(error: unknown): boolean {
	return typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError'
}
