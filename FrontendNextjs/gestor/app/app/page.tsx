import {
	ArrowDownRight,
	ArrowUpRight,
	BarChart3,
	Calendar,
	CreditCard,
	DollarSign,
	LucideIcon,
	PieChart,
	PiggyBank,
	Target,
	TrendingDown,
	TrendingUp,
	Wallet,
} from 'lucide-react'
import { getLocale, getTranslations } from 'next-intl/server'
import { AnimatedTabs } from '@/components/common/animated-tabs'
import { DashboardDateFilter } from '@/components/dashboard/DashboardDateFilter'
import { PatrimonyTab } from '@/components/dashboard/PatrimonyTab'
import { DashboardCharts } from '@/components/transactions/DashboardCharts'
import { AnimatedCounter } from '@/components/ui/animated-counter'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatLocalDate } from '@/lib/i18n/date-locale'
import {
	serverAccountRepository as accountRepository,
	serverAnalyticsRepository as analyticsRepository,
	serverBudgetRepository as budgetRepository,
	serverCategoryRepository as categoryRepository,
	serverExchangeRateRepository as exchangeRateRepository,
	serverTransactionRepository as transactionRepository,
} from '@/lib/server/repositories'
import { getSignedAmount, isInflowTransaction } from '@/lib/transaction-utils'
import { DEFAULT_CURRENCY, formatCurrency } from '@/lib/utils'
import { Account } from '@/types/account'
import { DashboardSummary } from '@/types/analytics'
import { Budget } from '@/types/budget'
import { Category } from '@/types/category'
import { Transaction } from '@/types/transaction'

interface StatCardProps {
	title: string
	value: number
	icon: LucideIcon
	trend?: 'up' | 'down'
	trendValue?: string
	color?: 'blue' | 'green' | 'red' | 'purple' | 'orange'
	locale: string
}

// Server Component para StatCard (renders Client Component leaf)
function StatCard({ title, value, icon: Icon, trend, trendValue, color = 'blue', locale }: StatCardProps) {
	const colorClasses = {
		blue: 'from-blue-500/10 to-cyan-500/10 dark:from-blue-500/5 dark:to-cyan-500/5 text-blue-600 dark:text-blue-400',
		green:
			'from-green-500/10 to-emerald-500/10 dark:from-green-500/5 dark:to-emerald-500/5 text-green-600 dark:text-green-400',
		red: 'from-red-500/10 to-rose-500/10 dark:from-red-500/5 dark:to-rose-500/5 text-red-600 dark:text-red-400',
		purple:
			'from-purple-500/10 to-violet-500/10 dark:from-purple-500/5 dark:to-violet-500/5 text-purple-600 dark:text-purple-400',
		orange:
			'from-orange-500/10 to-amber-500/10 dark:from-orange-500/5 dark:to-amber-500/5 text-orange-600 dark:text-orange-400',
	}

	return (
		<Card className='border-border/50 dark:border-border/20 transition-all duration-200 hover:bg-accent/40 dark:hover:bg-accent/40'>
			<CardContent className='p-6'>
				<div className={`rounded-lg p-4 bg-gradient-to-br ${colorClasses[color]}`}>
					<div className='flex items-center justify-between mb-3'>
						<Icon className='h-6 w-6' />
						{trend && trendValue && (
							<div
								className={`flex items-center gap-1 text-xs font-medium ${
									trend === 'up' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
								}`}
							>
								{trend === 'up' ? <ArrowUpRight className='h-3 w-3' /> : <ArrowDownRight className='h-3 w-3' />}
								{trendValue}
							</div>
						)}
					</div>
					<p className='text-sm font-medium text-muted-foreground mb-1'>{title}</p>
					<p className='text-xl sm:text-2xl font-bold text-foreground tabular-nums break-words'>
						{/* Dashboard totals come from the API converted to DOP. */}
						<AnimatedCounter value={value} currency='DOP' locale={locale} />
					</p>
				</div>
			</CardContent>
		</Card>
	)
}

