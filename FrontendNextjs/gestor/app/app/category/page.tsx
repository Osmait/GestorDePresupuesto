import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AnimatedTabs } from '@/components/client/animated-tabs'
import { Button } from '@/components/ui/button'
import { getCategoryRepository, getTransactionRepository } from '@/lib/repositoryConfig'
import { Category } from '@/types/category'
import { Transaction } from '@/types/transaction'
import { 
	Tag, 
	PlusCircle, 
	Palette,
	Hash,
	Target,
	Activity
} from 'lucide-react'

interface CategoryCardProps {
	category: Category
	transactions: Transaction[]
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
				<div className="mt-6 text-xl font-semibold text-foreground">Cargando Categorías</div>
				<div className="mt-2 text-sm text-muted-foreground">Preparando tus categorías financieras...</div>
			</div>
		</div>
	)
}

// Server Component para CategoryCard
function CategoryCard({ category, transactions }: CategoryCardProps) {
	const categoryTransactions = transactions.filter(t => t.category_id === category.id)
	const totalAmount = categoryTransactions.reduce((sum, t) => sum + t.amount, 0)
	
	return (
		<Card className="hover:shadow-lg hover:shadow-primary/5 dark:hover:shadow-primary/10 transition-all duration-300 border-border/50 dark:border-border/20">
			<CardContent className="p-6">
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center space-x-4">
						<div 
							className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-semibold" 
							style={{ backgroundColor: category.color, color: '#fff' }}
						>
							{category.icon}
						</div>
						<div>
							<p className="font-semibold text-foreground text-lg">{category.name}</p>
							<p className="text-sm text-muted-foreground">
								{categoryTransactions.length} transacciones
							</p>
						</div>
					</div>
					<div className="text-right">
						<p className="font-bold text-xl text-foreground">
							${totalAmount.toLocaleString()}
						</p>
						<p className="text-xs text-muted-foreground">Total</p>
					</div>
				</div>
				
				<div className="flex items-center justify-between pt-3 border-t border-border/50">
					<div className="flex items-center gap-2">
						<div 
							className="w-3 h-3 rounded-full" 
							style={{ backgroundColor: category.color }}
						></div>
						<span className="text-xs text-muted-foreground">Color</span>
					</div>
					<Badge variant="outline" className="bg-muted/30 dark:bg-muted/20">
						{categoryTransactions.length > 5 ? 'Activa' : categoryTransactions.length > 0 ? 'Moderada' : 'Inactiva'}
					</Badge>
				</div>
			</CardContent>
		</Card>
	)
}

// Server Component para CategorySummaryCard
function CategorySummaryCard({ categories, transactions }: { categories: Category[], transactions: Transaction[] }) {
	const activeCategories = categories.filter(cat => 
		transactions.some(t => t.category_id === cat.id)
	)
	const totalTransactions = transactions.length
	const averagePerCategory = activeCategories.length > 0 ? Math.round(totalTransactions / activeCategories.length) : 0
	
	return (
		<Card className="border-border/50 dark:border-border/20">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-foreground">
					<Tag className="h-5 w-5" />
					Resumen de Categorías
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div className="text-center p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 dark:from-blue-500/5 dark:to-cyan-500/5">
						<Hash className="h-6 w-6 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
						<p className="text-sm font-medium text-muted-foreground">Total Categorías</p>
						<p className="text-2xl font-bold text-foreground">{categories.length}</p>
					</div>
					<div className="text-center p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-500/10 dark:from-green-500/5 dark:to-emerald-500/5">
						<Activity className="h-6 w-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
						<p className="text-sm font-medium text-muted-foreground">Categorías Activas</p>
						<p className="text-2xl font-bold text-foreground">{activeCategories.length}</p>
					</div>
					<div className="text-center p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-violet-500/10 dark:from-purple-500/5 dark:to-violet-500/5">
						<Target className="h-6 w-6 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
						<p className="text-sm font-medium text-muted-foreground">Promedio por Categoría</p>
						<p className="text-2xl font-bold text-foreground">{averagePerCategory}</p>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

// Componente principal - Server Component que carga datos directamente
export default async function CategoriesPage() {
	// Cargar datos en el servidor
	const categoryRepository = await getCategoryRepository()
	const transactionRepository = await getTransactionRepository()
	
	const [categories, transactions] = await Promise.all([
		categoryRepository.findAll(),
		transactionRepository.findAll()
	])

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
								Organiza y clasifica tus transacciones financieras
							</p>
						</div>
						<div className="flex items-center gap-3">
							<Button variant="outline" className="border-border/50">
								<Palette className="h-4 w-4 mr-2" />
								Colores
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
				<AnimatedTabs
					tabs={[
						{
							value: 'all',
							label: 'Todas',
							icon: <Tag className="h-4 w-4" />,
							content: (
								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
									{categories.map((category) => (
										<CategoryCard 
											key={category.id} 
											category={category} 
											transactions={transactions}
										/>
									))}
								</div>
							)
						},
						{
							value: 'active',
							label: 'Activas',
							icon: <Activity className="h-4 w-4" />,
							content: (
								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
									{activeCategories.map((category) => (
										<CategoryCard 
											key={category.id} 
											category={category} 
											transactions={transactions}
										/>
									))}
								</div>
							)
						},
						{
							value: 'inactive',
							label: 'Inactivas',
							icon: <Target className="h-4 w-4" />,
							content: (
								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
									{inactiveCategories.map((category) => (
										<CategoryCard 
											key={category.id} 
											category={category} 
											transactions={transactions}
										/>
									))}
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
							<Tag className="h-5 w-5" />
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
										🏷️ {categories.length} categorías
									</Badge>
									<Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-400">
										✅ {activeCategories.length} activas
									</Badge>
									<Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-400">
										⏸️ {inactiveCategories.length} inactivas
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
