import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AnimatedTabs } from '@/components/common/animated-tabs'
import {
	getAccountRepository,
	getTransactionRepository,
	getCategoryRepository,
	getBudgetRepository,
	getAnalyticsRepository
} from '@/lib/repositoryConfig'
import { Account } from '@/types/account'
import { Transaction, TypeTransaction } from '@/types/transaction'
import { Category } from '@/types/category'
import { Budget } from '@/types/budget'
import {
	TrendingUp,
	TrendingDown,
	Wallet,
	CreditCard,
	DollarSign,
	Calendar,
	PieChart,
	BarChart3,
	ArrowUpRight,
	ArrowDownRight,
	Zap,
	Target,
	LucideIcon
} from 'lucide-react'
import { AnimatedCounter } from '@/components/ui/animated-counter'
import { DashboardCharts } from '@/components/transactions/DashboardCharts'
import { DemoTour } from '@/components/common/DemoTour'
import { getTranslations, getLocale } from 'next-intl/server'

interface StatCardProps {
	title: string
	value: number
	icon: LucideIcon
	trend?: 'up' | 'down'
	trendValue?: string
	color?: 'blue' | 'green' | 'red' | 'purple' | 'orange'
}


// Server Component para StatCard (renders Client Component leaf)
function StatCard({ title, value, icon: Icon, trend, trendValue, color = 'blue' }: StatCardProps) {
	const colorClasses = {
		blue: 'from-blue-500/10 to-cyan-500/10 dark:from-blue-500/5 dark:to-cyan-500/5 text-blue-600 dark:text-blue-400',
		green: 'from-green-500/10 to-emerald-500/10 dark:from-green-500/5 dark:to-emerald-500/5 text-green-600 dark:text-green-400',
		red: 'from-red-500/10 to-rose-500/10 dark:from-red-500/5 dark:to-rose-500/5 text-red-600 dark:text-red-400',
		purple: 'from-purple-500/10 to-violet-500/10 dark:from-purple-500/5 dark:to-violet-500/5 text-purple-600 dark:text-purple-400',
		orange: 'from-orange-500/10 to-amber-500/10 dark:from-orange-500/5 dark:to-amber-500/5 text-orange-600 dark:text-orange-400'
	}

	return (
		<Card className="border-border/50 dark:border-border/20 transition-all duration-200 hover:bg-accent/40 dark:hover:bg-accent/40">
			<CardContent className="p-6">
				<div className={`rounded-lg p-4 bg-gradient-to-br ${colorClasses[color]}`}>
					<div className="flex items-center justify-between mb-3">
						<Icon className="h-6 w-6" />
						{trend && trendValue && (
							<div className={`flex items-center gap-1 text-xs font-medium ${trend === 'up' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
								}`}>
								{trend === 'up' ? (
									<ArrowUpRight className="h-3 w-3" />
								) : (
									<ArrowDownRight className="h-3 w-3" />
								)}
								{trendValue}
							</div>
						)}
					</div>
					<p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
					<p className="text-2xl font-bold text-foreground">
						<AnimatedCounter value={value} prefix="$" />
					</p>
				</div>
			</CardContent>
		</Card>
	)
}

