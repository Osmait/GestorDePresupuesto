import { HydrationBoundary } from '@tanstack/react-query'
import {
	ArrowDownRight,
	ArrowUpRight,
	BarChart3,
	Calendar,
	CreditCard,
	PieChart,
	PiggyBank,
	Plus,
	Receipt,
	Tag,
	Target,
	Wallet,
} from 'lucide-react'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'
import { BudgetProgress } from '@/components/dashboard/BudgetProgress'
import { DashboardDateFilter } from '@/components/dashboard/DashboardDateFilter'
import {
	DashboardAccountsTab,
	DashboardBudgetsTab,
	DashboardTransactionsTab,
} from '@/components/dashboard/DashboardTabs'
import { DashboardTransactionItem } from '@/components/dashboard/DashboardTransactionItem'
import { PatrimonyTab } from '@/components/dashboard/PatrimonyTab'
import { ScopedIntlMessages } from '@/components/i18n/ScopedIntlMessages'
import { Amount } from '@/components/shared/Amount'
import { EmptyState } from '@/components/shared/EmptyState'
import { PageHeader } from '@/components/shared/PageHeader'
import { PageShell } from '@/components/shared/PageShell'
import { PageTabs } from '@/components/shared/PageTabs'
import { StatCard } from '@/components/shared/StatCard'
import { StatGrid } from '@/components/shared/StatGrid'
import { DashboardCharts } from '@/components/transactions/DashboardCharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatLocalDate } from '@/lib/i18n/date-locale'
import { buildDashboardHydrationState } from '@/lib/query/dashboard-hydration'
import {
	serverAccountRepository as accountRepository,
	serverAnalyticsRepository as analyticsRepository,
	serverBudgetRepository as budgetRepository,
	serverCategoryRepository as categoryRepository,
	serverExchangeRateRepository as exchangeRateRepository,
	serverTransactionRepository as transactionRepository,
} from '@/lib/server/repositories'
import { getServerSession } from '@/lib/server/session'
import { formatPercent } from '@/lib/utils'
import type { Budget } from '@/types/budget'
import type { Category } from '@/types/category'

/** One category of the overview card: name, transaction count and its DOP total (with the DOP/USD split). */
function CategoryRow({
	category,
	transactionCount,
	totalAmountDOP,
	dopTotal,
	usdTotal,
	countLabel,
}: {
	category: Category
	transactionCount: number
	totalAmountDOP: number
	dopTotal: number
	usdTotal: number
	countLabel: string
}) {
	return (
		<li className='flex items-center justify-between gap-3 py-3'>
			<div className='flex min-w-0 items-center gap-3'>
				{/* Category color and emoji are user data. */}
				<div
					className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm'
					style={{ backgroundColor: category.color }}
					aria-hidden='true'
				>
					{category.icon}
				</div>
				<div className='min-w-0'>
					<p className='truncate font-medium text-foreground'>{category.name}</p>
					<p className='text-xs text-muted-foreground tabular-nums'>
						{transactionCount} {countLabel}
					</p>
				</div>
			</div>
			<div className='shrink-0 text-right text-xs text-muted-foreground'>
				<Amount value={totalAmountDOP} currency='DOP' className='text-sm font-semibold text-foreground' />
				<p>
					DOP <Amount value={dopTotal} currency='DOP' />
				</p>
				<p>
					USD <Amount value={usdTotal} currency='USD' />
				</p>
			</div>
		</li>
	)
}

/** One budget of the overview card: spent of limit plus a toned progress bar. */
function BudgetRow({
	budget,
	category,
	noCategory,
	locale,
}: {
	budget: Budget
	category?: Category
	noCategory: string
	locale: string
}) {
	const percentage = budget.amount > 0 ? (budget.current_amount / budget.amount) * 100 : 0
	const name = category?.name || noCategory
	return (
		<li className='space-y-2 py-3'>
			<div className='flex items-center justify-between gap-3'>
				<div className='flex min-w-0 items-center gap-3'>
					<div
						className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm'
						style={category?.color ? { backgroundColor: category.color } : undefined}
						aria-hidden='true'
					>
						{category?.icon ?? <Target className='h-4 w-4 text-muted-foreground' />}
					</div>
					<div className='min-w-0'>
						<p className='truncate font-medium text-foreground'>{name}</p>
						<p className='text-xs text-muted-foreground'>
							<Amount value={budget.current_amount} currency='DOP' /> / <Amount value={budget.amount} currency='DOP' />
						</p>
					</div>
				</div>
				<span className='shrink-0 text-sm font-medium tabular-nums'>{formatPercent(percentage, { locale })}</span>
			</div>
			<BudgetProgress percent={percentage} label={name} className='h-1.5' />
		</li>
	)
}

