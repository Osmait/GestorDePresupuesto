import { type DehydratedState, dehydrate, QueryClient } from '@tanstack/react-query'
import { ACCOUNT_KEYS } from '@/hooks/queries/useAccountsQuery'
import { BUDGET_KEYS } from '@/hooks/queries/useBudgetsQuery'
import { CATEGORY_KEYS } from '@/hooks/queries/useCategoriesQuery'
import type { Account } from '@/types/account'
import type { Budget } from '@/types/budget'
import type { Category } from '@/types/category'

interface DashboardServerData {
	accounts: Account[]
	categories: Category[]
	budgets: Budget[]
}

/**
 * TanStack Query state built from the lists the dashboard already fetched on
 * the server, so client pages visited next (transactions, forms) start with
 * accounts, categories and budgets in the cache instead of refetching them.
 *
 * The cached values must match what the client query functions return (same
 * keys, newest first). Empty lists are not seeded: the server repositories
 * turn errors into [], which must not be cached as "no data".
 */
export function buildDashboardHydrationState({ accounts, categories, budgets }: DashboardServerData): DehydratedState {
	const queryClient = new QueryClient()
	const seed = (queryKey: readonly unknown[], data: unknown[]) => {
		if (Array.isArray(data) && data.length > 0) queryClient.setQueryData(queryKey, [...data].reverse())
	}
	seed(ACCOUNT_KEYS.lists(), accounts)
	seed(CATEGORY_KEYS.lists(), categories)
	seed(BUDGET_KEYS.lists(), budgets)
	return dehydrate(queryClient)
}
