'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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

interface StatCardProps {
	title: string
	value: string
	icon: LucideIcon
	trend?: 'up' | 'down'
	trendValue?: string
	color?: 'blue' | 'green' | 'red' | 'purple' | 'orange'
}

interface TransactionItemProps {
	transaction: Transaction
	category?: Category
}

interface AccountCardProps {
	account: Account
}

interface BudgetCardProps {
	budget: Budget
	categories: Category[]
}

interface CategoryCardProps {
	category: Category
	transactions: Transaction[]
}

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

function StatCard({ title, value, icon: Icon, trend, trendValue, color = 'blue' }: StatCardProps) {
	const colorClasses: Record<string, { gradient: string; bg: string; text: string }> = {
		blue: { 
			gradient: 'from-blue-500/20 via-cyan-500/20 to-blue-600/20 dark:from-blue-500/10 dark:via-cyan-500/10 dark:to-blue-600/10', 
			bg: 'bg-gradient-to-br from-blue-500 to-cyan-500 dark:from-blue-600 dark:to-cyan-600',
			text: 'text-blue-600 dark:text-blue-400'
		},
		green: { 
			gradient: 'from-green-500/20 via-emerald-500/20 to-green-600/20 dark:from-green-500/10 dark:via-emerald-500/10 dark:to-green-600/10', 
			bg: 'bg-gradient-to-br from-green-500 to-emerald-500 dark:from-green-600 dark:to-emerald-600',
			text: 'text-green-600 dark:text-green-400'
		},
		red: { 
			gradient: 'from-red-500/20 via-rose-500/20 to-red-600/20 dark:from-red-500/10 dark:via-rose-500/10 dark:to-red-600/10', 
			bg: 'bg-gradient-to-br from-red-500 to-rose-500 dark:from-red-600 dark:to-rose-600',
			text: 'text-red-600 dark:text-red-400'
		},
		purple: { 
			gradient: 'from-purple-500/20 via-violet-500/20 to-purple-600/20 dark:from-purple-500/10 dark:via-violet-500/10 dark:to-purple-600/10', 
			bg: 'bg-gradient-to-br from-purple-500 to-violet-500 dark:from-purple-600 dark:to-violet-600',
			text: 'text-purple-600 dark:text-purple-400'
		},
		orange: { 
			gradient: 'from-orange-500/20 via-amber-500/20 to-orange-600/20 dark:from-orange-500/10 dark:via-amber-500/10 dark:to-orange-600/10', 
			bg: 'bg-gradient-to-br from-orange-500 to-amber-500 dark:from-orange-600 dark:to-amber-600',
			text: 'text-orange-600 dark:text-orange-400'
		}
	}

	return (
		<Card className="relative overflow-hidden group hover:shadow-lg hover:shadow-primary/5 dark:hover:shadow-primary/10 transition-all duration-300 border-border/50 dark:border-border/20">
			<div className={`absolute inset-0 bg-gradient-to-br ${colorClasses[color].gradient}`}></div>
			<CardContent className="p-6 relative">
				<div className="flex items-center justify-between">
					<div className="space-y-2">
						<p className="text-sm font-medium text-muted-foreground">{title}</p>
						<p className="text-3xl font-bold text-foreground">{value}</p>
						{trend && (
							<div className="flex items-center space-x-1">
								{trend === 'up' ? (
									<TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
								) : (
									<TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
								)}
								<span className={`text-sm font-medium ${trend === 'up' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
									{trendValue}
								</span>
							</div>
						)}
					</div>
					<div className={`p-3 rounded-full ${colorClasses[color].bg} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
						<Icon className="h-6 w-6 text-white" />
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

function TransactionItem({ transaction, category }: TransactionItemProps) {
	const isIncome = transaction.type_transaction === TypeTransaction.INCOME
	
	return (
		<div className="flex items-center justify-between p-4 rounded-lg hover:bg-muted/50 dark:hover:bg-muted/30 transition-colors duration-200">
			<div className="flex items-center space-x-4">
				<div className={`p-2 rounded-full ${isIncome ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
					{isIncome ? (
						<ArrowUpRight className="h-4 w-4 text-green-600 dark:text-green-400" />
					) : (
						<ArrowDownRight className="h-4 w-4 text-red-600 dark:text-red-400" />
					)}
				</div>
				<div>
					<p className="font-medium text-foreground">{transaction.description}</p>
					<p className="text-sm text-muted-foreground">
						{new Date(transaction.created_at).toLocaleDateString('es-ES', {
							day: 'numeric',
							month: 'short',
							hour: '2-digit',
							minute: '2-digit'
						})}
					</p>
				</div>
			</div>
			<div className="text-right">
				<p className={`font-semibold ${isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
					{isIncome ? '+' : '-'}${transaction.amount.toLocaleString()}
				</p>
				{category && (
					<Badge variant="outline" className="mt-1 text-xs border-muted-foreground/30 bg-muted/30 dark:bg-muted/20">
						{category.icon} {category.name}
					</Badge>
				)}
			</div>
		</div>
	)
}

function AccountCard({ account }: AccountCardProps) {
	return (
		<Card className="hover:shadow-md hover:shadow-primary/5 dark:hover:shadow-primary/10 transition-all duration-300 border-border/50 dark:border-border/20">
			<CardContent className="p-6">
				<div className="flex items-center justify-between">
					<div className="flex items-center space-x-4">
						<Avatar className="h-12 w-12 border-2 border-primary/20">
							<AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-primary-foreground font-semibold">
								{account.name_account.charAt(0).toUpperCase()}
							</AvatarFallback>
						</Avatar>
						<div>
							<p className="font-semibold text-foreground">{account.name_account}</p>
							<p className="text-sm text-muted-foreground">{account.bank}</p>
						</div>
					</div>
					<div className="text-right">
						<p className="text-2xl font-bold text-foreground">${account.balance.toLocaleString()}</p>
						<p className="text-sm text-muted-foreground">USD</p>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

function BudgetCard({ budget, categories }: BudgetCardProps) {
	const percentage = Math.min((budget.current_amount / budget.amount) * 100, 100)
	const category = categories.find((c: Category) => c.id === budget.category_id)
	const isOverBudget = budget.current_amount > budget.amount
	
	return (
		<Card className="hover:shadow-md hover:shadow-primary/5 dark:hover:shadow-primary/10 transition-all duration-300 border-border/50 dark:border-border/20">
			<CardContent className="p-6">
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center space-x-3">
						<div className="text-2xl p-2 rounded-full bg-muted/50 dark:bg-muted/30">
							{category?.icon || '💰'}
						</div>
						<div>
							<p className="font-semibold text-foreground">
								{category?.name || `Presupuesto ${budget.id}`}
							</p>
							<p className="text-sm text-muted-foreground">Mensual</p>
						</div>
					</div>
					<Target className="h-5 w-5 text-muted-foreground" />
				</div>
				
				<div className="space-y-3">
					<div className="flex justify-between text-sm">
						<span className="text-muted-foreground">Gastado</span>
						<span className="font-medium text-foreground">${budget.current_amount.toLocaleString()}</span>
					</div>
					<div className="flex justify-between text-sm">
						<span className="text-muted-foreground">Límite</span>
						<span className="font-medium text-foreground">${budget.amount.toLocaleString()}</span>
					</div>
					
					<div className="space-y-2">
						<Progress 
							value={percentage} 
							className={`h-2 ${isOverBudget ? 'bg-red-100 dark:bg-red-900/30' : 'bg-muted'}`}
						/>
						<div className="flex justify-between items-center">
							<span className="text-xs text-muted-foreground">
								{percentage.toFixed(1)}% utilizado
							</span>
							{isOverBudget && (
								<Badge variant="destructive" className="text-xs">
									Excedido
								</Badge>
							)}
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

function CategoryCard({ category, transactions }: CategoryCardProps) {
	const categoryTransactions = transactions.filter((t: Transaction) => t.category_id === category.id)
	const totalAmount = categoryTransactions.reduce((sum: number, t: Transaction) => sum + t.amount, 0)
	
	return (
		<Card className="hover:shadow-md hover:shadow-primary/5 dark:hover:shadow-primary/10 transition-all duration-300 border-border/50 dark:border-border/20">
			<CardContent className="p-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center space-x-3">
						<div 
							className="w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-sm border-2 border-primary/20"
							style={{ backgroundColor: category.color + '20' }}
						>
							{category.icon}
						</div>
						<div>
							<p className="font-medium text-foreground">{category.name}</p>
							<p className="text-sm text-muted-foreground">
								{categoryTransactions.length} transacciones
							</p>
						</div>
					</div>
					<div className="text-right">
						<p className="font-semibold text-foreground">${totalAmount.toLocaleString()}</p>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

export default function AppPage() {
	const [user, setUser] = useState<User | null>(null)
	const [accounts, setAccounts] = useState<Account[]>([])
	const [transactions, setTransactions] = useState<Transaction[]>([])
	const [categories, setCategories] = useState<Category[]>([])
	const [budgets, setBudgets] = useState<Budget[]>([])
	const [isLoading, setIsLoading] = useState(true)

	useEffect(() => {
		const loadAllData = async () => {
			try {
				console.log('🔄 Cargando todos los datos mock...')
				
				// Cargar todos los repositorios
				console.log('📦 Obteniendo repositorios...')
				const authRepository = await getAuthRepository()
				const accountRepository = await getAccountRepository()
				const transactionRepository = await getTransactionRepository()
				const categoryRepository = await getCategoryRepository()
				const budgetRepository = await getBudgetRepository()
				
				console.log('📊 Cargando datos...')
				// Cargar datos en paralelo
				const [userData, accountsData, transactionsData, categoriesData, budgetsData] = await Promise.all([
					authRepository.login('juan.perez@example.com', 'password123'),
					accountRepository.findAll(),
					transactionRepository.findAll(),
					categoryRepository.findAll(),
					budgetRepository.findAll()
				])
				
				console.log('✅ Estableciendo estados...')
				setUser(userData)
				setAccounts(accountsData)
				setTransactions(transactionsData)
				setCategories(categoriesData)
				setBudgets(budgetsData)
				
				console.log('✅ Todos los datos cargados exitosamente')
			} catch (error) {
				console.error('❌ Error cargando datos:', error)
			} finally {
				console.log('🔄 Terminando carga...')
				setIsLoading(false)
			}
		}

		// Add a timeout to prevent infinite loading
		const timeoutId = setTimeout(() => {
			console.log('⏰ Timeout alcanzado, forzando fin de carga')
			setIsLoading(false)
		}, 10000) // 10 seconds timeout

		loadAllData().finally(() => {
			clearTimeout(timeoutId)
		})

		return () => clearTimeout(timeoutId)
	}, [])

	if (isLoading) {
		return <LoadingSpinner />
	}

	// Calcular estadísticas
	const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0)
	const totalIncome = transactions.filter(t => t.type_transaction === TypeTransaction.INCOME).reduce((sum, t) => sum + t.amount, 0)
	const totalExpenses = transactions.filter(t => t.type_transaction === TypeTransaction.BILL).reduce((sum, t) => sum + t.amount, 0)
	const recentTransactions = transactions.slice(0, 8)
	const netIncome = totalIncome - totalExpenses

	return (
		<div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20">
			<div className="container mx-auto px-4 py-8">
				{/* Header */}
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

				{/* Estadísticas principales */}
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

				{/* Contenido principal con tabs */}
				<Tabs defaultValue="overview" className="space-y-6">
					<TabsList className="grid w-full grid-cols-4 lg:w-auto lg:grid-cols-4 bg-muted/50 dark:bg-muted/30">
						<TabsTrigger value="overview" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
							<BarChart3 className="h-4 w-4" />
							<span className="hidden sm:inline">Resumen</span>
						</TabsTrigger>
						<TabsTrigger value="accounts" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
							<CreditCard className="h-4 w-4" />
							<span className="hidden sm:inline">Cuentas</span>
						</TabsTrigger>
						<TabsTrigger value="transactions" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
							<Wallet className="h-4 w-4" />
							<span className="hidden sm:inline">Transacciones</span>
						</TabsTrigger>
						<TabsTrigger value="budgets" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
							<PieChart className="h-4 w-4" />
							<span className="hidden sm:inline">Presupuestos</span>
						</TabsTrigger>
					</TabsList>

					{/* Tab: Resumen */}
					<TabsContent value="overview" className="space-y-6">
						<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
							{/* Transacciones recientes */}
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

							{/* Categorías principales */}
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
					</TabsContent>

					{/* Tab: Cuentas */}
					<TabsContent value="accounts" className="space-y-6">
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
							{accounts.map((account) => (
								<AccountCard key={account.id} account={account} />
							))}
						</div>
					</TabsContent>

					{/* Tab: Transacciones */}
					<TabsContent value="transactions" className="space-y-6">
						<Card className="border-border/50 dark:border-border/20">
							<CardHeader>
								<CardTitle className="flex items-center gap-2 text-foreground">
									<Wallet className="h-5 w-5" />
									Todas las Transacciones
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-1">
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
							</CardContent>
						</Card>
					</TabsContent>

					{/* Tab: Presupuestos */}
					<TabsContent value="budgets" className="space-y-6">
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
							{budgets.map((budget) => (
								<BudgetCard 
									key={budget.id} 
									budget={budget} 
									categories={categories}
								/>
							))}
						</div>
					</TabsContent>
				</Tabs>

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
										✅ Middleware desactivado
									</Badge>
									<Badge variant="outline" className="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-400">
										✅ Mocks funcionando
									</Badge>
									<Badge variant="outline" className="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-400">
										✅ Datos cargados
									</Badge>
								</div>
							</div>
							<div>
								<p className="font-semibold text-blue-800 dark:text-blue-200 mb-3">Datos Disponibles:</p>
								<div className="space-y-2">
									<div className="flex items-center gap-2">
										<Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-400">
											👤 {user ? 'Usuario autenticado' : 'Sin usuario'}
										</Badge>
									</div>
									<div className="flex items-center gap-2">
										<Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-400">
											🏦 {accounts.length} cuentas
										</Badge>
									</div>
									<div className="flex items-center gap-2">
										<Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-400">
											💳 {transactions.length} transacciones
										</Badge>
									</div>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
