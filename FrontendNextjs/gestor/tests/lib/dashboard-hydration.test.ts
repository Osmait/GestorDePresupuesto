import { hydrate, QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import { ACCOUNT_KEYS } from '@/hooks/queries/useAccountsQuery'
import { BUDGET_KEYS } from '@/hooks/queries/useBudgetsQuery'
import { CATEGORY_KEYS } from '@/hooks/queries/useCategoriesQuery'
import { buildDashboardHydrationState } from '@/lib/query/dashboard-hydration'

describe('buildDashboardHydrationState', () => {
	it('seeds the shared list queries with the same shape the client query functions return', () => {
		const accounts = [{ id: 'a1' }, { id: 'a2' }] as any[]
		const categories = [{ id: 'c1' }] as any[]
		const budgets = [{ id: 'b1' }, { id: 'b2' }, { id: 'b3' }] as any[]

		const client = new QueryClient()
		hydrate(client, buildDashboardHydrationState({ accounts, categories, budgets }))

		// client hooks keep the lists newest first (reversed API order)
		expect(client.getQueryData(ACCOUNT_KEYS.lists())).toEqual([{ id: 'a2' }, { id: 'a1' }])
		expect(client.getQueryData(CATEGORY_KEYS.lists())).toEqual([{ id: 'c1' }])
		expect(client.getQueryData(BUDGET_KEYS.lists())).toEqual([{ id: 'b3' }, { id: 'b2' }, { id: 'b1' }])
		// fresh: within the default 5 min staleTime nothing refetches
		expect(client.getQueryState(ACCOUNT_KEYS.lists())?.dataUpdatedAt).toBeGreaterThan(Date.now() - 1000)
		// the server arrays are not mutated
		expect(accounts.map((a) => a.id)).toEqual(['a1', 'a2'])
	})

	it('does not cache empty lists (server repositories turn errors into [])', () => {
		const client = new QueryClient()
		hydrate(client, buildDashboardHydrationState({ accounts: [], categories: [{ id: 'c1' }] as any[], budgets: [] }))

		expect(client.getQueryData(ACCOUNT_KEYS.lists())).toBeUndefined()
		expect(client.getQueryData(BUDGET_KEYS.lists())).toBeUndefined()
		expect(client.getQueryData(CATEGORY_KEYS.lists())).toEqual([{ id: 'c1' }])
	})
})
