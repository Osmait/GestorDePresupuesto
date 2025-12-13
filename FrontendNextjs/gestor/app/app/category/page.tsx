'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useCategories, useTransactions } from '@/hooks/useRepositories'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Input } from '@/components/ui/input'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Loader2, PlusCircle, Tag, Palette, Activity, MoreHorizontal, Edit, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AnimatedTabs } from '@/components/common/animated-tabs'
import { Button } from '@/components/ui/button'
import { getCategoryRepository, getTransactionRepository } from '@/lib/repositoryConfig'
import { Category } from '@/types/category'
import { Transaction } from '@/types/transaction'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface CategoryCardProps {
	category: Category
	transactions: Transaction[]
	onDelete: () => Promise<void>
}

// Server Component para LoadingSpinner (no se usa en Server Components)
function LoadingSpinner() {
	return (
		<div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary/20 dark:from-background dark:to-secondary/10">
			<div className="text-center">
				<div className="relative">
					<div className="animate-spin rounded-full h-16 w-16 border-4 border-muted border-t-primary mx-auto"></div>
					<div className="absolute inset-0 rounded-full h-16 w-16 border-4 border-transparent border-t-primary/60 animate-spin mx-auto" style={{ animationDelay: '0.3s', animationDuration: '1.2s' }}></div>
				</div>
				<div className="mt-6 text-xl font-semibold text-foreground">Cargando Categorías</div>
				<div className="mt-2 text-sm text-muted-foreground">Preparando tus categorías financieras...</div>
			</div>
		</div>
	)
}

