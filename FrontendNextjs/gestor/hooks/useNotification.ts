import { fetchEventSource } from '@microsoft/fetch-event-source'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { NOTIFICATIONS_STREAM_URL } from '@/app/repository/notificationRepository'
import { SESSION_REFRESHED_HEADER } from '@/lib/auth/session-sync'
import { recoverSessionAfterUnauthorized } from '@/lib/client-session'

export interface NotificationEvent {
	/** Database id, when the backend includes it in the SSE payload. */
	id?: string
	type: string
	message: string
	amount?: number
}

const RETRY_INTERVAL_MS = 5000

class FatalStreamError extends Error {}

/** A 401 after which the session was recovered: reconnect right away (once). */
class SessionRecoveredError extends Error {}

export function useNotification() {
	const { status, data: session } = useSession()
	const userId = session?.user?.id
	const [lastMessage, setLastMessage] = useState<NotificationEvent | null>(null)
	const [isConnected, setIsConnected] = useState(false)

	useEffect(() => {
		if (status !== 'authenticated' || !userId) return

		const controller = new AbortController()
		// One immediate reconnect after a recovered 401; re-armed by every successful open.
		let canRetryNow = true

		// The proxy authenticates the stream with the session cookie; no token in the browser.
		fetchEventSource(NOTIFICATIONS_STREAM_URL, {
			method: 'GET',
			signal: controller.signal,
			async onopen(response) {
				if (response.ok) {
					setIsConnected(true)
					canRetryNow = true
					// The proxy refreshed an expired token for this stream but a stream
					// cannot persist the rotated cookie: re-fetch the session to store it.
					if (response.headers.get(SESSION_REFRESHED_HEADER)) void recoverSessionAfterUnauthorized()
					return
				}
				setIsConnected(false)
				if (response.status === 401) {
					// One shared session re-fetch; stop reconnecting if the session is gone.
					const recovered = await recoverSessionAfterUnauthorized()
					if (!recovered) throw new FatalStreamError('Unauthorized')
					throw new SessionRecoveredError('Session recovered')
				}
				throw new Error(`SSE connection failed: ${response.status}`)
			},
			onmessage(ev) {
				if (!ev.data) return
				try {
					const data = JSON.parse(ev.data) as NotificationEvent
					setLastMessage(data)
					toast(data.message, {
						description: data.type === 'recurring_executed' ? `Amount: $${data.amount}` : undefined,
					})
				} catch {
					// ignore malformed events
				}
			},
			onerror(err) {
				setIsConnected(false)
				if (err instanceof FatalStreamError) throw err
				if (err instanceof SessionRecoveredError && canRetryNow) {
					canRetryNow = false
					return 0
				}
				return RETRY_INTERVAL_MS
			},
		}).catch(() => {
			setIsConnected(false)
		})

		return () => {
			setIsConnected(false)
			controller.abort()
		}
	}, [status, userId])

	return { lastMessage, isConnected }
}
