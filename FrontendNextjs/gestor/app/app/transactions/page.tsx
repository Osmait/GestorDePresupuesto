'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AnimatedTabs } from '@/components/client/animated-tabs'
import { Button } from '@/components/ui/button'
import { getTransactionRepository, getCategoryRepository } from '@/lib/repositoryConfig'
import { Transaction, TypeTransaction } from '@/types/transaction'
import { Category } from '@/types/category'
import { 
	Wallet, 
	ArrowUpRight, 
	ArrowDownRight, 
	PlusCircle, 
	Filter,
	Calendar,
	DollarSign,
	TrendingUp,
	TrendingDown
} from 'lucide-react'
import { useAccounts, useCategories, useTransactions } from '@/hooks/useRepositories'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from '@/components/ui/drawer'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { CalendarDateRangePicker } from '@/components/date-range-picker'
import { useState, useEffect } from 'react'
import { DateRange } from 'react-day-picker'

interface TransactionItemProps {
	transaction: Transaction
	category?: Category
}

// Server Component para LoadingSpinner (no se usa en Server Components)
function LoadingSpinner() {
	return (
		<div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary/20 dark:from-background dark:to-secondary/10">
			<div className="text-center">
				<div className="relative">
					<div className="animate-spin rounded-full h-16 w-16 border-4 border-muted border-t-primary mx-auto"></div>
					<div className="absolute inset-0 rounded-full h-16 w-16 border-4 border-transparent border-t-primary/60 animate-spin mx-auto" style={{animationDelay: '0.3s', animationDuration: '1.2s'}}></div>
				</div>
				<div className="mt-6 text-xl font-semibold text-foreground">Cargando Transacciones</div>
				<div className="mt-2 text-sm text-muted-foreground">Preparando tu historial financiero...</div>
			</div>
		</div>
	)
}