// Server Component para TransactionItem
function TransactionItem({
	transaction,
	category,
	locale,
}: {
	transaction: Transaction
	category?: Category
	locale?: string
}) {
	const isIncome = isInflowTransaction(transaction.type_transation)

	return (
		<div className='flex items-center justify-between gap-3 p-3 rounded-lg border border-border/40 dark:border-border/20 hover:bg-accent/50 dark:hover:bg-accent/50 transition-colors'>
			<div className='flex min-w-0 items-center gap-3'>
				<div
					className='w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-lg'
					style={{ backgroundColor: category?.color || '#6B7280' }}
				>
					{category?.icon || '💳'}
				</div>
				<div className='min-w-0'>
					<p className='font-medium text-foreground truncate'>{transaction.name}</p>
					<p className='text-sm text-muted-foreground truncate'>{transaction.description}</p>
					<p className='text-xs text-muted-foreground'>{formatLocalDate(transaction.created_at, locale ?? 'es')}</p>
				</div>
			</div>
			<div className='shrink-0 text-right'>
				<p
					className={`font-bold tabular-nums whitespace-nowrap ${isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
				>
					{formatCurrency(getSignedAmount(transaction), transaction.currency, {
						locale,
						signDisplay: 'exceptZero',
					})}
				</p>
				<p className='text-xs text-muted-foreground truncate max-w-[8rem]'>{category?.name}</p>
			</div>
		</div>
	)
}

// Server Component para CategoryCard
function CategoryCard({
	category,
	transactionCount,
	totalAmountDOP,
	dopTotal,
	usdTotal,
	t,
	locale,
}: {
	category: Category
	transactionCount: number
	totalAmountDOP: number
	dopTotal: number
	usdTotal: number
	t: any
	locale: string
}) {
	return (
		<div className='flex items-center justify-between gap-3 p-3 rounded-lg border border-border/40 dark:border-border/20 hover:bg-accent/50 dark:hover:bg-accent/50 transition-colors'>
			<div className='flex min-w-0 items-center gap-3'>
				<div
					className='w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm'
					style={{ backgroundColor: category.color }}
				>
					{category.icon}
				</div>
				<div className='min-w-0'>
					<p className='font-medium text-foreground truncate'>{category.name}</p>
					<p className='text-xs text-muted-foreground'>
						{transactionCount} {t('transactionsCount')}
					</p>
				</div>
			</div>
			<div className='shrink-0 text-right tabular-nums'>
				<p className='font-bold text-foreground'>{formatCurrency(totalAmountDOP, 'DOP', { locale })}</p>
				<p className='text-[11px] text-muted-foreground'>DOP: {formatCurrency(dopTotal, 'DOP', { locale })}</p>
				<p className='text-[11px] text-muted-foreground'>USD: {formatCurrency(usdTotal, 'USD', { locale })}</p>
			</div>
		</div>
	)
}

// Server Component para AccountCard
function AccountCard({ account, t, locale }: { account: Account; t: any; locale: string }) {
	const currentBalance = account.current_balance ?? account.initial_balance ?? 0
	const isPositive = currentBalance > 0
	const currency = account.currency || DEFAULT_CURRENCY

	return (
		<Card className='border-border/50 dark:border-border/20 hover:bg-accent/40 dark:hover:bg-accent/40 transition-all duration-200'>
			<CardContent className='p-6'>
				<div className='flex items-center justify-between gap-2 mb-4'>
					<div className='min-w-0'>
						<h3 className='font-semibold text-foreground truncate'>{account.name}</h3>
						<p className='text-sm text-muted-foreground truncate'>{account.bank}</p>
					</div>
					<CreditCard className='h-5 w-5 shrink-0 text-muted-foreground' aria-hidden='true' />
				</div>
				<div className='space-y-2'>
					<p
						className={`text-xl sm:text-2xl font-bold tabular-nums break-words ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
					>
						{formatCurrency(currentBalance, currency, { locale })}
					</p>
					<div className='flex flex-wrap gap-2'>
						<Badge variant='outline' className='text-xs'>
							{currentBalance > 10000 ? t('high') : currentBalance > 5000 ? t('medium') : t('low')}
						</Badge>
						{account.current_balance !== account.initial_balance && (
							<Badge variant='secondary' className='text-xs'>
								{t('initial')}: {formatCurrency(account.initial_balance, currency, { locale })}
							</Badge>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

// Server Component para BudgetCard
function BudgetCard({ budget, category, t, locale }: { budget: Budget; category?: Category; t: any; locale: string }) {
	const spentAmount = budget.current_amount
	const percentage = budget.amount > 0 ? (spentAmount / budget.amount) * 100 : 0
	const isOverBudget = spentAmount > budget.amount

	return (
		<Card className='border-border/50 dark:border-border/20'>
			<CardContent className='p-6'>
				<div className='flex items-center justify-between gap-2 mb-4'>
					<div className='flex min-w-0 items-center gap-3'>
						<div
							className='w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm'
							style={{ backgroundColor: category?.color || '#6B7280' }}
						>
							{category?.icon || '📊'}
						</div>
						<div className='min-w-0'>
							<h3 className='font-medium text-foreground truncate'>{category?.name || t('noCategory')}</h3>
							<p className='text-sm text-muted-foreground tabular-nums'>
								{formatCurrency(spentAmount, 'DOP', { locale })} {t('of')}{' '}
								{formatCurrency(budget.amount, 'DOP', { locale })}
							</p>
						</div>
					</div>
					<Badge variant={isOverBudget ? 'destructive' : percentage > 80 ? 'secondary' : 'outline'} className='text-xs'>
						{percentage.toFixed(1)}%
					</Badge>
				</div>
				<div className='relative h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700'>
					<div
						className='h-full transition-all duration-500 rounded-full'
						style={{
							width: `${Math.max(Math.min(percentage, 100), percentage > 0 ? 5 : 0)}%`,
							minWidth: percentage > 0 ? '8px' : '0px',
							backgroundColor: percentage > 80 ? '#ef4444' : percentage > 60 ? '#eab308' : '#22c55e',
						}}
					/>
				</div>
			</CardContent>
		</Card>
	)
}

// Server Component para el header
function DashboardHeader({
	user,
	t,
	locale,
	dateFrom,
	dateTo,
	preset,
}: {
	user: any
	t: any
	locale: string
	dateFrom?: string
	dateTo?: string
	preset: 'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'all' | 'custom'
}) {
	return (
		<div className='mb-8'>
			<div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4'>
				<div>
					<h1 className='text-4xl font-bold tracking-tight text-foreground'>{t('title')}</h1>
					<p className='text-muted-foreground mt-2 text-lg'>
						{t('welcome')}, {user?.name} {user?.lastName || user?.last_name} 👋
					</p>
				</div>
				<div className='flex flex-wrap items-center gap-3'>
					<DashboardDateFilter initialFrom={dateFrom} initialTo={dateTo} initialPreset={preset} />
					<Badge
						variant='outline'
						className='bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-400'
					>
						<Calendar className='h-3 w-3 mr-1' />
						{formatLocalDate(new Date(), locale, {
							day: 'numeric',
							month: 'long',
							year: 'numeric',
						})}
					</Badge>
				</div>
			</div>
		</div>
	)
}

// Server Component para las estadísticas
function StatsGrid({ summary, t, locale }: { summary: DashboardSummary | null; t: any; locale: string }) {
	const totalBalance = summary?.accounts_total || 0
	const totalIncome = summary?.total_income || 0
	const totalExpenses = summary?.total_expenses || 0

	return (
		<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8'>
			<StatCard title={t('balance')} value={totalBalance} icon={DollarSign} color='blue' locale={locale} />
			<StatCard title={t('income')} value={totalIncome} icon={TrendingUp} color='green' locale={locale} />
			<StatCard title={t('expenses')} value={totalExpenses} icon={TrendingDown} color='red' locale={locale} />
		</div>
	)
}

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
	const locale = await getLocale()

	// Obtener la sesión actual (sin hacer login)
	const { auth } = await import('@/auth')
	const session = await auth()

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

	const [accounts, transactionResponse, categories, budgets, exchangeRate, dashboardSummary] = await Promise.all([
		accountRepository.findAll(),
		transactionRepository.findAllSimple(transactionFilters),
		categoryRepository.findAll(),
		budgetRepository.findAll(),
		exchangeRateRepository.getRate(),
		analyticsRepository.getDashboardSummary(analyticsFilters),
	])

	// Extract transactions from the response
	const transactions = transactionResponse || []

	const recentTransactions = Array.isArray(transactions) ? transactions.slice(0, 8) : []

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

	return (
		<div className='min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20'>
			<div className='container mx-auto px-4 py-8'>
				<div id='dashboard-header'>
					<DashboardHeader user={user} t={t} locale={locale} dateFrom={dateFrom} dateTo={dateTo} preset={preset} />
				</div>
				<div id='dashboard-charts'>
					<DashboardCharts
						categories={categories}
						transactions={Array.isArray(transactions) ? transactions : []}
						categorysData={dashboardSummary?.category_expenses || []}
						monthSummary={dashboardSummary?.monthly_summary || []}
					/>
				</div>
				<div id='stats-grid'>
					<StatsGrid summary={dashboardSummary} t={t} locale={locale} />
				</div>

				<AnimatedTabs
					defaultValue='overview'
					className='space-y-6'
					tabs={[
						{
							value: 'overview',
							label: t('overview'),
							icon: <BarChart3 className='h-4 w-4' />,
							content: (
								<div className='space-y-6'>
									<div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
										<Card id='recent-transactions' className='border-border/50 dark:border-border/20'>
											<CardHeader>
												<CardTitle className='flex items-center gap-2 text-foreground'>
													<Wallet className='h-5 w-5' />
													{t('recentTransactions')}
												</CardTitle>
											</CardHeader>
											<CardContent>
												<div className='space-y-1'>
													{Array.isArray(recentTransactions)
														? recentTransactions.slice(0, 4).map((transaction) => {
																const category = categories.find((c) => c.id === transaction.category_id)
																return (
																	<TransactionItem
																		key={transaction.id}
																		transaction={transaction}
																		category={category}
																		locale={locale}
																	/>
																)
															})
														: []}
												</div>
											</CardContent>
										</Card>

										<Card className='border-border/50 dark:border-border/20'>
											<CardHeader>
												<CardTitle className='flex items-center gap-2 text-foreground'>
													<PieChart className='h-5 w-5' />
													{t('categories')}
												</CardTitle>
											</CardHeader>
											<CardContent>
												<div className='space-y-4'>
													{Array.isArray(categories)
														? categories.slice(0, 4).map((category) => {
																const stats = categoryExpensesById.get(category.id)
																return (
																	<CategoryCard
																		key={category.id}
																		category={category}
																		transactionCount={stats?.transaction_count || 0}
																		totalAmountDOP={stats?.value || 0}
																		dopTotal={stats?.dop_total || 0}
																		usdTotal={stats?.usd_total || 0}
																		t={t}
																		locale={locale}
																	/>
																)
															})
														: []}
												</div>
											</CardContent>
										</Card>

										<Card className='border-border/50 dark:border-border/20'>
											<CardHeader>
												<CardTitle className='flex items-center gap-2 text-foreground'>
													<Target className='h-5 w-5' />
													{t('budgetSummary')}
												</CardTitle>
											</CardHeader>
											<CardContent>
												<div className='space-y-4'>
													{Array.isArray(budgets) && budgets.length > 0 ? (
														<>
															{budgets.slice(0, 3).map((budget) => {
																const category = Array.isArray(categories)
																	? categories.find((c) => c.id === budget.category_id)
																	: undefined
																const spentAmount = budget.current_amount
																const percentage = budget.amount > 0 ? (spentAmount / budget.amount) * 100 : 0

																return (
																	<div
																		key={budget.id}
																		className='flex items-center justify-between gap-3 p-3 rounded-lg border border-border/40 dark:border-border/20 hover:bg-accent/50 dark:hover:bg-accent/50 transition-colors'
																	>
																		<div className='flex min-w-0 items-center gap-3'>
																			<div
																				className='w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm'
																				style={{ backgroundColor: category?.color || '#6B7280' }}
																			>
																				{category?.icon || '📊'}
																			</div>
																			<div className='min-w-0'>
																				<p className='font-medium text-foreground truncate'>
																					{category?.name || t('noCategory')}
																				</p>
																				<p className='text-xs text-muted-foreground tabular-nums'>
																					{formatCurrency(spentAmount, 'DOP', { locale })} /{' '}
																					{formatCurrency(budget.amount, 'DOP', { locale })}
																				</p>
																			</div>
																		</div>
																		<div className='text-right'>
																			<p
																				className={`text-sm font-bold ${
																					percentage > 80
																						? 'text-red-600 dark:text-red-400'
																						: percentage > 60
																							? 'text-yellow-600 dark:text-yellow-400'
																							: 'text-green-600 dark:text-green-400'
																				}`}
																			>
																				{percentage.toFixed(1)}%
																			</p>
																		</div>
																	</div>
																)
															})}
															{budgets.length > 3 && (
																<div className='text-center pt-2'>
																	<p className='text-xs text-muted-foreground'>
																		+{budgets.length - 3} {t('moreBudgets')}
																	</p>
																</div>
															)}
														</>
													) : (
														<div className='text-center py-4 text-muted-foreground'>
															<p className='text-sm'>{t('noBudgetsConfigured')}</p>
														</div>
													)}
												</div>
											</CardContent>
										</Card>
									</div>
								</div>
							),
						},
						{
							value: 'accounts',
							label: t('accounts'),
							icon: <CreditCard className='h-4 w-4' />,
							content: (
								<div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
									{Array.isArray(accounts) &&
										accounts.map((account) => <AccountCard key={account.id} account={account} t={t} locale={locale} />)}
								</div>
							),
						},
						{
							value: 'transactions',
							label: t('transactionsTab'),
							icon: <Wallet className='h-4 w-4' />,
							content: (
								<div className='space-y-4'>
									{Array.isArray(transactions)
										? transactions.map((transaction) => {
												const category = categories.find((c) => c.id === transaction.category_id)
												return (
													<TransactionItem
														key={transaction.id}
														transaction={transaction}
														category={category}
														locale={locale}
													/>
												)
											})
										: []}
								</div>
							),
						},
						{
							value: 'budgets',
							label: t('budgets'),
							icon: <PieChart className='h-4 w-4' />,
							content: (
								<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
									{budgets && budgets.length > 0 ? (
										budgets.map((budget) => {
											const category = Array.isArray(categories)
												? categories.find((c) => c.id === budget.category_id)
												: undefined
											return <BudgetCard key={budget.id} budget={budget} category={category} t={t} locale={locale} />
										})
									) : (
										<div className='col-span-full text-center py-12 text-muted-foreground'>
											<Target className='h-12 w-12 mx-auto mb-4 opacity-50' />
											<h3 className='text-lg font-semibold mb-2'>{t('noBudgetsConfigured')}</h3>
											<p className='text-sm'>{t('createBudgetHint')}</p>
										</div>
									)}
								</div>
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
									accountsCount={accountsCount}
									investmentsCount={investmentsCount}
									certificatesCount={certificatesCount}
									exchangeRate={usdToDop}
									locale={locale}
									labels={{
										title: t('patrimony'),
										accounts: t('accountsBalance'),
										investments: t('investmentsValue'),
										certificates: t('certificatesValue'),
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
			</div>
		</div>
	)
}
