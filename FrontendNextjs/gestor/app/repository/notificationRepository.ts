import { BACKEND_PROXY_PATH, BaseRepository } from '@/lib/base-repository'

export interface BackendNotification {
	id: string
	type: string
	message: string
	amount?: number
	is_read: boolean
	created_at: string
}

/** URL of the SSE stream, served through the same-origin backend proxy. */
export const NOTIFICATIONS_STREAM_URL = `${BACKEND_PROXY_PATH}/notifications`

/** Page size asked for when loading the notification history (backend accepts 1..100). */
export const NOTIFICATION_HISTORY_PAGE_SIZE = 50

export interface NotificationHistoryPage {
	items: BackendNotification[]
	/** Opaque cursor for the next (older) page; null when there is none. */
	nextCursor: string | null
}

function isNotification(value: unknown): value is BackendNotification {
	return !!value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string'
}

/**
 * Accepts both history shapes: the paginated `{ items, next_cursor }` answer to
 * `?limit=&cursor=`, and the legacy bare array (a backend that ignores the
 * parameters returns the full history in one page). Anything else is empty.
 */
export function toNotificationHistoryPage(data: unknown): NotificationHistoryPage {
	if (Array.isArray(data)) return { items: data.filter(isNotification), nextCursor: null }
	if (data && typeof data === 'object') {
		const { items, next_cursor: nextCursor } = data as { items?: unknown; next_cursor?: unknown }
		return {
			items: Array.isArray(items) ? items.filter(isNotification) : [],
			nextCursor: typeof nextCursor === 'string' && nextCursor ? nextCursor : null,
		}
	}
	return { items: [], nextCursor: null }
}

export class NotificationRepository extends BaseRepository {
	/** One page of the notification history, newest first. */
	async getHistory(
		signal?: AbortSignal,
		{ limit = NOTIFICATION_HISTORY_PAGE_SIZE, cursor }: { limit?: number; cursor?: string | null } = {},
	): Promise<NotificationHistoryPage> {
		const params = new URLSearchParams({ limit: String(limit) })
		if (cursor) params.set('cursor', cursor)
		const data = await this.get<unknown>(`/notifications/history?${params}`, { signal })
		return toNotificationHistoryPage(data)
	}

	async markAsRead(id: string): Promise<void> {
		await this.patch(`/notifications/${encodeURIComponent(id)}/read`)
	}

	async markAllAsRead(): Promise<void> {
		await this.patch('/notifications/read-all')
	}

	async deleteAll(): Promise<void> {
		await this.deleteRequest('/notifications')
	}
}
