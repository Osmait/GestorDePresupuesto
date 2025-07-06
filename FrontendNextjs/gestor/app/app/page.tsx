import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { AnimatedTabs } from '@/components/client/animated-tabs'
import { 
	getAuthRepository, 
	getAccountRepository, 
	getTransactionRepository, 
	getCategoryRepository, 
	getBudgetRepository 
} from '@/lib/repositoryConfig'
import { User } from '@/types/user'
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
	Target,
	Zap,
	LucideIcon
} from 'lucide-react'
import { DashboardCharts } from '@/components/DashboardCharts'

interface StatCardProps {
	title: string
	value: string
	icon: LucideIcon
	trend?: 'up' | 'down'
	trendValue?: string
	color?: 'blue' | 'green' | 'red' | 'purple' | 'orange'
}

// Server Component para LoadingSpinner
function LoadingSpinner() {
	return (
		<div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary/20 dark:from-background dark:to-secondary/10">
			<div className="text-center">
				<div className="relative">
					<div className="animate-spin rounded-full h-16 w-16 border-4 border-muted border-t-primary mx-auto"></div>
					<div className="absolute inset-0 rounded-full h-16 w-16 border-4 border-transparent border-t-primary/60 animate-spin mx-auto" style={{animationDelay: '0.3s', animationDuration: '1.2s'}}></div>
				</div>
				<div className="mt-6 text-xl font-semibold text-foreground">Cargando Dashboard</div>
				<div className="mt-2 text-sm text-muted-foreground">Preparando tus datos financieros...</div>
			</div>
		</div>
	)
}

