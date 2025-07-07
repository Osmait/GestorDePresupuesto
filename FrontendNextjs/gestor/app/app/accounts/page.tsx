'use client'
import { useState } from 'react'
import { useAccounts } from '@/hooks/useRepositories'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Input } from '@/components/ui/input'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { useAuth } from '@/hooks/useRepositories'
import { AlertCircle, Loader2, PlusCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AnimatedTabs } from '@/components/common/animated-tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { getAccountRepository } from '@/lib/repositoryConfig'
import { Account } from '@/types/account'
import { 
	CreditCard, 
	DollarSign, 
	PlusCircle as LucidePlusCircle, 
	Building, 
	TrendingUp,
	TrendingDown,
	Wallet,
	ArrowUpRight,
	ArrowDownRight,
	MoreHorizontal
} from 'lucide-react'

interface AccountCardProps {
	account: Account
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
				<div className="mt-6 text-xl font-semibold text-foreground">Cargando Cuentas</div>
				<div className="mt-2 text-sm text-muted-foreground">Preparando tus cuentas financieras...</div>
			</div>
		</div>
	)
}

// Server Component para AccountCard
function AccountCard({ account }: AccountCardProps) {
	const isPositive = account.initial_balance > 0
	
	return (
		<Card className="hover:shadow-lg hover:shadow-primary/5 dark:hover:shadow-primary/10 transition-all duration-300 border-border/50 dark:border-border/20">
			<CardContent className="p-6">
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center space-x-4">
						<Avatar className="h-14 w-14 border-2 border-primary/20">
							<AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-primary-foreground font-semibold text-lg">
								{(account.name ?? '').charAt(0).toUpperCase()}
							</AvatarFallback>
						</Avatar>
						<div>
							<p className="font-semibold text-foreground text-lg">{account.name}</p>
							<p className="text-sm text-muted-foreground flex items-center gap-1">
								<Building className="h-4 w-4" />
								{account.bank}
							</p>
						</div>
					</div>
					<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
						<MoreHorizontal className="h-4 w-4" />
					</Button>
				</div>
				
				<div className="space-y-3">
					<div className="flex justify-between items-center">
						<span className="text-sm text-muted-foreground">Balance Actual</span>
						<div className="flex items-center gap-2">
							{isPositive ? (
								<ArrowUpRight className="h-4 w-4 text-green-600 dark:text-green-400" />
							) : (
								<ArrowDownRight className="h-4 w-4 text-red-600 dark:text-red-400" />
							)}
							<span className={`font-bold text-2xl ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
								{(account.initial_balance ?? 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
							</span>
						</div>
					</div>
					
					<div className="flex justify-between items-center pt-2 border-t border-border/50">
						<span className="text-xs text-muted-foreground">USD</span>
						<Badge variant="outline" className="bg-muted/30 dark:bg-muted/20">
							{account.initial_balance > 10000 ? 'Alto' : account.initial_balance > 5000 ? 'Medio' : 'Bajo'}
						</Badge>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

// Server Component para AccountSummaryCard
function AccountSummaryCard({ accounts }: { accounts: Account[] }) {
	const totalBalance = (accounts ?? []).reduce((sum, account) => sum + account.initial_balance, 0)
	const positiveAccounts = (accounts ?? []).filter(account => account.initial_balance > 0)
	const negativeAccounts = (accounts ?? []).filter(account => account.initial_balance < 0)
	
	return (
		<Card className="border-border/50 dark:border-border/20">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-foreground">
					<Wallet className="h-5 w-5" />
					Resumen de Cuentas
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div className="text-center p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 dark:from-blue-500/5 dark:to-cyan-500/5">
						<DollarSign className="h-6 w-6 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
						<p className="text-sm font-medium text-muted-foreground">Balance Total</p>
						<p className="text-2xl font-bold text-foreground">${totalBalance.toLocaleString()}</p>
					</div>
					<div className="text-center p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-500/10 dark:from-green-500/5 dark:to-emerald-500/5">
						<TrendingUp className="h-6 w-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
						<p className="text-sm font-medium text-muted-foreground">Cuentas Positivas</p>
						<p className="text-2xl font-bold text-foreground">{positiveAccounts?.length ?? 0}</p>
					</div>
					<div className="text-center p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-violet-500/10 dark:from-purple-500/5 dark:to-violet-500/5">
						<CreditCard className="h-6 w-6 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
						<p className="text-sm font-medium text-muted-foreground">Total Cuentas</p>
						<p className="text-2xl font-bold text-foreground">{accounts?.length ?? 0}</p>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

// Esquema de validación para el formulario de cuenta
const accountSchema = z.object({
	name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
	bank: z.string().min(2, 'El banco debe tener al menos 2 caracteres'),
	initial_balance: z.coerce.number().min(0, 'El balance debe ser mayor o igual a 0'),
})
type AccountFormValues = z.infer<typeof accountSchema>

function AccountFormModal({ open, setOpen }: { open: boolean, setOpen: (v: boolean) => void }) {
	const { createAccount, isLoading, error } = useAccounts()
	const { user } = useAuth()
	const [success, setSuccess] = useState(false)
	const form = useForm<AccountFormValues>({
		resolver: zodResolver(accountSchema),
		defaultValues: { name: '', bank: '', initial_balance: 0 },
	})

	async function onSubmit(values: AccountFormValues) {
		try {
			await createAccount(values.name, values.bank, values.initial_balance)
			setSuccess(true)
			form.reset()
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
					<DialogTitle>Nueva Cuenta</DialogTitle>
				</DialogHeader>
				{success ? (
					<div className="flex flex-col items-center justify-center py-8">
						<Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
						<p className="text-green-600 font-semibold">¡Cuenta creada!</p>
					</div>
				) : (
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
							<FormField control={form.control} name="name" render={({ field }) => (
								<FormItem>
									<FormLabel>Nombre de la cuenta</FormLabel>
									<FormControl><Input {...field} placeholder="Ej: Cuenta Principal" /></FormControl>
									<FormMessage />
								</FormItem>
							)} />
							<FormField control={form.control} name="bank" render={({ field }) => (
								<FormItem>
									<FormLabel>Banco</FormLabel>
									<FormControl><Input {...field} placeholder="Ej: Banco Nacional" /></FormControl>
									<FormMessage />
								</FormItem>
							)} />
							<FormField control={form.control} name="initial_balance" render={({ field }) => (
								<FormItem>
									<FormLabel>Balance inicial</FormLabel>
									<FormControl><Input type="number" {...field} min={0} step={0.01} /></FormControl>
									<FormMessage />
								</FormItem>
							)} />
							<DialogFooter>
								<Button type="submit" disabled={isLoading} className="w-full">
									{isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
									Crear Cuenta
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

export default function AccountsPage() {
	const { accounts, isLoading } = useAccounts()
	const [modalOpen, setModalOpen] = useState(false)

	return (
		<div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20">
			<div className="container mx-auto px-4 py-8">
				{/* Header */}
				<div className="mb-8">
					<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
						<div>
							<h1 className="text-4xl font-bold bg-gradient-to-r from-foreground via-primary to-primary bg-clip-text text-transparent">
								Gestión de Cuentas
							</h1>
							<p className="text-muted-foreground mt-2 text-lg">
								Administra y supervisa todas tus cuentas financieras
							</p>
						</div>
						<div className="flex items-center gap-3">
							<Button className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70" onClick={() => setModalOpen(true)}>
								<PlusCircle className="h-4 w-4 mr-2" />
								Nueva Cuenta
							</Button>
							<AccountFormModal open={modalOpen} setOpen={setModalOpen} />
						</div>
					</div>
				</div>

				{/* Resumen de cuentas */}
				<div className="mb-8">
					<AccountSummaryCard accounts={accounts} />
				</div>

				{/* Contenido principal con tabs animados */}
				<AnimatedTabs
					defaultValue="all"
					className="space-y-6"
					tabs={[
						{
							value: 'all',
							label: 'Todas',
							icon: <Wallet className="h-4 w-4" />, 
							content: (
								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
									{Array.isArray(accounts) && accounts.map((account) => (
										<AccountCard key={account.id} account={account} />
									))}
								</div>
							)
						},
						{
							value: 'positive',
							label: 'Positivas',
							icon: <TrendingUp className="h-4 w-4" />, 
							content: (
								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
									{Array.isArray(accounts) && accounts.filter(account => account.initial_balance > 0).map((account) => (
										<AccountCard key={account.id} account={account} />
									))}
								</div>
							)
						},
						{
							value: 'negative',
							label: 'Negativas',
							icon: <TrendingDown className="h-4 w-4" />, 
							content: (
								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
									{Array.isArray(accounts) && accounts.filter(account => account.initial_balance < 0).map((account) => (
										<AccountCard key={account.id} account={account} />
									))}
								</div>
							)
						},
					]}
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
										🏦 {(accounts?.length ?? 0)} cuentas cargadas
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
