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

export class NotificationRepository extends BaseRepository {
	async getHistory(signal?: AbortSignal): Promise<BackendNotification[]> {
		const data = await this.get<BackendNotification[] | null>('/notifications/history', { signal })
		return Array.isArray(data) ? data : []
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
