/**
 * Response header set by the backend proxy on a stream (SSE) it opened with an
 * access token it had to refresh. A streaming response never carries the
 * rotated session cookie, so the client re-fetches its session to persist it
 * (the refresh is reused from the server's grace store, no second rotation).
 * Shared by the server proxy and browser code.
 */
export const SESSION_REFRESHED_HEADER = 'x-session-refreshed'