// Server Component para TransactionItem
function TransactionItem({ transaction, category }: TransactionItemProps) {
	const isIncome = transaction.type_transaction === TypeTransaction.INCOME
	
	return (
		<Card className="hover:shadow-md hover:shadow-primary/5 dark:hover:shadow-primary/10 transition-all duration-300 border-border/50 dark:border-border/20">
			<CardContent className="p-6">
				<div className="flex items-center justify-between">
					<div className="flex items-center space-x-4">
						<div className={`p-3 rounded-full ${isIncome ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
							{isIncome ? (
								<ArrowUpRight className="h-5 w-5 text-green-600 dark:text-green-400" />
							) : (
								<ArrowDownRight className="h-5 w-5 text-red-600 dark:text-red-400" />
							)}
						</div>
						<div className="flex-1">
							<div className="flex items-center gap-2 mb-1">
								<p className="font-semibold text-foreground">{transaction.description}</p>
								{category && (
									<Badge variant="outline" className="text-xs border-muted-foreground/30 bg-muted/30 dark:bg-muted/20">
										{category.icon} {category.name}
									</Badge>
								)}
							</div>
							<p className="text-sm text-muted-foreground flex items-center gap-1">
								<Calendar className="h-3 w-3" />
								{new Date(transaction.created_at).toLocaleDateString('es-ES', {
									day: 'numeric',
									month: 'long',
									year: 'numeric',
									hour: '2-digit',
									minute: '2-digit'
								})}
							</p>
						</div>
					</div>
					<div className="text-right">
						<p className={`font-bold text-xl ${isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
							{isIncome ? '+' : '-'}${transaction.amount.toLocaleString()}
						</p>
						<p className="text-xs text-muted-foreground">USD</p>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

// Server Component para TransactionSummaryCard
function TransactionSummaryCard({ transactions }: { transactions: Transaction[] }) {
	const totalIncome = transactions.filter(t => t.type_transaction === TypeTransaction.INCOME).reduce((sum, t) => sum + t.amount, 0)
	const totalExpenses = transactions.filter(t => t.type_transaction === TypeTransaction.BILL).reduce((sum, t) => sum + t.amount, 0)
	const netAmount = totalIncome - totalExpenses
	
	return (
		<Card className="border-border/50 dark:border-border/20">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-foreground">
					<Wallet className="h-5 w-5" />
					Resumen de Transacciones
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div className="text-center p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-500/10 dark:from-green-500/5 dark:to-emerald-500/5">
						<TrendingUp className="h-6 w-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
						<p className="text-sm font-medium text-muted-foreground">Total Ingresos</p>
						<p className="text-2xl font-bold text-green-600 dark:text-green-400">${totalIncome.toLocaleString()}</p>
					</div>
					<div className="text-center p-4 rounded-lg bg-gradient-to-br from-red-500/10 to-rose-500/10 dark:from-red-500/5 dark:to-rose-500/5">
						<TrendingDown className="h-6 w-6 mx-auto mb-2 text-red-600 dark:text-red-400" />
						<p className="text-sm font-medium text-muted-foreground">Total Gastos</p>
						<p className="text-2xl font-bold text-red-600 dark:text-red-400">${totalExpenses.toLocaleString()}</p>
					</div>
					<div className="text-center p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 dark:from-blue-500/5 dark:to-cyan-500/5">
						<DollarSign className="h-6 w-6 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
						<p className="text-sm font-medium text-muted-foreground">Balance Neto</p>
						<p className={`text-2xl font-bold ${netAmount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
							${netAmount.toLocaleString()}
						</p>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

// Componente principal - Server Component que carga datos directamente
export default function TransactionsPage() {
	const { transactions, isLoading: isLoadingTx } = useTransactions()
	const { categories, isLoading: isLoadingCat } = useCategories()
	const { accounts, isLoading: isLoadingAcc } = useAccounts()

	const incomeTransactions = transactions.filter(t => t.type_transaction === TypeTransaction.INCOME)
	const expenseTransactions = transactions.filter(t => t.type_transaction === TypeTransaction.BILL)

	const [drawerOpen, setDrawerOpen] = useState(false)
	const [filters, setFilters] = useState({
		dateRange: { from: undefined, to: undefined } as DateRange,
		type: 'all',
		account: 'all',
		category: 'all',
		minAmount: '',
		maxAmount: '',
		search: '',
	})
	const [filtered, setFiltered] = useState<Transaction[] | null>(null)

	function applyFilters() {
		let txs = transactions
		if (filters.dateRange.from && filters.dateRange.to) {
			txs = txs.filter(tx => {
				const d = new Date(tx.created_at)
				return d >= filters.dateRange.from! && d <= filters.dateRange.to!
			})
		}
		if (filters.type !== 'all') {
			txs = txs.filter(tx => (filters.type === 'INCOME' ? tx.type_transaction === TypeTransaction.INCOME : tx.type_transaction === TypeTransaction.BILL))
		}
		if (filters.account !== 'all') {
			txs = txs.filter(tx => tx.account_id === filters.account)
		}
		if (filters.category !== 'all') {
			txs = txs.filter(tx => tx.category_id === filters.category)
		}
		if (filters.minAmount) {
			txs = txs.filter(tx => tx.amount >= Number(filters.minAmount))
		}
		if (filters.maxAmount) {
			txs = txs.filter(tx => tx.amount <= Number(filters.maxAmount))
		}
		if (filters.search) {
			txs = txs.filter(tx => tx.description.toLowerCase().includes(filters.search.toLowerCase()))
		}
		setFiltered(txs)
	}

	function clearFilters() {
		setFilters({
			dateRange: { from: undefined, to: undefined },
			type: 'all',
			account: 'all',
			category: 'all',
			minAmount: '',
			maxAmount: '',
			search: '',
		})
		setFiltered(null)
	}

	const shownTransactions = filtered ? filtered : transactions.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10)

	useEffect(() => {
		applyFilters()
	}, [filters, transactions])

	if (isLoadingTx || isLoadingCat || isLoadingAcc) {
		return <div className="flex justify-center items-center min-h-screen"><span className="text-lg">Cargando datos...</span></div>
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20">
			<div className="container mx-auto px-4 py-8">
				{/* Header */}
				<div className="mb-8">
					<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
						<div>
							<h1 className="text-4xl font-bold bg-gradient-to-r from-foreground via-primary to-primary bg-clip-text text-transparent">
								Gestión de Transacciones
							</h1>
							<p className="text-muted-foreground mt-2 text-lg">
								Supervisa y analiza todas tus transacciones financieras
							</p>
						</div>
						<div className="flex items-center gap-3">
							<Button variant="outline" className="border-border/50" onClick={() => setDrawerOpen(true)}>
								<Filter className="h-4 w-4 mr-2" />
								Filtrar
							</Button>
							<Button className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70">
								<PlusCircle className="h-4 w-4 mr-2" />
								Nueva Transacción
							</Button>
						</div>
					</div>
				</div>

				<Drawer open={drawerOpen} onOpenChange={setDrawerOpen} side="right">
					<DrawerContent side="right">
						<DrawerHeader>
							<DrawerTitle>Filtrar Transacciones</DrawerTitle>
						</DrawerHeader>
						<form className="p-4 space-y-4">
							<CalendarDateRangePicker value={filters.dateRange} onChange={dateRange => {
								if (dateRange && typeof dateRange === 'object' && 'from' in dateRange && 'to' in dateRange) {
									setFilters(f => ({ ...f, dateRange }))
								}
							}} />
							<div>
								<label className="block mb-1">Tipo</label>
								<Select value={filters.type} onValueChange={v => setFilters(f => ({ ...f, type: v }))}>
									<SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
									<SelectContent>
										<SelectItem value="all">Todos</SelectItem>
										<SelectItem value="INCOME">Ingreso</SelectItem>
										<SelectItem value="BILL">Gasto</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div>
								<label className="block mb-1">Cuenta</label>
								<Select value={filters.account} onValueChange={v => setFilters(f => ({ ...f, account: v }))}>
									<SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
									<SelectContent>
										<SelectItem value="all">Todas</SelectItem>
										{accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name_account}</SelectItem>)}
									</SelectContent>
								</Select>
							</div>
							<div>
								<label className="block mb-1">Categoría</label>
								<Select value={filters.category} onValueChange={v => setFilters(f => ({ ...f, category: v }))}>
									<SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
									<SelectContent>
										<SelectItem value="all">Todas</SelectItem>
										{categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
									</SelectContent>
								</Select>
							</div>
							<div className="flex gap-2">
								<div className="flex-1">
									<label className="block mb-1">Monto mínimo</label>
									<Input type="number" value={filters.minAmount} onChange={e => setFilters(f => ({ ...f, minAmount: e.target.value }))} placeholder="0" min={0} />
								</div>
								<div className="flex-1">
									<label className="block mb-1">Monto máximo</label>
									<Input type="number" value={filters.maxAmount} onChange={e => setFilters(f => ({ ...f, maxAmount: e.target.value }))} placeholder="99999" min={0} />
								</div>
							</div>
							<div>
								<label className="block mb-1">Buscar</label>
								<Input type="text" value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} placeholder="Buscar por descripción..." />
							</div>
							<DrawerFooter>
								<Button type="button" variant="outline" onClick={clearFilters} className="w-full">Limpiar Filtros</Button>
								<DrawerClose asChild>
									<Button type="button" variant="ghost" className="w-full">Cerrar</Button>
								</DrawerClose>
							</DrawerFooter>
						</form>
					</DrawerContent>
				</Drawer>

				{/* Resumen de transacciones */}
				<div className="mb-8">
					<TransactionSummaryCard transactions={shownTransactions} />
				</div>

				{/* Contenido principal con tabs */}
				<AnimatedTabs
					tabs={[
						{
							value: 'all',
							label: 'Todas',
							icon: <Wallet className="h-4 w-4" />,
							content: (
								<div className="space-y-4">
									{shownTransactions.map((transaction) => {
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
							value: 'income',
							label: 'Ingresos',
							icon: <TrendingUp className="h-4 w-4" />,
							content: (
								<div className="space-y-4">
									{incomeTransactions.map((transaction) => {
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
							value: 'expenses',
							label: 'Gastos',
							icon: <TrendingDown className="h-4 w-4" />,
							content: (
								<div className="space-y-4">
									{expenseTransactions.map((transaction) => {
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
						}
					]}
					defaultValue="all"
					className="space-y-6"
				/>

				{/* Información de desarrollo */}
				<Card className="mt-8 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 border-blue-200/50 dark:border-blue-800/30">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
							<Wallet className="h-5 w-5" />
							Información de Desarrollo
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<div>
								<p className="font-semibold text-blue-800 dark:text-blue-200 mb-3">Estado del Sistema:</p>
								<div className="space-y-2">
									<Badge variant="outline" className="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-400">
										✅ Server Component optimizado
									</Badge>
									<Badge variant="outline" className="bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-400">
										✅ Data loading en servidor
									</Badge>
								</div>
							</div>
							<div>
								<p className="font-semibold text-blue-800 dark:text-blue-200 mb-3">Datos Disponibles:</p>
								<div className="space-y-2">
									<Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-400">
										💳 {transactions.length} transacciones
									</Badge>
									<Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-400">
										📊 {categories.length} categorías
									</Badge>
									<Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-400">
										💰 {incomeTransactions.length} ingresos
									</Badge>
									<Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-400">
										💸 {expenseTransactions.length} gastos
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
