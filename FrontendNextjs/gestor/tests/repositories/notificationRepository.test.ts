import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationRepository, toNotificationHistoryPage } from '@/app/repository/notificationRepository'

const mockFetch = vi.fn()
global.fetch = mockFetch

const n = (id: string) => ({ id, type: 'info', message: id, is_read: false, created_at: '2024-01-01T00:00:00Z' })

describe('NotificationRepository.getHistory', () => {
	let repo: NotificationRepository

	beforeEach(() => {
		repo = new NotificationRepository()
		mockFetch.mockReset()
	})

	it('asks for one bounded page (limit=50) and passes the cursor and signal', async () => {
		mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ items: [n('a')], next_cursor: 'c2' }) })
		const signal = new AbortController().signal

		const first = await repo.getHistory(signal)
		const second = await repo.getHistory(undefined, { cursor: 'c2' })

		expect(mockFetch.mock.calls[0][0]).toBe('/api/backend/notifications/history?limit=50')
		expect(mockFetch.mock.calls[0][1].signal).toBe(signal)
		expect(mockFetch.mock.calls[1][0]).toBe('/api/backend/notifications/history?limit=50&cursor=c2')
		expect(first).toEqual({ items: [n('a')], nextCursor: 'c2' })
		expect(second.nextCursor).toBe('c2')
	})

	it('accepts the legacy bare-array answer as a single last page', async () => {
		mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve([n('a'), n('b')]) })

		await expect(repo.getHistory()).resolves.toEqual({ items: [n('a'), n('b')], nextCursor: null })
	})
})

describe('toNotificationHistoryPage', () => {
	it('handles both shapes and anything unexpected defensively', () => {
		expect(toNotificationHistoryPage({ items: [n('a')], next_cursor: null })).toEqual({
			items: [n('a')],
			nextCursor: null,
		})
		expect(toNotificationHistoryPage({ items: [n('a')], next_cursor: '' }).nextCursor).toBeNull()
		expect(toNotificationHistoryPage({ items: [n('a')] }).nextCursor).toBeNull()
		expect(toNotificationHistoryPage([n('a'), null, { foo: 1 }, 'x'])).toEqual({ items: [n('a')], nextCursor: null })
		expect(toNotificationHistoryPage({ items: 'nope', next_cursor: 42 })).toEqual({ items: [], nextCursor: null })
		expect(toNotificationHistoryPage(null)).toEqual({ items: [], nextCursor: null })
		expect(toNotificationHistoryPage('oops')).toEqual({ items: [], nextCursor: null })
	})
})
