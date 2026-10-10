import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, renderHook, screen, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'

const getMyFeatures = vi.fn()
vi.mock('@/lib/repositoryConfig', () => ({
	getFeatureFlagRepository: () => ({ getMyFeatures }),
}))

function mockSession(status: 'authenticated' | 'loading' | 'unauthenticated', id = 'u1') {
	vi.mocked(useSession).mockReturnValue({
		data: status === 'authenticated' ? { user: { id }, expires: '' } : null,
		status,
		update: vi.fn(),
	} as any)
}

function wrapperFor(client: QueryClient) {
	return ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>{children}</QueryClientProvider>
	)
}

function Flag({ name }: { name: string }) {
	const { isEnabled, isLoading } = useFeatureFlags()
	return <span data-testid={name}>{isLoading ? 'loading' : String(isEnabled(name))}</span>
}

describe('useFeatureFlags', () => {
	let client: QueryClient

	beforeEach(() => {
		getMyFeatures.mockReset().mockResolvedValue({ investments: true, loans: false })
		client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	})

	it('shares one /me/features request between every component using it', async () => {
		mockSession('authenticated')
		render(
			<QueryClientProvider client={client}>
				<Flag name='investments' />
				<Flag name='loans' />
				<Flag name='credit_cards' />
			</QueryClientProvider>,
		)

		await waitFor(() => expect(screen.getByTestId('investments')).toHaveTextContent('true'))
		expect(screen.getByTestId('loans')).toHaveTextContent('false')
		expect(screen.getByTestId('credit_cards')).toHaveTextContent('false')
		expect(getMyFeatures).toHaveBeenCalledTimes(1)
	})

	it('serves later mounts (client navigations) from the cache while fresh', async () => {
		mockSession('authenticated')
		const first = renderHook(() => useFeatureFlags(), { wrapper: wrapperFor(client) })
		await waitFor(() => expect(first.result.current.isLoading).toBe(false))
		first.unmount()

		const second = renderHook(() => useFeatureFlags(), { wrapper: wrapperFor(client) })

		expect(second.result.current.isLoading).toBe(false)
		expect(second.result.current.isEnabled('investments')).toBe(true)
		expect(getMyFeatures).toHaveBeenCalledTimes(1)
	})

	it('reports loading while the session is unknown, and no flags without a session', async () => {
		mockSession('loading')
		const { result, rerender } = renderHook(() => useFeatureFlags(), { wrapper: wrapperFor(client) })
		expect(result.current.isLoading).toBe(true)

		mockSession('unauthenticated')
		rerender()
		expect(result.current.isLoading).toBe(false)
		expect(result.current.flags).toEqual({})
		expect(getMyFeatures).not.toHaveBeenCalled()
	})

	it('falls back to no flags when the request fails', async () => {
		mockSession('authenticated')
		getMyFeatures.mockRejectedValue(new Error('boom'))
		const { result } = renderHook(() => useFeatureFlags(), { wrapper: wrapperFor(client) })

		await waitFor(() => expect(result.current.isLoading).toBe(false))
		expect(result.current.flags).toEqual({})
		expect(result.current.isEnabled('investments')).toBe(false)
	})

	it('keeps flags per user', async () => {
		mockSession('authenticated', 'u1')
		const { result, rerender } = renderHook(() => useFeatureFlags(), { wrapper: wrapperFor(client) })
		await waitFor(() => expect(result.current.isEnabled('investments')).toBe(true))

		getMyFeatures.mockResolvedValue({ investments: false })
		mockSession('authenticated', 'u2')
		rerender()

		await waitFor(() => expect(getMyFeatures).toHaveBeenCalledTimes(2))
		await waitFor(() => expect(result.current.isEnabled('investments')).toBe(false))
	})
})