// Component para CategoryCard
function CategoryCard({ category, transactions, onDelete }: CategoryCardProps) {
	console.log("category", category)
	console.log("transactions", transactions)
	const categoryTransactions = transactions.filter(t => t.category_id === category.id)

	console.log(`CategoryCard "${category.name}": ${categoryTransactions.length} transacciones encontradas`)

	const totalAmount = categoryTransactions.reduce((sum, transaction) => sum + transaction.amount, 0)
	const [showDeleteDialog, setShowDeleteDialog] = useState(false)
	const [isDeleting, setIsDeleting] = useState(false)

	const handleDelete = async () => {
		setIsDeleting(true)
		try {
			await onDelete()
			setShowDeleteDialog(false)
		} catch (error) {
			console.error('Error deleting category:', error)
		} finally {
			setIsDeleting(false)
		}
	}

	return (
		<Card className="hover:shadow-lg hover:shadow-primary/5 dark:hover:shadow-primary/10 transition-all duration-300 border-border/50 dark:border-border/20 relative group">
			<div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-muted">
							<MoreHorizontal className="h-4 w-4" />
							<span className="sr-only">Abrir menú</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem className="flex items-center gap-2 cursor-pointer">
							<Edit className="h-4 w-4" />
							Editar categoría
						</DropdownMenuItem>
						<DropdownMenuItem
							className="flex items-center gap-2 cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
							onClick={() => setShowDeleteDialog(true)}
						>
							<Trash2 className="h-4 w-4" />
							Eliminar categoría
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

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

			<Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Eliminar Categoría</DialogTitle>
						<DialogDescription>
							¿Estás seguro de que quieres eliminar la categoría "{category.name}"?
							Esta acción no se puede deshacer.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setShowDeleteDialog(false)}
							disabled={isDeleting}
						>
							Cancelar
						</Button>
						<Button
							variant="destructive"
							onClick={handleDelete}
							disabled={isDeleting}
						>
							{isDeleting ? 'Eliminando...' : 'Eliminar'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
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
						<Tag className="h-6 w-6 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
						<p className="text-sm font-medium text-muted-foreground">Total Categorías</p>
						<p className="text-2xl font-bold text-foreground">{categories.length}</p>
					</div>
					<div className="text-center p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-500/10 dark:from-green-500/5 dark:to-emerald-500/5">
						<Activity className="h-6 w-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
						<p className="text-sm font-medium text-muted-foreground">Categorías Activas</p>
						<p className="text-2xl font-bold text-foreground">{activeCategories.length}</p>
					</div>
					<div className="text-center p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-violet-500/10 dark:from-purple-500/5 dark:to-violet-500/5">
						<Palette className="h-6 w-6 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
						<p className="text-sm font-medium text-muted-foreground">Promedio por Categoría</p>
						<p className="text-2xl font-bold text-foreground">{averagePerCategory}</p>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

const categorySchema = z.object({
	name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
	icon: z.string().min(1, 'Elige un emoji'),
	color: z.string().min(4, 'Elige un color'),
})
type CategoryFormValues = z.infer<typeof categorySchema>

interface CategoryFormModalProps {
	open: boolean
	setOpen: (v: boolean) => void
	onCreateCategory: (name: string, icon: string, color: string) => Promise<void>
}

function CategoryFormModal({ open, setOpen, onCreateCategory }: CategoryFormModalProps) {
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [success, setSuccess] = useState(false)
	const [iconMode, setIconMode] = useState<'list' | 'custom'>('list')
	const [customIcon, setCustomIcon] = useState('')
	const emojiOptions = [
		'🍽️', '🚗', '🏠', '💡', '🛒', '🎬', '🏥', '📚', '👕', '💻', '🏦', '🏖️', '🐶', '🎁', '🧾', '💼', '💸'
	]
	const form = useForm<CategoryFormValues>({
		resolver: zodResolver(categorySchema),
		defaultValues: { name: '', icon: '', color: '#4ECDC4' },
	})

	async function onSubmit(values: CategoryFormValues) {
		const icon = iconMode === 'custom' ? customIcon : values.icon
		try {
			setIsLoading(true)
			setError(null)
			await onCreateCategory(values.name, icon, values.color)
			setSuccess(true)
			form.reset({ name: '', icon: '', color: '#4ECDC4' })
			setCustomIcon('')
			setIconMode('list')
			setTimeout(() => {
				setSuccess(false)
				setOpen(false)
			}, 1200)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error al crear la categoría')
		} finally {
			setIsLoading(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Nueva Categoría</DialogTitle>
				</DialogHeader>
				{success ? (
					<div className="flex flex-col items-center justify-center py-8">
						<Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
						<p className="text-green-600 font-semibold">¡Categoría creada!</p>
					</div>
				) : (
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
							<FormField control={form.control} name="name" render={({ field }) => (
								<FormItem>
									<FormLabel>Nombre</FormLabel>
									<FormControl><Input {...field} placeholder="Ej: Mascotas" /></FormControl>
									<FormMessage />
								</FormItem>
							)} />
							<div>
								<FormLabel>Icono (emoji)</FormLabel>
								{iconMode === 'list' ? (
									<div className="flex gap-2 items-center">
										<FormField control={form.control} name="icon" render={({ field }) => (
											<FormItem className="flex-1">
												<FormControl>
													<Select value={field.value} onValueChange={v => field.onChange(v)}>
														<SelectTrigger><SelectValue placeholder="Selecciona un emoji" /></SelectTrigger>
														<SelectContent>
															{emojiOptions.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
															<SelectItem value="custom">Personalizado...</SelectItem>
														</SelectContent>
													</Select>
												</FormControl>
												<FormMessage />
											</FormItem>
										)} />
										<Button type="button" variant="outline" size="sm" onClick={() => setIconMode('custom')}>Personalizado</Button>
									</div>
								) : (
									<div className="flex gap-2 items-center">
										<Input value={customIcon} onChange={e => setCustomIcon(e.target.value)} placeholder="Ej: 🐶" maxLength={2} className="w-20" />
										<Button type="button" variant="outline" size="sm" onClick={() => setIconMode('list')}>Volver</Button>
									</div>
								)}
							</div>
							<FormField control={form.control} name="color" render={({ field }) => (
								<FormItem>
									<FormLabel>Color</FormLabel>
									<FormControl><Input {...field} type="color" className="w-12 h-8 p-0 border-none bg-transparent" /></FormControl>
									<FormMessage />
								</FormItem>
							)} />
							<DialogFooter>
								<Button type="submit" disabled={isLoading} className="w-full">
									{isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
									Crear Categoría
								</Button>
								<DialogClose asChild>
									<Button type="button" variant="ghost" className="w-full">Cancelar</Button>
								</DialogClose>
							</DialogFooter>
						</form>
					</Form>
				)}
				{error && (
					<Alert variant="destructive" className="mt-4">
						<AlertCircle className="h-4 w-4" />
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}
			</DialogContent>
		</Dialog>
	)
}

import { CategoriesSkeleton } from '@/components/skeletons/categories-skeleton'

// ... imports

// Remove LoadingSpinner function if unused or used elsewhere, but here:

export default function CategoriesPage() {
	const { categories, createCategory, deleteCategory, isLoading: isLoadingCategories } = useCategories()
	const { transactions, isLoading: isLoadingTransactions } = useTransactions()
	const [modalOpen, setModalOpen] = useState(false)

	const isLoading = isLoadingCategories || isLoadingTransactions

	// Debug logs detallados (omitted for brevity in this view, keeping original structure logically)

	if (isLoading) {
		return <CategoriesSkeleton />
	}

	return (
		<div
			className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20"
		>
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.5 }}
				className="container mx-auto px-4 py-8"
			>
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
							<Button className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70" onClick={() => setModalOpen(true)}>
								<PlusCircle className="h-4 w-4 mr-2" />
								Nueva Categoría
							</Button>
							<CategoryFormModal
								open={modalOpen}
								setOpen={setModalOpen}
								onCreateCategory={createCategory}
							/>
						</div>
					</div>
				</div>

				{/* Resumen de categorías */}
				<div className="mb-8">
					<CategorySummaryCard categories={categories} transactions={transactions} />
				</div>

				{/* Contenido principal con tabs */}
				<AnimatedTabs
					defaultValue="all"
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
											onDelete={() => deleteCategory(category.id)}
										/>
									))}
								</div>
							)
						},
					]}
				/>
			</motion.div>
		</div>
	)
}

