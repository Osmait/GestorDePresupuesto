import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationProvider, useNotificationContext } from '@/contexts/NotificationContext'

const getHistory = vi.fn()

vi.mock('next-auth/react', () => ({
	useSession: () => ({ data: { user: { name: 'Test' } }, status: 'authenticated' }),
}))

vi.mock('@/hooks/useNotification', () => ({
	useNotification: () => ({ lastMessage: null, isConnected: false }),
}))

vi.mock('@/lib/repositoryConfig', () => ({
	getNotificationRepository: () => ({ getHistory }),
}))

function Count() {
	const { notifications } = useNotificationContext()
	return <span data-testid='count'>{notifications.length}</span>
}

function renderProvider() {
	return render(
		<NotificationProvider>
			<Count />
		</NotificationProvider>,
	)
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
		consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
	})

	afterEach(() => {
		consoleError.mockRestore()
	})

	const historyErrorLogged = () =>
		consoleError.mock.calls.some((args: unknown[]) => args[0] === 'Failed to fetch notification history')

	it('loads the history with an abort signal', async () => {
		getHistory.mockResolvedValue([
			{ id: 'n1', type: 'info', message: 'hello', is_read: false, created_at: '2024-01-01T00:00:00Z' },
		])
		renderProvider()

		await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'))
		expect(getHistory.mock.calls[0][0]).toBeInstanceOf(AbortSignal)
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
