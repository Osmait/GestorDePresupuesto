import type { QueryClient } from '@tanstack/react-query'

/**
 * Root query keys whose data is derived from transactions and balances.
 * Kept as literals (instead of importing each *_KEYS object) to avoid import
 * cycles between the query modules; they must match the `all` key of each.
 */
export const FINANCIAL_QUERY_ROOTS = [
	['transactions'], // TRANSACTION_KEYS.all (paginated lists + simple list)
	['accounts'], // ACCOUNT_KEYS.all (list + detail: current_balance changes)
	['budgets'], // BUDGET_KEYS.all (current_amount)
	['categories'], // CATEGORY_KEYS.all
	['analytics'], // ANALYTICS_KEYS.all (dashboard summary, category expenses)
	['search'], // SEARCH_KEYS.all
] as const

/**
 * Marks every money-related query stale. Active queries refetch right away;
 * inactive ones refetch on their next mount, so navigating to another page
 * after a mutation never shows pre-mutation balances.
 */
export function invalidateFinancialData(queryClient: QueryClient) {
	return Promise.all(FINANCIAL_QUERY_ROOTS.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
}