// Server Component para TransactionItem
function TransactionItem({ transaction, category, locale }: {
	transaction: Transaction
	category?: Category
	locale?: string
}) {
	const isIncome = transaction.type_transation === TypeTransaction.INCOME

	return (
		<div className="flex items-center justify-between p-3 rounded-lg border border-border/40 dark:border-border/20 hover:bg-accent/50 dark:hover:bg-accent/50 transition-colors">
			<div className="flex items-center gap-3">
				<div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{ backgroundColor: category?.color || '#6B7280' }}>
					{category?.icon || '💳'}
				</div>
				<div>
					<p className="font-medium text-foreground">{transaction.name}</p>
					<p className="text-sm text-muted-foreground">{transaction.description}</p>
					<p className="text-xs text-muted-foreground">
						{new Date(transaction.created_at).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US')}
					</p>
				</div>
			</div>
			<div className="text-right">
				<p className={`font-bold ${isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
					{isIncome ? '+' : ''}${Math.abs(transaction.amount).toLocaleString()}
				</p>
				<p className="text-xs text-muted-foreground">{category?.name}</p>
			</div>
		</div>
	)
}

// Server Component para CategoryCard
function CategoryCard({ category, transactions, t }: {
	category: Category
	transactions: Transaction[]
	t: any
}) {
	const categoryTransactions = Array.isArray(transactions) ? transactions.filter(t => t.category_id === category.id) : [];
	const totalAmount = categoryTransactions.reduce((sum, t) => sum + t.amount, 0)

	return (
		<div className="flex items-center justify-between p-3 rounded-lg border border-border/40 dark:border-border/20 hover:bg-accent/50 dark:hover:bg-accent/50 transition-colors">
			<div className="flex items-center gap-3">
				<div
					className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
					style={{ backgroundColor: category.color }}
				>
					{category.icon}
				</div>
				<div>
					<p className="font-medium text-foreground">{category.name}</p>
					<p className="text-xs text-muted-foreground">{categoryTransactions.length} {t('transactionsCount')}</p>
				</div>
			</div>
			<div className="text-right">
				<p className="font-bold text-foreground">${totalAmount.toLocaleString()}</p>
			</div>
		</div>
	)
}

// Server Component para AccountCard
function AccountCard({ account, t }: { account: Account, t: any }) {
	const currentBalance = account.current_balance ?? account.initial_balance ?? 0;
	const isPositive = currentBalance > 0

	return (
		<Card className="border-border/50 dark:border-border/20 hover:bg-accent/40 dark:hover:bg-accent/40 transition-all duration-200">
			<CardContent className="p-6">
				<div className="flex items-center justify-between mb-4">
					<div>
						<h3 className="font-semibold text-foreground">{account.name}</h3>
						<p className="text-sm text-muted-foreground">{account.bank}</p>
					</div>
					<CreditCard className="h-5 w-5 text-muted-foreground" />
				</div>
				<div className="space-y-2">
					<p className={`text-2xl font-bold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
						${currentBalance.toLocaleString()}
					</p>
					<div className="flex gap-2">
						<Badge variant="outline" className="text-xs">
							{currentBalance > 10000 ? t('high') : currentBalance > 5000 ? t('medium') : t('low')}
						</Badge>
						{account.current_balance !== account.initial_balance && (
							<Badge variant="secondary" className="text-xs">
								{t('initial')}: ${account.initial_balance.toLocaleString()}
							</Badge>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

// Server Component para BudgetCard
function BudgetCard({ budget, category, t }: {
	budget: Budget
	category?: Category
	t: any
}) {
	// Convert negative current_amount to positive for display
	const spentAmount = Math.abs(budget.current_amount)
	const percentage = (spentAmount / budget.amount) * 100
	const isOverBudget = spentAmount > budget.amount

	return (
		<Card className="border-border/50 dark:border-border/20">
			<CardContent className="p-6">
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-3">
						<div
							className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
							style={{ backgroundColor: category?.color || '#6B7280' }}
						>
							{category?.icon || '📊'}
						</div>
						<div>
							<h3 className="font-medium text-foreground">{category?.name || t('noCategory')}</h3>
							<p className="text-sm text-muted-foreground">
								${spentAmount.toLocaleString()} {t('of')} ${budget.amount.toLocaleString()}
							</p>
						</div>
					</div>
					<Badge
						variant={isOverBudget ? 'destructive' : percentage > 80 ? 'secondary' : 'outline'}
						className="text-xs"
					>
						{percentage.toFixed(1)}%
					</Badge>
				</div>
				<div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
					<div
						className="h-full transition-all duration-500 rounded-full"
						style={{
							width: `${Math.max(Math.min(percentage, 100), percentage > 0 ? 5 : 0)}%`,
							minWidth: percentage > 0 ? '8px' : '0px',
							backgroundColor: percentage > 80 ? '#ef4444' : percentage > 60 ? '#eab308' : '#22c55e'
						}}
					/>
				</div>
			</CardContent>
		</Card>
	)
}

// Server Component para el header
function DashboardHeader({ user, t, locale }: { user: any, t: any, locale: string }) {
	return (
		<div className="mb-8">
			<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
				<div>
					<h1 className="text-4xl font-bold tracking-tight text-foreground">
						{t('title')}
					</h1>
					<p className="text-muted-foreground mt-2 text-lg">
						{t('welcome')}, {user?.name} {user?.lastName || user?.last_name} 👋
					</p>
				</div>
				<div className="flex items-center gap-3">
					<Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-400">
						<Calendar className="h-3 w-3 mr-1" />
						{new Date().toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US', {
							day: 'numeric',
							month: 'long',
							year: 'numeric'
						})}
					</Badge>
				</div>
			</div>
		</div>
	)
}

// Server Component para las estadísticas
function StatsGrid({ accounts, transactions, t }: {
	accounts: Account[]
	transactions: Transaction[]
	t: any
}) {
	const totalBalance = (accounts ?? []).reduce((sum, acc) => sum + (acc.current_balance ?? acc.initial_balance ?? 0), 0)
	const totalIncome = Array.isArray(transactions)
		? transactions.filter(t => t.type_transation === TypeTransaction.INCOME).reduce((sum, t) => sum + t.amount, 0)
		: 0;
	const totalExpenses = Array.isArray(transactions)
		? transactions.filter(t => t.type_transation === TypeTransaction.BILL).reduce((sum, t) => sum + Math.abs(t.amount), 0)
		: 0;

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
			<StatCard
				title={t('balance')}
				value={totalBalance}
				icon={DollarSign}
				color="blue"
			/>
			<StatCard
				title={t('income')}
				value={totalIncome}
				icon={TrendingUp}
				color="green"
			/>
			<StatCard
				title={t('expenses')}
				value={totalExpenses}
				icon={TrendingDown}
				color="red"
			/>
		</div>
	)
}



// Componente principal - Server Component que carga datos directamente
export default async function DashboardPage() {
	const accountRepository = await getAccountRepository()
	const transactionRepository = await getTransactionRepository()
	const categoryRepository = await getCategoryRepository()
	const budgetRepository = await getBudgetRepository()
	const analyticsRepository = await getAnalyticsRepository()

	// Get translations
	const t = await getTranslations('dashboard')
	const tNav = await getTranslations('nav')
	const tBudgets = await getTranslations('budgets')
	const tCommon = await getTranslations('common')
	const locale = await getLocale()

	// Obtener la sesión actual (sin hacer login)
	const { getServerSession } = await import("next-auth");
	const { authOptions } = await import("@/auth");
	const session = await getServerSession(authOptions);

	if (!session) {
		const { redirect } = await import("next/navigation");
		redirect('/login');
		return
	}

	const user = session.user;

	const [accounts, transactionResponse, categories, budgets, categorysData, getMonthlySummary] = await Promise.all([
		accountRepository.findAll(),
		transactionRepository.findAllSimple(),
		categoryRepository.findAll(),
		budgetRepository.findAll(),
		analyticsRepository.getCategoryExpenses(),
		analyticsRepository.getMonthlySummary()
	])

	// Extract transactions from the response
	const transactions = transactionResponse || []
	console.log(accounts, transactions, categories, budgets)

	const recentTransactions = Array.isArray(transactions) ? transactions.slice(0, 8) : []



	return (
		<div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20">
			<div className="container mx-auto px-4 py-8">
				<div id="dashboard-header">
					<DashboardHeader user={user} t={t} locale={locale} />
				</div>
				<div id="dashboard-charts">
					<DashboardCharts
						categories={categories}
						transactions={Array.isArray(transactions) ? transactions : []}
						categorysData={categorysData}
						monthSummary={getMonthlySummary}

					/>
				</div>
				<div id="stats-grid">
					<StatsGrid accounts={accounts} transactions={transactions} t={t} />
				</div>

				<AnimatedTabs
					defaultValue="overview"
					className="space-y-6"
					tabs={[
						{
							value: 'overview',
							label: t('overview'),
							icon: <BarChart3 className="h-4 w-4" />,
							content: (
								<div className="space-y-6">
									<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
										<Card id="recent-transactions" className="border-border/50 dark:border-border/20">
											<CardHeader>
												<CardTitle className="flex items-center gap-2 text-foreground">
													<Wallet className="h-5 w-5" />
													{t('recentTransactions')}
												</CardTitle>
											</CardHeader>
											<CardContent>
												<div className="space-y-1">
													{Array.isArray(recentTransactions) ? recentTransactions.slice(0, 4).map((transaction) => {
														const category = categories.find(c => c.id === transaction.category_id)
														return (
															<TransactionItem
																key={transaction.id}
																transaction={transaction}
																category={category}
																locale={locale}
															/>
														)
													}) : []}
												</div>
											</CardContent>
										</Card>

										<Card className="border-border/50 dark:border-border/20">
											<CardHeader>
												<CardTitle className="flex items-center gap-2 text-foreground">
													<PieChart className="h-5 w-5" />
													{t('categories')}
												</CardTitle>
											</CardHeader>
											<CardContent>
												<div className="space-y-4">
													{Array.isArray(categories) ? categories.slice(0, 4).map((category) => (
														<CategoryCard
															key={category.id}
															category={category}
															transactions={transactions}
															t={t}
														/>
													)) : []}
												</div>
											</CardContent>
										</Card>

										<Card className="border-border/50 dark:border-border/20">
											<CardHeader>
												<CardTitle className="flex items-center gap-2 text-foreground">
													<Target className="h-5 w-5" />
													{t('budgetSummary')}
												</CardTitle>
											</CardHeader>
											<CardContent>
												<div className="space-y-4">
													{Array.isArray(budgets) && budgets.length > 0 ? (
														<>
															{budgets.slice(0, 3).map((budget) => {
																const category = Array.isArray(categories) ? categories.find(c => c.id === budget.category_id) : undefined;
																const spentAmount = Math.abs(budget.current_amount);
																const percentage = (spentAmount / budget.amount) * 100;

																return (
																	<div key={budget.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40 dark:border-border/20 hover:bg-accent/50 dark:hover:bg-accent/50 transition-colors">
																		<div className="flex items-center gap-3">
																			<div
																				className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
																				style={{ backgroundColor: category?.color || '#6B7280' }}
																			>
																				{category?.icon || '📊'}
																			</div>
																			<div>
																				<p className="font-medium text-foreground">{category?.name || 'Sin categoría'}</p>
																				<p className="text-xs text-muted-foreground">
																					${spentAmount.toLocaleString()} / ${budget.amount.toLocaleString()}
																				</p>
																			</div>
																		</div>
																		<div className="text-right">
																			<p className={`text-sm font-bold ${percentage > 80 ? 'text-red-600 dark:text-red-400' :
																				percentage > 60 ? 'text-yellow-600 dark:text-yellow-400' :
																					'text-green-600 dark:text-green-400'
																				}`}>
																				{percentage.toFixed(1)}%
																			</p>
																		</div>
																	</div>
																);
															})}
															{budgets.length > 3 && (
																<div className="text-center pt-2">
																	<p className="text-xs text-muted-foreground">
																		+{budgets.length - 3} {t('moreBudgets')}
																	</p>
																</div>
															)}
														</>
													) : (
														<div className="text-center py-4 text-muted-foreground">
															<p className="text-sm">{t('noBudgetsConfigured')}</p>
														</div>
													)}
												</div>
											</CardContent>
										</Card>
									</div>
								</div>
							)
						},
						{
							value: 'accounts',
							label: t('accounts'),
							icon: <CreditCard className="h-4 w-4" />,
							content: (
								<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
									{Array.isArray(accounts) && accounts.map((account) => (
										<AccountCard key={account.id} account={account} t={t} />
									))}
								</div>
							)
						},
						{
							value: 'transactions',
							label: t('transactionsTab'),
							icon: <Wallet className="h-4 w-4" />,
							content: (
								<div className="space-y-4">
									{Array.isArray(transactions) ? transactions.map((transaction) => {
										const category = categories.find(c => c.id === transaction.category_id)
										return (
											<TransactionItem
												key={transaction.id}
												transaction={transaction}
												category={category}
												locale={locale}
											/>
										)
									}) : []}
								</div>
							)
						},
						{
							value: 'budgets',
							label: t('budgets'),
							icon: <PieChart className="h-4 w-4" />,
							content: (
								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
									{budgets && budgets.length > 0 ? budgets.map((budget) => {
										const category = Array.isArray(categories) ? categories.find(c => c.id === budget.category_id) : undefined;
										return (
											<BudgetCard
												key={budget.id}
												budget={budget}
												category={category}
												t={t}
											/>
										)
									}) : (
										<div className="col-span-full text-center py-12 text-muted-foreground">
											<Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
											<h3 className="text-lg font-semibold mb-2">{t('noBudgetsConfigured')}</h3>
											<p className="text-sm">{t('createBudgetHint')}</p>
										</div>
									)}
								</div>
							)
						}
					]}
				/>
			</div>
		</div>
	)
} 