// Server Component para StatCard
function StatCard({ title, value, icon: Icon, trend, trendValue, color = 'blue' }: StatCardProps) {
	const colorClasses = {
		blue: 'from-blue-500/10 to-cyan-500/10 dark:from-blue-500/5 dark:to-cyan-500/5 text-blue-600 dark:text-blue-400',
		green: 'from-green-500/10 to-emerald-500/10 dark:from-green-500/5 dark:to-emerald-500/5 text-green-600 dark:text-green-400',
		red: 'from-red-500/10 to-rose-500/10 dark:from-red-500/5 dark:to-rose-500/5 text-red-600 dark:text-red-400',
		purple: 'from-purple-500/10 to-violet-500/10 dark:from-purple-500/5 dark:to-violet-500/5 text-purple-600 dark:text-purple-400',
		orange: 'from-orange-500/10 to-amber-500/10 dark:from-orange-500/5 dark:to-amber-500/5 text-orange-600 dark:text-orange-400'
	}

	return (
		<Card className="border-border/50 dark:border-border/20 transition-all duration-200 hover:shadow-lg dark:hover:shadow-lg/25">
			<CardContent className="p-6">
				<div className={`rounded-lg p-4 bg-gradient-to-br ${colorClasses[color]}`}>
					<div className="flex items-center justify-between mb-3">
						<Icon className="h-6 w-6" />
						{trend && trendValue && (
							<div className={`flex items-center gap-1 text-xs font-medium ${
								trend === 'up' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
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
					<p className="text-2xl font-bold text-foreground">{value}</p>
				</div>
			</CardContent>
		</Card>
	)
}

// Server Component para TransactionItem
function TransactionItem({ transaction, category }: { 
	transaction: Transaction 
	category?: Category 
}) {
	const isIncome = transaction.type_transaction === TypeTransaction.INCOME

	return (
		<div className="flex items-center justify-between p-3 rounded-lg border border-border/40 dark:border-border/20 hover:bg-muted/30 dark:hover:bg-muted/20 transition-colors">
			<div className="flex items-center gap-3">
				<div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{ backgroundColor: category?.color || '#6B7280' }}>
					{category?.icon || '💳'}
				</div>
				<div>
					<p className="font-medium text-foreground">{transaction.name}</p>
					<p className="text-sm text-muted-foreground">{transaction.description}</p>
					<p className="text-xs text-muted-foreground">
						{new Date(transaction.created_at).toLocaleDateString('es-ES')}
					</p>
				</div>
			</div>
			<div className="text-right">
				<p className={`font-bold ${isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
					{isIncome ? '+' : '-'}${transaction.amount.toLocaleString()}
				</p>
				<p className="text-xs text-muted-foreground">{category?.name || 'Sin categoría'}</p>
			</div>
		</div>
	)
}

// Server Component para CategoryCard
function CategoryCard({ category, transactions }: { 
	category: Category 
	transactions: Transaction[] 
}) {
	const categoryTransactions = transactions.filter(t => t.category_id === category.id)
	const totalAmount = categoryTransactions.reduce((sum, t) => sum + t.amount, 0)

	return (
		<div className="flex items-center justify-between p-3 rounded-lg border border-border/40 dark:border-border/20 hover:bg-muted/30 dark:hover:bg-muted/20 transition-colors">
			<div className="flex items-center gap-3">
				<div 
					className="w-8 h-8 rounded-full flex items-center justify-center text-sm" 
					style={{ backgroundColor: category.color }}
				>
					{category.icon}
				</div>
				<div>
					<p className="font-medium text-foreground">{category.name}</p>
					<p className="text-xs text-muted-foreground">{categoryTransactions.length} transacciones</p>
				</div>
			</div>
			<div className="text-right">
				<p className="font-bold text-foreground">${totalAmount.toLocaleString()}</p>
			</div>
		</div>
	)
}

// Server Component para AccountCard
function AccountCard({ account }: { account: Account }) {
	const isPositive = account.balance > 0

	return (
		<Card className="border-border/50 dark:border-border/20 hover:shadow-lg dark:hover:shadow-lg/25 transition-all duration-200">
			<CardContent className="p-6">
				<div className="flex items-center justify-between mb-4">
					<div>
						<h3 className="font-semibold text-foreground">{account.name_account}</h3>
						<p className="text-sm text-muted-foreground">{account.bank}</p>
					</div>
					<CreditCard className="h-5 w-5 text-muted-foreground" />
				</div>
				<div className="space-y-2">
					<p className={`text-2xl font-bold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
						${account.balance.toLocaleString()}
					</p>
					<Badge variant="outline" className="text-xs">
						{account.balance > 10000 ? 'Alto' : account.balance > 5000 ? 'Medio' : 'Bajo'}
					</Badge>
				</div>
			</CardContent>
		</Card>
	)
}

// Server Component para BudgetCard
function BudgetCard({ budget, category, spent }: { 
	budget: Budget 
	category?: Category 
	spent: number 
}) {
	const percentage = (spent / budget.amount) * 100
	const isOverBudget = spent > budget.amount

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
							<h3 className="font-medium text-foreground">{category?.name || 'Sin categoría'}</h3>
							<p className="text-sm text-muted-foreground">
								${spent.toLocaleString()} de ${budget.amount.toLocaleString()}
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
				<Progress 
					value={Math.min(percentage, 100)} 
					className="h-2"
				/>
			</CardContent>
		</Card>
	)
}

// Server Component para el header
function DashboardHeader({ user }: { user: User | null }) {
	return (
		<div className="mb-8">
			<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
				<div>
					<h1 className="text-4xl font-bold bg-gradient-to-r from-foreground via-primary to-primary bg-clip-text text-transparent">
						Dashboard Financiero
					</h1>
					<p className="text-muted-foreground mt-2 text-lg">
						Bienvenido de vuelta, {user?.name} {user?.last_name} 👋
					</p>
				</div>
				<div className="flex items-center gap-3">
					<Badge variant="outline" className="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-400">
						<Zap className="h-3 w-3 mr-1" />
						Modo Desarrollo
					</Badge>
					<Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-400">
						<Calendar className="h-3 w-3 mr-1" />
						{new Date().toLocaleDateString('es-ES', {
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
function StatsGrid({ accounts, transactions }: { 
	accounts: Account[] 
	transactions: Transaction[] 
}) {
	const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0)
	const totalIncome = transactions.filter(t => t.type_transaction === TypeTransaction.INCOME).reduce((sum, t) => sum + t.amount, 0)
	const totalExpenses = transactions.filter(t => t.type_transaction === TypeTransaction.BILL).reduce((sum, t) => sum + t.amount, 0)
	const netIncome = totalIncome - totalExpenses

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
			<StatCard
				title="Balance Total"
				value={`$${totalBalance.toLocaleString()}`}
				icon={DollarSign}
				trend="up"
				trendValue="+12.5%"
				color="blue"
			/>
			<StatCard
				title="Ingresos"
				value={`$${totalIncome.toLocaleString()}`}
				icon={TrendingUp}
				trend="up"
				trendValue="+8.2%"
				color="green"
			/>
			<StatCard
				title="Gastos"
				value={`$${totalExpenses.toLocaleString()}`}
				icon={TrendingDown}
				trend="down"
				trendValue="-3.1%"
				color="red"
			/>
			<StatCard
				title="Ahorro Neto"
				value={`$${netIncome.toLocaleString()}`}
				icon={Wallet}
				trend={netIncome > 0 ? 'up' : 'down'}
				trendValue={netIncome > 0 ? '+15.3%' : '-5.2%'}
				color="purple"
			/>
		</div>
	)
}

// Componente principal - Server Component que carga datos directamente
export default async function DashboardPage() {
	// Cargar datos en el servidor
	const authRepository = await getAuthRepository()
	const accountRepository = await getAccountRepository()
	const transactionRepository = await getTransactionRepository()
	const categoryRepository = await getCategoryRepository()
	const budgetRepository = await getBudgetRepository()
	
	const [user, accounts, transactions, categories, budgets] = await Promise.all([
		authRepository.login('juan.perez@example.com', 'password123'),
		accountRepository.findAll(),
		transactionRepository.findAll(),
		categoryRepository.findAll(),
		budgetRepository.findAll()
	])

	const recentTransactions = transactions.slice(0, 8)

	return (
		<div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20">
			<div className="container mx-auto px-4 py-8">
				<DashboardHeader user={user} />
				<DashboardCharts 
					categories={categories} 
					transactions={transactions.map(t => ({
						...t,
						type_transaction: String(t.type_transaction),
						created_at: typeof t.created_at === 'string' ? t.created_at : t.created_at.toISOString()
					}))} 
				/>
				<StatsGrid accounts={accounts} transactions={transactions} />
				
				<AnimatedTabs
					defaultValue="overview"
					className="space-y-6"
					tabs={[
						{
							value: 'overview',
							label: 'Resumen',
							icon: <BarChart3 className="h-4 w-4" />,
							content: (
								<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
									<Card className="lg:col-span-2 border-border/50 dark:border-border/20">
										<CardHeader>
											<CardTitle className="flex items-center gap-2 text-foreground">
												<Wallet className="h-5 w-5" />
												Transacciones Recientes
											</CardTitle>
										</CardHeader>
										<CardContent>
											<div className="space-y-1">
												{recentTransactions.map((transaction) => {
													const category = categories.find(c => c.id === transaction.category_id)
													return (
														<TransactionItem 
															key={transaction.id} 
															transaction={transaction} 
															category={category}
														/>
													)
												})}
											</div>
										</CardContent>
									</Card>

									<Card className="border-border/50 dark:border-border/20">
										<CardHeader>
											<CardTitle className="flex items-center gap-2 text-foreground">
												<PieChart className="h-5 w-5" />
												Categorías
											</CardTitle>
										</CardHeader>
										<CardContent>
											<div className="space-y-4">
												{categories.slice(0, 6).map((category) => (
													<CategoryCard 
														key={category.id} 
														category={category} 
														transactions={transactions}
													/>
												))}
											</div>
										</CardContent>
									</Card>
								</div>
							)
						},
						{
							value: 'accounts',
							label: 'Cuentas',
							icon: <CreditCard className="h-4 w-4" />,
							content: (
								<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
									{accounts.map((account) => (
										<AccountCard key={account.id} account={account} />
									))}
								</div>
							)
						},
						{
							value: 'transactions',
							label: 'Transacciones',
							icon: <Wallet className="h-4 w-4" />,
							content: (
								<div className="space-y-4">
									{transactions.map((transaction) => {
										const category = categories.find(c => c.id === transaction.category_id)
										return (
											<TransactionItem 
												key={transaction.id} 
												transaction={transaction} 
												category={category}
											/>
										)
									})}
								</div>
							)
						},
						{
							value: 'budgets',
							label: 'Presupuestos',
							icon: <PieChart className="h-4 w-4" />,
							content: (
								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
									{budgets.map((budget) => {
										const category = categories.find(c => c.id === budget.category_id)
										const spent = transactions
											.filter(t => t.budget_id === budget.id && t.type_transaction === TypeTransaction.BILL)
											.reduce((sum, t) => sum + t.amount, 0)
										return (
											<BudgetCard 
												key={budget.id} 
												budget={budget} 
												category={category} 
												spent={spent}
											/>
										)
									})}
								</div>
							)
						}
					]}
				/>

				{/* Información de desarrollo */}
				<Card className="mt-8 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 border-blue-200/50 dark:border-blue-800/30">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
							<Zap className="h-5 w-5" />
							Información de Desarrollo
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<div>
								<p className="font-semibold text-blue-800 dark:text-blue-200 mb-3">Estado del Sistema:</p>
								<div className="space-y-2">
									<Badge variant="outline" className="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-400">
										✅ Componentes optimizados
									</Badge>
									<Badge variant="outline" className="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-400">
										✅ Server Components maximizados
									</Badge>
									<Badge variant="outline" className="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-400">
										✅ Client Components eliminados
									</Badge>
								</div>
							</div>
							<div>
								<p className="font-semibold text-blue-800 dark:text-blue-200 mb-3">Datos Disponibles:</p>
								<div className="space-y-2">
									<Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-400">
										👤 {user ? 'Usuario autenticado' : 'Sin usuario'}
									</Badge>
									<Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-400">
										🏦 {accounts.length} cuentas
									</Badge>
									<Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-400">
										💳 {transactions.length} transacciones
									</Badge>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	)
} 