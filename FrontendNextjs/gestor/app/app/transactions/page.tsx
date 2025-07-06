'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

interface TransactionItemProps {
	transaction: Transaction
	category?: Category
}

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

export default function TransactionsPage() {
	const [transactions, setTransactions] = useState<Transaction[]>([])
	const [categories, setCategories] = useState<Category[]>([])
	const [isLoading, setIsLoading] = useState(true)

	useEffect(() => {
		const loadData = async () => {
			try {
				console.log('🔄 Cargando transacciones y categorías mock...')
				const transactionRepository = await getTransactionRepository()
				const categoryRepository = await getCategoryRepository()
				
				const [transactionsData, categoriesData] = await Promise.all([
					transactionRepository.findAll(),
					categoryRepository.findAll()
				])
				
				setTransactions(transactionsData)
				setCategories(categoriesData)
				console.log('✅ Datos cargados exitosamente')
			} catch (error) {
				console.error('❌ Error cargando datos:', error)
			} finally {
				setIsLoading(false)
			}
		}

		// Add timeout to prevent infinite loading
		const timeoutId = setTimeout(() => {
			console.log('⏰ Timeout en transacciones, forzando fin de carga')
			setIsLoading(false)
		}, 5000)

		loadData().finally(() => {
			clearTimeout(timeoutId)
		})

		return () => clearTimeout(timeoutId)
	}, [])

	if (isLoading) {
		return <LoadingSpinner />
	}

	const incomeTransactions = transactions.filter(t => t.type_transaction === TypeTransaction.INCOME)
	const expenseTransactions = transactions.filter(t => t.type_transaction === TypeTransaction.BILL)

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
							<Button variant="outline" className="border-border/50">
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

				{/* Resumen de transacciones */}
				<div className="mb-8">
					<TransactionSummaryCard transactions={transactions} />
				</div>

				{/* Contenido principal con tabs */}
				<Tabs defaultValue="all" className="space-y-6">
					<TabsList className="grid w-full grid-cols-3 lg:w-auto lg:grid-cols-3 bg-muted/50 dark:bg-muted/30">
						<TabsTrigger value="all" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
							<Wallet className="h-4 w-4" />
							<span className="hidden sm:inline">Todas</span>
						</TabsTrigger>
						<TabsTrigger value="income" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
							<TrendingUp className="h-4 w-4" />
							<span className="hidden sm:inline">Ingresos</span>
						</TabsTrigger>
						<TabsTrigger value="expenses" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
							<TrendingDown className="h-4 w-4" />
							<span className="hidden sm:inline">Gastos</span>
						</TabsTrigger>
					</TabsList>

					{/* Tab: Todas las transacciones */}
					<TabsContent value="all" className="space-y-6">
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
					</TabsContent>

					{/* Tab: Ingresos */}
					<TabsContent value="income" className="space-y-6">
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
						{incomeTransactions.length === 0 && (
							<Card className="border-border/50 dark:border-border/20">
								<CardContent className="p-8 text-center">
									<TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
									<p className="text-muted-foreground">No hay ingresos registrados</p>
								</CardContent>
							</Card>
						)}
					</TabsContent>

					{/* Tab: Gastos */}
					<TabsContent value="expenses" className="space-y-6">
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
						{expenseTransactions.length === 0 && (
							<Card className="border-border/50 dark:border-border/20">
								<CardContent className="p-8 text-center">
									<TrendingDown className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
									<p className="text-muted-foreground">No hay gastos registrados</p>
								</CardContent>
							</Card>
						)}
					</TabsContent>
				</Tabs>

				{/* Información adicional */}
				<Card className="mt-8 bg-gradient-to-r from-green-50/50 to-emerald-50/50 dark:from-green-900/10 dark:to-emerald-900/10 border-green-200/50 dark:border-green-800/30">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-green-900 dark:text-green-100">
							<Wallet className="h-5 w-5" />
							Estadísticas de Transacciones
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
							<div>
								<p className="font-semibold text-green-800 dark:text-green-200 mb-2">Total Transacciones:</p>
								<p className="text-green-700 dark:text-green-300">{transactions.length} registradas</p>
							</div>
							<div>
								<p className="font-semibold text-green-800 dark:text-green-200 mb-2">Promedio por Transacción:</p>
								<p className="text-green-700 dark:text-green-300">
									${transactions.length > 0 ? Math.round(transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length).toLocaleString() : 0}
								</p>
							</div>
							<div>
								<p className="font-semibold text-green-800 dark:text-green-200 mb-2">Categorías Únicas:</p>
								<p className="text-green-700 dark:text-green-300">
									{Array.from(new Set(transactions.map(t => t.category_id))).length} categorías
								</p>
							</div>
							<div>
								<p className="font-semibold text-green-800 dark:text-green-200 mb-2">Última Transacción:</p>
								<p className="text-green-700 dark:text-green-300">
									{transactions.length > 0 ? new Date(Math.max(...transactions.map(t => new Date(t.created_at).getTime()))).toLocaleDateString('es-ES') : 'N/A'}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
