import { useMutation } from '@tanstack/react-query'
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({
	useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}))

import { ReactQueryProvider } from '@/components/common/react-query-provider'

let mutate: (ok: boolean) => Promise<unknown>

function Mutator() {
	const mutation = useMutation({
		mutationFn: async (ok: boolean) => {
			if (!ok) throw new Error('nope')
			return ok
		},
	})
	mutate = (ok) => mutation.mutateAsync(ok).catch(() => undefined)
	return null
}

describe('ReactQueryProvider', () => {
	beforeEach(() => {
		vi.useFakeTimers()
		refresh.mockClear()
	})

	it('purges the router cache (one refresh) after successful writes', async () => {
		render(
			<ReactQueryProvider>
				<Mutator />
			</ReactQueryProvider>,
		)

		await act(async () => {
			await Promise.all([mutate(true), mutate(true)])
			vi.runAllTimers()
		})
		expect(refresh).toHaveBeenCalledTimes(1)

		await act(async () => {
			await mutate(false)
			vi.runAllTimers()
		})
		expect(refresh).toHaveBeenCalledTimes(1)
		vi.useRealTimers()
	})
})
