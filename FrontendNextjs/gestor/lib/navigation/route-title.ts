/**
 * Keys (in the `nav` messages namespace) for the title/description shown in the
 * top bar for each app section. Longest matching prefix wins, so
 * `/app/accounts/123` resolves to the Accounts section.
 */
const ROUTE_TITLES: ReadonlyArray<{ prefix: string; title: string; description: string }> = [
	{ prefix: '/app/accounts', title: 'accounts', description: 'accountsDesc' },
	{ prefix: '/app/transactions', title: 'transactions', description: 'transactionsDesc' },
	{ prefix: '/app/category', title: 'categories', description: 'categoriesDesc' },
	{ prefix: '/app/budget', title: 'budgets', description: 'budgetsDesc' },
	{ prefix: '/app/monthly', title: 'monthlyPlan', description: 'monthlyPlanDesc' },
	{ prefix: '/app/investments', title: 'investments', description: 'investmentsDesc' },
	{ prefix: '/app/certificates', title: 'certificates', description: 'certificatesDesc' },
	{ prefix: '/app/loans', title: 'loans', description: 'loansDesc' },
	{ prefix: '/app/credit-cards', title: 'creditCards', description: 'creditCardsDesc' },
	{ prefix: '/app/analysis', title: 'analytics', description: 'analyticsDesc' },
	{ prefix: '/app/settings', title: 'settings', description: 'settingsDesc' },
]

const DASHBOARD = { title: 'dashboard', description: 'dashboardDesc' } as const

export function getRouteTitleKeys(pathname: string | null | undefined): { title: string; description: string } {
	const path = (pathname || '').split(/[?#]/)[0].replace(/\/+$/, '')
	const match = ROUTE_TITLES.filter(({ prefix }) => path === prefix || path.startsWith(`${prefix}/`)).sort(
		(a, b) => b.prefix.length - a.prefix.length,
	)[0]
	return match ? { title: match.title, description: match.description } : DASHBOARD
}
