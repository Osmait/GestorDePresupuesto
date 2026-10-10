import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationProvider, useNotificationContext } from '@/contexts/NotificationContext'

const getHistory = vi.fn()
const markAsReadMock = vi.fn(() => Promise.resolve())
let lastMessage: { id?: string; type: string; message: string; amount?: number } | null = null

vi.mock('next-auth/react', () => ({
	useSession: () => ({ data: { user: { name: 'Test' } }, status: 'authenticated' }),
}))

vi.mock('@/hooks/useNotification', () => ({
	useNotification: () => ({ lastMessage, isConnected: false }),
}))

vi.mock('@/lib/repositoryConfig', () => ({
	getNotificationRepository: () => ({ getHistory, markAsRead: markAsReadMock }),
}))

function Count() {
	const { notifications, unreadCount, hasMore, loadMore, markAsRead } = useNotificationContext()
	return (
		<>
			<span data-testid='count'>{notifications.length}</span>
			<span data-testid='unread'>{unreadCount}</span>
			<span data-testid='ids'>{notifications.map((n) => n.id).join(',')}</span>
			{hasMore && (
				<button type='button' onClick={loadMore}>
					more
				</button>
			)}
			<button type='button' onClick={() => markAsRead('n1')}>
				read-n1
			</button>
		</>
	)
}

function page(ids: string[], nextCursor: string | null = null) {
	return {
		items: ids.map((id) => ({ id, type: 'info', message: id, is_read: false, created_at: '2024-01-01T00:00:00Z' })),
		nextCursor,
	}
}

function renderProvider(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
	const tree = () => (
		<QueryClientProvider client={client}>
			<NotificationProvider>
				<Count />
			</NotificationProvider>
		</QueryClientProvider>
	)
	const result = render(tree())
	return { ...result, client, rerenderTree: () => result.rerender(tree()) }
}

function deferred<T>() {
	let resolve!: (value: T) => void
	let reject!: (reason: unknown) => void
	const promise = new Promise<T>((res, rej) => {
		resolve = res
		reject = rej
	})
	return { promise, resolve, reject }
}

describe('NotificationProvider history fetch', () => {
	let consoleError: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		getHistory.mockReset()
		markAsReadMock.mockClear()
		lastMessage = null
		consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
	})

	afterEach(() => {
		consoleError.mockRestore()
	})

	const historyErrorLogged = () =>
		consoleError.mock.calls.some((args: unknown[]) => args[0] === 'Failed to fetch notification history')

	it('loads the history with an abort signal', async () => {
		getHistory.mockResolvedValue(page(['n1']))
		renderProvider()

		await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'))
		expect(getHistory.mock.calls[0][0]).toBeInstanceOf(AbortSignal)
		// first page: no cursor
		expect(getHistory.mock.calls[0][1]).toEqual({ cursor: null })
	})

	it('loads older pages on demand with the cursor of the previous page', async () => {
		getHistory.mockResolvedValueOnce(page(['n3', 'n2'], 'cursor-1')).mockResolvedValueOnce(page(['n1']))
		renderProvider()

		await waitFor(() => expect(screen.getByTestId('ids')).toHaveTextContent('n3,n2'))
		expect(getHistory).toHaveBeenCalledTimes(1)

		fireEvent.click(screen.getByText('more'))

		await waitFor(() => expect(screen.getByTestId('ids')).toHaveTextContent('n3,n2,n1'))
		expect(getHistory.mock.calls[1][1]).toEqual({ cursor: 'cursor-1' })
		expect(screen.queryByText('more')).toBeNull()
	})

	it('serves remounts from the query cache instead of refetching', async () => {
		getHistory.mockResolvedValue(page(['n1']))
		const { unmount, client } = renderProvider()
		await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'))
		unmount()

		renderProvider(client)

		expect(screen.getByTestId('count')).toHaveTextContent('1')
		expect(getHistory).toHaveBeenCalledTimes(1)
	})

	it('prepends real-time notifications and marks them read optimistically', async () => {
		getHistory.mockResolvedValue(page(['n1']))
		const { rerenderTree } = renderProvider()
		await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'))

		lastMessage = { id: 'n9', type: 'info', message: 'live' }
		rerenderTree()
		await waitFor(() => expect(screen.getByTestId('ids')).toHaveTextContent('n9,n1'))
		expect(screen.getByTestId('unread')).toHaveTextContent('2')
		expect(getHistory).toHaveBeenCalledTimes(1)

		fireEvent.click(screen.getByText('read-n1'))
		await waitFor(() => expect(screen.getByTestId('unread')).toHaveTextContent('1'))
		expect(markAsReadMock).toHaveBeenCalledWith('n1')
	})

	it('does not log an AbortError', async () => {
		getHistory.mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'))
		renderProvider()

		await waitFor(() => expect(getHistory).toHaveBeenCalled())
		await Promise.resolve()
		expect(historyErrorLogged()).toBe(false)
	})

	it('aborts the request on unmount and does not log its failure', async () => {
		const pending = deferred<never>()
		getHistory.mockReturnValue(pending.promise)
		const { unmount } = renderProvider()

		await waitFor(() => expect(getHistory).toHaveBeenCalled())
		const signal = getHistory.mock.calls[0][0] as AbortSignal
		unmount()
		expect(signal.aborted).toBe(true)

		pending.reject(new TypeError('Failed to fetch'))
		await pending.promise.catch(() => {})
		await Promise.resolve()
		expect(historyErrorLogged()).toBe(false)
	})

	it('does not log network failures caused by the page unloading', async () => {
		const pending = deferred<never>()
		getHistory.mockReturnValue(pending.promise)
		renderProvider()

		await waitFor(() => expect(getHistory).toHaveBeenCalled())
		window.dispatchEvent(new Event('pagehide'))
		pending.reject(new TypeError('Failed to fetch'))
		await pending.promise.catch(() => {})
		await Promise.resolve()
		expect(historyErrorLogged()).toBe(false)
		window.dispatchEvent(new Event('pageshow'))
	})

	it('still logs real errors', async () => {
		getHistory.mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }))
		renderProvider()

		await waitFor(() => expect(historyErrorLogged()).toBe(true))
	})
})