/** Transactions shown in the overview's "recent transactions" card. */
const RECENT_TRANSACTIONS_COUNT = 4

type DashboardPreset = 'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'all' | 'custom'

function resolveDateRange(searchParams: { date_from?: string; date_to?: string; preset?: string }): {
	dateFrom?: string
	dateTo?: string
	preset: DashboardPreset
} {
	const presetParam = (searchParams.preset as DashboardPreset) || 'this_month'
	if (presetParam === 'all') return { preset: 'all' }

	if (searchParams.date_from && searchParams.date_to) {
		return { dateFrom: searchParams.date_from, dateTo: searchParams.date_to, preset: presetParam }
	}

	// Default: current month
	const now = new Date()
	const from = new Date(now.getFullYear(), now.getMonth(), 1)
	const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
	const fmt = (d: Date) =>
		`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
	return { dateFrom: fmt(from), dateTo: fmt(to), preset: 'this_month' }
}

// Componente principal - Server Component que carga datos directamente
export default async function DashboardPage({
	searchParams,
}: {
	searchParams?: Promise<{ date_from?: string; date_to?: string; preset?: string }>
}) {
	const resolvedSearchParams = (await searchParams) ?? {}

	// Get translations
	const t = await getTranslations('dashboard')
	const tAccounts = await getTranslations('accounts')
	const tCategories = await getTranslations('categories')
	const tForms = await getTranslations('forms')
	const locale = await getLocale()

	// Obtener la sesión actual (sin hacer login); cached per request with the layouts
	const session = await getServerSession()

	if (!session || session.error) {
		const { redirect } = await import('next/navigation')
		const { buildLoginUrl, SESSION_EXPIRED_REASON } = await import('@/lib/auth/callback-url')
		const query = new URLSearchParams()
		for (const [key, value] of Object.entries(resolvedSearchParams)) {
			if (typeof value === 'string') query.set(key, value)
		}
		const queryString = query.toString()
		const returnTo = queryString ? `/app?${queryString}` : '/app'
		redirect(buildLoginUrl(returnTo, session?.error ? SESSION_EXPIRED_REASON : undefined))
		return
	}

	const user = session.user

	const { dateFrom, dateTo, preset } = resolveDateRange(resolvedSearchParams)
	const transactionFilters = dateFrom && dateTo ? { date_from: dateFrom, date_to: dateTo } : undefined
	const analyticsFilters = dateFrom && dateTo ? { date_from: dateFrom, date_to: dateTo } : undefined

	// Totals come from the analytics summary; only the 4 newest transactions of the
	// period are rendered here (the transactions tab loads its own page on demand).
	const [accounts, recentResponse, categories, budgets, exchangeRate, dashboardSummary] = await Promise.all([
		accountRepository.findAll(),
		transactionRepository.findAll({
			...transactionFilters,
			page: 1,
			limit: RECENT_TRANSACTIONS_COUNT,
			sort_by: 'created_at',
			sort_order: 'desc',
		}),
		categoryRepository.findAll(),
		budgetRepository.findAll(),
		exchangeRateRepository.getRate(),
		// getDashboardSummary throws on failure; the dashboard still renders its other data (totals show 0).
		analyticsRepository.getDashboardSummary(analyticsFilters).catch((error: unknown) => {
			console.error('Error fetching dashboard summary:', error)
			return null
		}),
	])

	const recentTransactions = Array.isArray(recentResponse?.data) ? recentResponse.data : []

	// Get exchange rate (fallback to 60 if failed)
	const usdToDop = dashboardSummary?.usd_to_dop_rate ?? exchangeRate?.usd_to_dop ?? 60

	const accountsTotal = dashboardSummary?.accounts_total || 0
	const investmentsTotalDOP = dashboardSummary?.investments_total || 0
	const investmentsTotalUSD = usdToDop > 0 ? investmentsTotalDOP / usdToDop : 0
	const certificatesTotal = dashboardSummary?.certificates_total || 0
	const accountsCount = dashboardSummary?.accounts_count || 0
	const investmentsCount = dashboardSummary?.investments_count || 0
	const certificatesCount = dashboardSummary?.certificates_count || 0
	const categoryExpensesById = new Map((dashboardSummary?.category_expenses || []).map((item) => [item.id, item]))

	const totalBalance = dashboardSummary?.accounts_total || 0
	const totalIncome = dashboardSummary?.total_income || 0
	const totalExpenses = dashboardSummary?.total_expenses || 0
	// Older sessions carry `last_name` instead of `lastName`.
	const lastName = user?.lastName || (user as { last_name?: string } | undefined)?.last_name
	const userName = [user?.name, lastName].filter(Boolean).join(' ')

	return (
		<HydrationBoundary state={buildDashboardHydrationState({ accounts, categories, budgets })}>
			<ScopedIntlMessages scope='dashboard'>
				<PageShell>
					<div id='dashboard-header'>
						<PageHeader
							title={t('title')}
							description={userName ? `${t('welcome')}, ${userName}` : t('welcome')}
							actions={
								<>
									<DashboardDateFilter initialFrom={dateFrom} initialTo={dateTo} initialPreset={preset} />
									<Badge variant='outline' className='h-10 gap-1 px-3 font-normal text-muted-foreground'>
										<Calendar className='h-3.5 w-3.5' aria-hidden='true' />
										{formatLocalDate(new Date(), locale, {
											day: 'numeric',
											month: 'long',
											year: 'numeric',
										})}
									</Badge>
								</>
							}
						/>
					</div>

					{/* Dashboard totals come from the API converted to DOP. */}
					<StatGrid id='stats-grid' columns={3}>
						<StatCard label={t('balance')} icon={Wallet} value={<Amount value={totalBalance} currency='DOP' />} />
						<StatCard
							label={t('income')}
							icon={ArrowUpRight}
							tone='positive'
							value={<Amount value={totalIncome} currency='DOP' />}
						/>
						<StatCard
							label={t('expenses')}
							icon={ArrowDownRight}
							tone='negative'
							value={<Amount value={totalExpenses} currency='DOP' />}
						/>
					</StatGrid>

					<div id='dashboard-charts'>
						<DashboardCharts
							categories={categories}
							categorysData={dashboardSummary?.category_expenses || []}
							monthSummary={dashboardSummary?.monthly_summary || []}
						/>
					</div>

					<PageTabs
						defaultValue='overview'
						aria-label={t('sectionsLabel')}
						tabs={[
							{
								value: 'overview',
								label: t('overview'),
								icon: <BarChart3 className='h-4 w-4' />,
								content: (
									<div className='grid grid-cols-1 gap-4 lg:grid-cols-3'>
										<Card id='recent-transactions'>
											<CardHeader>
												<CardTitle className='text-base'>{t('recentTransactions')}</CardTitle>
											</CardHeader>
											<CardContent>
												{recentTransactions.length > 0 ? (
													<div className='space-y-2'>
														{recentTransactions.slice(0, RECENT_TRANSACTIONS_COUNT).map((transaction) => (
															<DashboardTransactionItem
																key={transaction.id}
																transaction={transaction}
																category={categories.find((c) => c.id === transaction.category_id)}
																locale={locale}
															/>
														))}
													</div>
												) : (
													<EmptyState compact icon={Receipt} title={t('noData')} />
												)}
											</CardContent>
										</Card>

										<Card>
											<CardHeader>
												<CardTitle className='text-base'>{t('categories')}</CardTitle>
											</CardHeader>
											<CardContent>
												{Array.isArray(categories) && categories.length > 0 ? (
													<ul className='divide-y'>
														{categories.slice(0, 4).map((category) => {
															const stats = categoryExpensesById.get(category.id)
															return (
																<CategoryRow
																	key={category.id}
																	category={category}
																	transactionCount={stats?.transaction_count || 0}
																	totalAmountDOP={stats?.value || 0}
																	dopTotal={stats?.dop_total || 0}
																	usdTotal={stats?.usd_total || 0}
																	countLabel={t('transactionsCount')}
																/>
															)
														})}
													</ul>
												) : (
													<EmptyState compact icon={Tag} title={tCategories('noCategories')} />
												)}
											</CardContent>
										</Card>

										<Card>
											<CardHeader>
												<CardTitle className='text-base'>{t('budgetSummary')}</CardTitle>
											</CardHeader>
											<CardContent>
												{Array.isArray(budgets) && budgets.length > 0 ? (
													<>
														<ul className='divide-y'>
															{budgets.slice(0, 3).map((budget) => (
																<BudgetRow
																	key={budget.id}
																	budget={budget}
																	category={
																		Array.isArray(categories)
																			? categories.find((c) => c.id === budget.category_id)
																			: undefined
																	}
																	noCategory={t('noCategory')}
																	locale={locale}
																/>
															))}
														</ul>
														{budgets.length > 3 && (
															<p className='pt-2 text-center text-xs text-muted-foreground'>
																<Link href='/app/budget' className='hover:text-foreground hover:underline'>
																	+{budgets.length - 3} {t('moreBudgets')}
																</Link>
															</p>
														)}
													</>
												) : (
													<EmptyState
														compact
														icon={PiggyBank}
														title={t('noBudgetsConfigured')}
														action={
															<Button asChild size='sm' variant='outline'>
																<Link href='/app/budget?create=1'>
																	<Plus className='mr-2 h-4 w-4' aria-hidden='true' />
																	{tForms('createBudget')}
																</Link>
															</Button>
														}
													/>
												)}
											</CardContent>
										</Card>
									</div>
								),
							},
							{
								value: 'accounts',
								label: t('accounts'),
								icon: <CreditCard className='h-4 w-4' />,
								content: (
									<DashboardAccountsTab
										labels={{
											noAccounts: tAccounts('emptyTitle'),
											addAccount: tAccounts('addAccount'),
											creditCards: t('creditCardsSection'),
										}}
									/>
								),
							},
							{
								value: 'transactions',
								label: t('transactionsTab'),
								icon: <Wallet className='h-4 w-4' />,
								content: (
									<DashboardTransactionsTab
										dateFrom={dateFrom}
										dateTo={dateTo}
										locale={locale}
										labels={{ viewAll: t('viewAll'), noData: t('noData') }}
									/>
								),
							},
							{
								value: 'budgets',
								label: t('budgets'),
								icon: <PieChart className='h-4 w-4' />,
								content: (
									<DashboardBudgetsTab
										labels={{
											noBudgetsConfigured: t('noBudgetsConfigured'),
											createBudgetHint: t('createBudgetHint'),
											createBudget: tForms('createBudget'),
										}}
									/>
								),
							},
							{
								value: 'patrimony',
								label: t('patrimony'),
								icon: <PiggyBank className='h-4 w-4' />,
								content: (
									<PatrimonyTab
										accountsTotal={accountsTotal}
										investmentsTotal={investmentsTotalDOP}
										investmentsTotalUSD={investmentsTotalUSD}
										certificatesTotal={certificatesTotal}
										creditCardDebt={dashboardSummary?.credit_card_debt ?? 0}
										creditCardsCount={dashboardSummary?.credit_cards_count ?? 0}
										accountsCount={accountsCount}
										investmentsCount={investmentsCount}
										certificatesCount={certificatesCount}
										exchangeRate={usdToDop}
										labels={{
											title: t('patrimony'),
											accounts: t('accountsBalance'),
											investments: t('investmentsValue'),
											certificates: t('certificatesValue'),
											cardDebt: t('cardDebt'),
											total: t('totalPatrimony'),
											activeItems: t('activeItems'),
											exchangeRate: t('exchangeRate'),
											distribution: t('distribution'),
											noData: t('noData'),
										}}
									/>
								),
							},
						]}
					/>
				</PageShell>
			</ScopedIntlMessages>
		</HydrationBoundary>
	)
}
