import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { FINANCIAL_QUERY_ROOTS } from '@/hooks/queries/invalidateFinancialData'

/**
 * Guards against a write that leaves balances stale for the 5-minute staleTime:
 * every mutation hook in hooks/queries must invalidate the financial queries
 * (invalidateFinancialData) or be explicitly marked as not touching them
 * (nonFinancialMutation for writes, readOnlyMutation for previews/analyses).
 */

// Any repository method resolves to an empty object; `then` stays undefined so
// `await getXRepository()` resolves to the repository itself.
const { fakeRepository } = vi.hoisted(() => ({
	fakeRepository: new Proxy({} as Record<string, unknown>, {
		get: (_target, prop) => (prop === 'then' ? undefined : () => Promise.resolve({})),
	}),
}))

vi.mock('@/lib/repositoryConfig', async (importOriginal) => {
	const actual = await importOriginal<Record<string, unknown>>()
	return Object.fromEntries(Object.keys(actual).map((name) => [name, () => fakeRepository]))
})
vi.mock('@/app/repository/aiRepository', () => ({ aiRepository: fakeRepository }))
vi.mock('@/app/repository/certificateRepository', () => ({ getCertificateRepository: () => fakeRepository }))
vi.mock('@/app/repository/recurringTransactionRepository', () => ({
	RecurringTransactionRepository: function RecurringTransactionRepository() {
		return fakeRepository
	},
}))
vi.mock('@/app/repository/monthlyPlanRepository', () => ({
	MonthlyPlanRepository: function MonthlyPlanRepository() {
		return fakeRepository
	},
}))

const modules = import.meta.glob<Record<string, unknown>>('../../../hooks/queries/*.ts', { eager: true })
const sources = import.meta.glob<string>('../../../hooks/queries/*.ts', {
	eager: true,
	query: '?raw',
	import: 'default',
})

// Variables shaped loosely enough for every mutationFn (the repositories ignore them).
const variables = {
	id: 'x1',
	cardId: 'c1',
	loanId: 'l1',
	goalId: 'g1',
	sessionId: 's1',
	paymentId: 'p1',
	status: 'paid',
	isActive: true,
	data: { card: {}, creditLimits: [] },
	request: {},
}

type MutationHookResult = { mutateAsync: (variables: unknown) => Promise<unknown> }

// Hooks whose name says they are a write (queries take arguments and are not rendered here).
const MUTATION_NAME = /Mutation$|^use(Create|Update|Delete|Toggle|Process|Reset|Fund|Register|Cancel|Apply)[A-Z]/

const mutationHooks = Object.entries(modules).flatMap(([file, exports]) =>
	Object.entries(exports)
		.filter(([name, value]) => typeof value === 'function' && MUTATION_NAME.test(name))
		.map(([name, hook]) => ({ file: file.split('/').pop() as string, name, hook: hook as () => MutationHookResult })),
)

async function runMutation(useHook: () => MutationHookResult) {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	for (const queryKey of FINANCIAL_QUERY_ROOTS) queryClient.setQueryData([...queryKey, 'seed'], { seeded: true })
	const wrapper = ({ children }: { children: React.ReactNode }) => (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	)
	const { result } = renderHook(useHook, { wrapper })
	expect(typeof result.current.mutateAsync).toBe('function')
	await act(async () => {
		await result.current.mutateAsync(variables)
	})
	const [mutation] = queryClient.getMutationCache().getAll()
	const invalidatedRoots = FINANCIAL_QUERY_ROOTS.filter(
		(queryKey) => queryClient.getQueryState([...queryKey, 'seed'])?.isInvalidated,
	)
	return { meta: mutation.options.meta ?? {}, invalidatedRoots }
}

describe('mutation hooks keep financial data fresh', () => {
	it('finds every useMutation call in hooks/queries', () => {
		const calls = Object.values(sources).reduce(
			(count, source) => count + (source.match(/useMutation[<(]/g) ?? []).length,
			0,
		)
		// A mutation hook not matched by MUTATION_NAME would skip the check below: rename it.
		expect(mutationHooks.length).toBe(calls)
	})

	it.each(mutationHooks.map((entry) => [`${entry.file} ${entry.name}`, entry] as const))(
		'%s invalidates every financial query or is marked as not touching them',
		async (_label, { hook }) => {
			const { meta, invalidatedRoots } = await runMutation(hook)
			if (meta.financial === false || meta.refresh === false) {
				return
			}
			expect(invalidatedRoots).toEqual(FINANCIAL_QUERY_ROOTS)
		},
	)
})
