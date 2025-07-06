'use client'
import { useState } from 'react'
import { useBudgets, useCategories, useTransactions } from '@/hooks/useRepositories'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Input } from '@/components/ui/input'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, Loader2, PlusCircle, AlertTriangle } from 'lucide-react'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { AnimatedTabs } from '@/components/client/animated-tabs'
import { Button } from '@/components/ui/button'
import { getBudgetRepository, getCategoryRepository, getTransactionRepository } from '@/lib/repositoryConfig'
import { Budget } from '@/types/budget'
import { Category } from '@/types/category'
import { Transaction, TypeTransaction } from '@/types/transaction'
import { 
	PiggyBank, 
	TrendingUp, 
	TrendingDown, 
	Target,
	Calendar,
	DollarSign,
	CheckCircle,
	Clock
} from 'lucide-react'

interface BudgetCardProps {
	budget: Budget
	category?: Category
	spent: number
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
				<div className="mt-6 text-xl font-semibold text-foreground">Cargando Presupuestos</div>
				<div className="mt-2 text-sm text-muted-foreground">Preparando tu planificación financiera...</div>
			</div>
		</div>
	)
}

// Server Component para BudgetCard
function BudgetCard({ budget, category, spent, transactions }: BudgetCardProps) {
	const progressPercentage = (spent / budget.amount) * 100
	const remaining = budget.amount - spent
	const isOverBudget = spent > budget.amount
	
	const getStatusColor = () => {
		if (isOverBudget) return 'destructive'
		if (progressPercentage > 80) return 'default'
		if (progressPercentage > 60) return 'secondary'
		return 'default'
	}
	
	const getStatusIcon = () => {
		if (isOverBudget) return <AlertTriangle className="h-4 w-4" />
		if (progressPercentage > 90) return <Clock className="h-4 w-4" />
		if (progressPercentage < 50) return <CheckCircle className="h-4 w-4" />
		return <Target className="h-4 w-4" />
	}
	
	return (
		<Card className="hover:shadow-lg hover:shadow-primary/5 dark:hover:shadow-primary/10 transition-all duration-300 border-border/50 dark:border-border/20">
			<CardContent className="p-6">
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center space-x-4">
						<div className="p-3 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 dark:from-blue-500/10 dark:to-purple-500/10">
							<PiggyBank className="h-6 w-6 text-blue-600 dark:text-blue-400" />
						</div>
						<div>
							<p className="font-semibold text-foreground text-lg">
								{category ? `Presupuesto ${category.name}` : `Presupuesto #${budget.id}`}
							</p>
							<p className="text-sm text-muted-foreground flex items-center gap-1">
								{category && (
									<>
										<span>{category.icon}</span>
										<span>{category.name}</span>
									</>
								)}
							</p>
						</div>
					</div>
					<Badge variant={getStatusColor()} className="flex items-center gap-1">
						{getStatusIcon()}
						<span className="text-xs">
							{isOverBudget ? 'Excedido' : progressPercentage > 80 ? 'Crítico' : 'Activo'}
						</span>
					</Badge>
				</div>
				
				<div className="space-y-4">
					<div className="flex justify-between items-center">
						<span className="text-sm text-muted-foreground">Presupuesto</span>
						<span className="font-bold text-lg text-foreground">
							${budget.amount.toLocaleString()}
						</span>
					</div>
					
					<div className="flex justify-between items-center">
						<span className="text-sm text-muted-foreground">Gastado</span>
						<span className={`font-bold text-lg ${isOverBudget ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`}>
							${spent.toLocaleString()}
						</span>
					</div>
					
					<div className="flex justify-between items-center">
						<span className="text-sm text-muted-foreground">Restante</span>
						<span className={`font-bold text-lg ${remaining >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
							${remaining.toLocaleString()}
						</span>
					</div>
					
					<div className="space-y-2">
						<div className="flex justify-between items-center">
							<span className="text-xs text-muted-foreground">Progreso</span>
							<span className="text-xs text-muted-foreground">
								{Math.round(progressPercentage)}%
							</span>
						</div>
						<Progress 
							value={Math.min(progressPercentage, 100)} 
							className="h-2"
						/>
					</div>
					
					<div className="flex justify-between items-center pt-2 border-t border-border/50">
						<span className="text-xs text-muted-foreground">Transacciones</span>
						<span className="text-xs text-muted-foreground">
							{transactions.length} registradas
						</span>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

// Server Component para BudgetSummaryCard
function BudgetSummaryCard({ budgets, transactions }: { budgets: Budget[], transactions: Transaction[] }) {
	const totalBudget = budgets.reduce((sum, budget) => sum + budget.amount, 0)
	const totalSpent = transactions
		.filter(t => t.type_transaction === TypeTransaction.BILL)
		.reduce((sum, t) => sum + t.amount, 0)
	const totalRemaining = totalBudget - totalSpent
	const overBudgetCount = budgets.filter(budget => {
		const spent = transactions
			.filter(t => t.budget_id === budget.id && t.type_transaction === TypeTransaction.BILL)
			.reduce((spentSum, t) => spentSum + t.amount, 0)
		return spent > budget.amount
	}).length
	
	return (
		<Card className="border-border/50 dark:border-border/20">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-foreground">
					<PiggyBank className="h-5 w-5" />
					Resumen de Presupuestos
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
					<div className="text-center p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 dark:from-blue-500/5 dark:to-cyan-500/5">
						<DollarSign className="h-6 w-6 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
						<p className="text-sm font-medium text-muted-foreground">Total Presupuesto</p>
						<p className="text-xl font-bold text-foreground">${totalBudget.toLocaleString()}</p>
					</div>
					<div className="text-center p-4 rounded-lg bg-gradient-to-br from-orange-500/10 to-red-500/10 dark:from-orange-500/5 dark:to-red-500/5">
						<TrendingDown className="h-6 w-6 mx-auto mb-2 text-orange-600 dark:text-orange-400" />
						<p className="text-sm font-medium text-muted-foreground">Total Gastado</p>
						<p className="text-xl font-bold text-orange-600 dark:text-orange-400">${totalSpent.toLocaleString()}</p>
					</div>
					<div className="text-center p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-500/10 dark:from-green-500/5 dark:to-emerald-500/5">
						<TrendingUp className="h-6 w-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
						<p className="text-sm font-medium text-muted-foreground">Total Restante</p>
						<p className={`text-xl font-bold ${totalRemaining >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
							${totalRemaining.toLocaleString()}
						</p>
					</div>
					<div className="text-center p-4 rounded-lg bg-gradient-to-br from-red-500/10 to-pink-500/10 dark:from-red-500/5 dark:to-pink-500/5">
						<AlertTriangle className="h-6 w-6 mx-auto mb-2 text-red-600 dark:text-red-400" />
						<p className="text-sm font-medium text-muted-foreground">Presupuestos Excedidos</p>
						<p className="text-xl font-bold text-red-600 dark:text-red-400">{overBudgetCount}</p>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

const budgetSchema = z.object({
	category_id: z.string().min(1, 'Selecciona una categoría'),
	amount: z.coerce.number().min(1, 'El monto debe ser mayor a 0'),
})
type BudgetFormValues = z.infer<typeof budgetSchema>

function BudgetFormModal({ open, setOpen }: { open: boolean, setOpen: (v: boolean) => void }) {
	const { createBudget, isLoading, error } = useBudgets()
	const { categories } = useCategories()
	const [success, setSuccess] = useState(false)
	const form = useForm<BudgetFormValues>({
		resolver: zodResolver(budgetSchema),
		defaultValues: { category_id: '', amount: 0 },
	})

	async function onSubmit(values: BudgetFormValues) {
		try {
			await createBudget(values.category_id, values.amount)
			setSuccess(true)
			form.reset({ category_id: '', amount: 0 })
			setTimeout(() => {
				setSuccess(false)
				setOpen(false)
			}, 1200)
		} catch {}
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Nuevo Presupuesto</DialogTitle>
				</DialogHeader>
				{success ? (
					<div className="flex flex-col items-center justify-center py-8">
						<Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
						<p className="text-green-600 font-semibold">¡Presupuesto creado!</p>
					</div>
				) : (
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
							<FormField control={form.control} name="category_id" render={({ field }) => (
								<FormItem>
									<FormLabel>Categoría</FormLabel>
									<FormControl>
										<Select value={field.value} onValueChange={field.onChange}>
											<SelectTrigger><SelectValue placeholder="Selecciona una categoría" /></SelectTrigger>
											<SelectContent>
												{categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.icon} {cat.name}</SelectItem>)}
											</SelectContent>
										</Select>
									</FormControl>
									<FormMessage />
								</FormItem>
							)} />
							<FormField control={form.control} name="amount" render={({ field }) => (
								<FormItem>
									<FormLabel>Monto</FormLabel>
									<FormControl><Input type="number" {...field} min={1} step={0.01} /></FormControl>
									<FormMessage />
								</FormItem>
							)} />
							<DialogFooter>
								<Button type="submit" disabled={isLoading} className="w-full">
									{isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
									Crear Presupuesto
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

export default function BudgetPage() {
	const { budgets, isLoading } = useBudgets()
	const { categories } = useCategories()
	const { transactions } = useTransactions()
	const [modalOpen, setModalOpen] = useState(false)

	function getBudgetTransactions(budgetId: string) {
		return transactions.filter(t => t.budget_id === budgetId)
	}
	function getBudgetSpent(budgetId: string) {
		return transactions
			.filter(t => t.budget_id === budgetId && t.type_transaction === TypeTransaction.BILL)
			.reduce((sum, t) => sum + t.amount, 0)
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20">
			<div className="container mx-auto px-4 py-8">
				{/* Header */}
				<div className="mb-8">
					<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
						<div>
							<h1 className="text-4xl font-bold bg-gradient-to-r from-foreground via-primary to-primary bg-clip-text text-transparent">
								Gestión de Presupuestos
							</h1>
							<p className="text-muted-foreground mt-2 text-lg">
								Planifica y controla tus gastos por categoría
							</p>
						</div>
						<div className="flex items-center gap-3">
							<Button className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70" onClick={() => setModalOpen(true)}>
								<PlusCircle className="h-4 w-4 mr-2" />
								Nuevo Presupuesto
							</Button>
							<BudgetFormModal open={modalOpen} setOpen={setModalOpen} />
						</div>
					</div>
				</div>
				{/* Resumen de presupuestos */}
				<div className="mb-8">
					<BudgetSummaryCard budgets={budgets} transactions={transactions} />
				</div>
				{/* Lista de presupuestos */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{budgets.map(budget => {
						const category = categories.find(c => c.id === budget.category_id)
						const spent = getBudgetSpent(budget.id)
						const txs = getBudgetTransactions(budget.id)
						return (
							<BudgetCard key={budget.id} budget={budget} category={category} spent={spent} transactions={txs} />
						)
					})}
				</div>
			</div>
		</div>
	)
}
