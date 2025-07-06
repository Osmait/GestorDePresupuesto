'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { getCategoryRepository, getTransactionRepository } from '@/lib/repositoryConfig'
import { Category } from '@/types/category'
import { Transaction } from '@/types/transaction'
import { 
	Tags, 
	PlusCircle, 
	Grid3X3,
	Palette,
	BarChart3,
	Hash,
	DollarSign
} from 'lucide-react'

interface CategoryCardProps {
	category: Category
	transactionCount: number
	totalAmount: number
}

function LoadingSpinner() {
	return (
		<div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary/20 dark:from-background dark:to-secondary/10">
			<div className="text-center">
				<div className="relative">
					<div className="animate-spin rounded-full h-16 w-16 border-4 border-muted border-t-primary mx-auto"></div>
					<div className="absolute inset-0 rounded-full h-16 w-16 border-4 border-transparent border-t-primary/60 animate-spin mx-auto" style={{animationDelay: '0.3s', animationDuration: '1.2s'}}></div>
				</div>
				<div className="mt-6 text-xl font-semibold text-foreground">Cargando Categorías</div>
				<div className="mt-2 text-sm text-muted-foreground">Preparando tus categorías...</div>
			</div>
		</div>
	)
}

function CategoryCard({ category, transactionCount, totalAmount }: CategoryCardProps) {
	return (
		<Card className="hover:shadow-lg hover:shadow-primary/5 dark:hover:shadow-primary/10 transition-all duration-300 border-border/50 dark:border-border/20">
			<CardContent className="p-6">
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center space-x-4">
						<div 
							className="w-16 h-16 rounded-full flex items-center justify-center text-2xl shadow-md border-2 border-primary/20"
							style={{ backgroundColor: category.color + '20' }}
						>
							{category.icon}
						</div>
						<div>
							<p className="font-semibold text-foreground text-lg">{category.name}</p>
							<p className="text-sm text-muted-foreground flex items-center gap-1">
								<Hash className="h-3 w-3" />
								ID: {category.id}
							</p>
						</div>
					</div>
				</div>
				
				<div className="space-y-3">
					<div className="flex justify-between items-center">
						<span className="text-sm text-muted-foreground">Transacciones</span>
						<Badge variant="outline" className="bg-muted/30 dark:bg-muted/20">
							{transactionCount}
						</Badge>
					</div>
					
					<div className="flex justify-between items-center">
						<span className="text-sm text-muted-foreground">Total Monto</span>
						<span className="font-bold text-lg text-foreground">
							${totalAmount.toLocaleString()}
						</span>
					</div>
					
					<div className="flex justify-between items-center pt-2 border-t border-border/50">
						<span className="text-xs text-muted-foreground">Color</span>
						<div className="flex items-center gap-2">
							<div 
								className="w-4 h-4 rounded-full border border-border/50"
								style={{ backgroundColor: category.color }}
							></div>
							<span className="text-xs text-muted-foreground font-mono">
								{category.color}
							</span>
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

function CategorySummaryCard({ categories, transactions }: { categories: Category[], transactions: Transaction[] }) {
	const totalCategories = categories.length
	const activeCategories = categories.filter(cat => 
		transactions.some(t => t.category_id === cat.id)
	).length
	const averageTransactionsPerCategory = totalCategories > 0 
		? Math.round(transactions.length / totalCategories) 
		: 0
	
	return (
		<Card className="border-border/50 dark:border-border/20">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-foreground">
					<Tags className="h-5 w-5" />
					Resumen de Categorías
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div className="text-center p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-violet-500/10 dark:from-purple-500/5 dark:to-violet-500/5">
						<Grid3X3 className="h-6 w-6 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
						<p className="text-sm font-medium text-muted-foreground">Total Categorías</p>
						<p className="text-2xl font-bold text-foreground">{totalCategories}</p>
					</div>
					<div className="text-center p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-500/10 dark:from-green-500/5 dark:to-emerald-500/5">
						<BarChart3 className="h-6 w-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
						<p className="text-sm font-medium text-muted-foreground">Categorías Activas</p>
						<p className="text-2xl font-bold text-foreground">{activeCategories}</p>
					</div>
					<div className="text-center p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 dark:from-blue-500/5 dark:to-cyan-500/5">
						<DollarSign className="h-6 w-6 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
						<p className="text-sm font-medium text-muted-foreground">Promedio Transacciones</p>
						<p className="text-2xl font-bold text-foreground">{averageTransactionsPerCategory}</p>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

export default function CategoriesPage() {
	const [categories, setCategories] = useState<Category[]>([])
	const [transactions, setTransactions] = useState<Transaction[]>([])
	const [isLoading, setIsLoading] = useState(true)

	useEffect(() => {
		const loadData = async () => {
			try {
				console.log('🔄 Cargando categorías y transacciones mock...')
				const categoryRepository = await getCategoryRepository()
				const transactionRepository = await getTransactionRepository()
				
				const [categoriesData, transactionsData] = await Promise.all([
					categoryRepository.findAll(),
					transactionRepository.findAll()
				])
				
				setCategories(categoriesData)
				setTransactions(transactionsData)
				console.log('✅ Datos cargados exitosamente')
			} catch (error) {
				console.error('❌ Error cargando datos:', error)
			} finally {
				setIsLoading(false)
			}
		}

		// Add timeout to prevent infinite loading
		const timeoutId = setTimeout(() => {
			console.log('⏰ Timeout en categorías, forzando fin de carga')
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

	const getCategoryStats = (categoryId: string) => {
		const categoryTransactions = transactions.filter(t => t.category_id === categoryId)
		return {
			count: categoryTransactions.length,
			total: categoryTransactions.reduce((sum, t) => sum + t.amount, 0)
		}
	}

	const activeCategories = categories.filter(cat => 
		transactions.some(t => t.category_id === cat.id)
	)

	const inactiveCategories = categories.filter(cat => 
		!transactions.some(t => t.category_id === cat.id)
	)

	return (
		<div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20">
			<div className="container mx-auto px-4 py-8">
				{/* Header */}
				<div className="mb-8">
					<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
						<div>
							<h1 className="text-4xl font-bold bg-gradient-to-r from-foreground via-primary to-primary bg-clip-text text-transparent">
								Gestión de Categorías
							</h1>
							<p className="text-muted-foreground mt-2 text-lg">
								Organiza y administra las categorías de tus transacciones
							</p>
						</div>
						<div className="flex items-center gap-3">
							<Button variant="outline" className="border-border/50">
								<Palette className="h-4 w-4 mr-2" />
								Personalizar
							</Button>
							<Button className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70">
								<PlusCircle className="h-4 w-4 mr-2" />
								Nueva Categoría
							</Button>
						</div>
					</div>
				</div>

				{/* Resumen de categorías */}
				<div className="mb-8">
					<CategorySummaryCard categories={categories} transactions={transactions} />
				</div>

				{/* Contenido principal con tabs */}
				<Tabs defaultValue="all" className="space-y-6">
					<TabsList className="grid w-full grid-cols-3 lg:w-auto lg:grid-cols-3 bg-muted/50 dark:bg-muted/30">
						<TabsTrigger value="all" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
							<Grid3X3 className="h-4 w-4" />
							<span className="hidden sm:inline">Todas</span>
						</TabsTrigger>
						<TabsTrigger value="active" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
							<BarChart3 className="h-4 w-4" />
							<span className="hidden sm:inline">Activas</span>
						</TabsTrigger>
						<TabsTrigger value="inactive" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
							<Tags className="h-4 w-4" />
							<span className="hidden sm:inline">Inactivas</span>
						</TabsTrigger>
					</TabsList>

					{/* Tab: Todas las categorías */}
					<TabsContent value="all" className="space-y-6">
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{categories.map((category) => {
								const stats = getCategoryStats(category.id)
								return (
									<CategoryCard 
										key={category.id} 
										category={category} 
										transactionCount={stats.count}
										totalAmount={stats.total}
									/>
								)
							})}
						</div>
					</TabsContent>

					{/* Tab: Categorías activas */}
					<TabsContent value="active" className="space-y-6">
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{activeCategories.map((category) => {
								const stats = getCategoryStats(category.id)
								return (
									<CategoryCard 
										key={category.id} 
										category={category} 
										transactionCount={stats.count}
										totalAmount={stats.total}
									/>
								)
							})}
						</div>
						{activeCategories.length === 0 && (
							<Card className="border-border/50 dark:border-border/20">
								<CardContent className="p-8 text-center">
									<BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
									<p className="text-muted-foreground">No hay categorías activas</p>
								</CardContent>
							</Card>
						)}
					</TabsContent>

					{/* Tab: Categorías inactivas */}
					<TabsContent value="inactive" className="space-y-6">
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{inactiveCategories.map((category) => (
								<CategoryCard 
									key={category.id} 
									category={category} 
									transactionCount={0}
									totalAmount={0}
								/>
							))}
						</div>
						{inactiveCategories.length === 0 && (
							<Card className="border-border/50 dark:border-border/20">
								<CardContent className="p-8 text-center">
									<Tags className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
									<p className="text-muted-foreground">Todas las categorías están activas</p>
								</CardContent>
							</Card>
						)}
					</TabsContent>
				</Tabs>

				{/* Información adicional */}
				<Card className="mt-8 bg-gradient-to-r from-purple-50/50 to-violet-50/50 dark:from-purple-900/10 dark:to-violet-900/10 border-purple-200/50 dark:border-purple-800/30">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-purple-900 dark:text-purple-100">
							<Palette className="h-5 w-5" />
							Estadísticas de Categorías
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
							<div>
								<p className="font-semibold text-purple-800 dark:text-purple-200 mb-2">Total Categorías:</p>
								<p className="text-purple-700 dark:text-purple-300">{categories.length} disponibles</p>
							</div>
							<div>
								<p className="font-semibold text-purple-800 dark:text-purple-200 mb-2">Categorías con Más Uso:</p>
								<p className="text-purple-700 dark:text-purple-300">
									{categories.length > 0 
										? categories
											.map(cat => ({ ...cat, count: getCategoryStats(cat.id).count }))
											.sort((a, b) => b.count - a.count)[0]?.name || 'N/A'
										: 'N/A'
									}
								</p>
							</div>
							<div>
								<p className="font-semibold text-purple-800 dark:text-purple-200 mb-2">Promedio por Categoría:</p>
								<p className="text-purple-700 dark:text-purple-300">
									${categories.length > 0 
										? Math.round(
											categories
												.map(cat => getCategoryStats(cat.id).total)
												.reduce((sum, total) => sum + total, 0) / categories.length
										).toLocaleString()
										: 0
									}
								</p>
							</div>
							<div>
								<p className="font-semibold text-purple-800 dark:text-purple-200 mb-2">Colores Únicos:</p>
								<p className="text-purple-700 dark:text-purple-300">
									{Array.from(new Set(categories.map(cat => cat.color))).length} colores
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
