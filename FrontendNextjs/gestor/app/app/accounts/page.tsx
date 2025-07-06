'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { getAccountRepository } from '@/lib/repositoryConfig'
import { Account } from '@/types/account'
import { 
	CreditCard, 
	DollarSign, 
	PlusCircle, 
	Building, 
	TrendingUp,
	Wallet,
	ArrowUpRight,
	ArrowDownRight,
	MoreHorizontal
} from 'lucide-react'

interface AccountCardProps {
	account: Account
}

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

function AccountCard({ account }: AccountCardProps) {
	const isPositive = account.balance > 0
	
	return (
		<Card className="hover:shadow-lg hover:shadow-primary/5 dark:hover:shadow-primary/10 transition-all duration-300 border-border/50 dark:border-border/20">
			<CardContent className="p-6">
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center space-x-4">
						<Avatar className="h-14 w-14 border-2 border-primary/20">
							<AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-primary-foreground font-semibold text-lg">
								{account.name_account.charAt(0).toUpperCase()}
							</AvatarFallback>
						</Avatar>
						<div>
							<p className="font-semibold text-foreground text-lg">{account.name_account}</p>
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
								${account.balance.toLocaleString()}
							</span>
						</div>
					</div>
					
					<div className="flex justify-between items-center pt-2 border-t border-border/50">
						<span className="text-xs text-muted-foreground">USD</span>
						<Badge variant="outline" className="bg-muted/30 dark:bg-muted/20">
							{account.balance > 10000 ? 'Alto' : account.balance > 5000 ? 'Medio' : 'Bajo'}
						</Badge>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

function AccountSummaryCard({ accounts }: { accounts: Account[] }) {
	const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0)
	const positiveAccounts = accounts.filter(account => account.balance > 0)
	const negativeAccounts = accounts.filter(account => account.balance < 0)
	
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
						<p className="text-2xl font-bold text-foreground">{positiveAccounts.length}</p>
					</div>
					<div className="text-center p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-violet-500/10 dark:from-purple-500/5 dark:to-violet-500/5">
						<CreditCard className="h-6 w-6 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
						<p className="text-sm font-medium text-muted-foreground">Total Cuentas</p>
						<p className="text-2xl font-bold text-foreground">{accounts.length}</p>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

export default function AccountsPage() {
	const [accounts, setAccounts] = useState<Account[]>([])
	const [isLoading, setIsLoading] = useState(true)

	useEffect(() => {
		const loadAccounts = async () => {
			try {
				console.log('🔄 Cargando cuentas mock...')
				const accountRepository = await getAccountRepository()
				const accountsData = await accountRepository.findAll()
				setAccounts(accountsData)
				console.log('✅ Cuentas cargadas exitosamente')
			} catch (error) {
				console.error('❌ Error cargando cuentas:', error)
			} finally {
				setIsLoading(false)
			}
		}

		// Add timeout to prevent infinite loading
		const timeoutId = setTimeout(() => {
			console.log('⏰ Timeout en cuentas, forzando fin de carga')
			setIsLoading(false)
		}, 5000)

		loadAccounts().finally(() => {
			clearTimeout(timeoutId)
		})

		return () => clearTimeout(timeoutId)
	}, [])

	if (isLoading) {
		return <LoadingSpinner />
	}

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
							<Button className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70">
								<PlusCircle className="h-4 w-4 mr-2" />
								Nueva Cuenta
							</Button>
						</div>
					</div>
				</div>

				{/* Resumen de cuentas */}
				<div className="mb-8">
					<AccountSummaryCard accounts={accounts} />
				</div>

				{/* Contenido principal con tabs */}
				<Tabs defaultValue="all" className="space-y-6">
					<TabsList className="grid w-full grid-cols-3 lg:w-auto lg:grid-cols-3 bg-muted/50 dark:bg-muted/30">
						<TabsTrigger value="all" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
							<Wallet className="h-4 w-4" />
							<span className="hidden sm:inline">Todas</span>
						</TabsTrigger>
						<TabsTrigger value="positive" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
							<TrendingUp className="h-4 w-4" />
							<span className="hidden sm:inline">Positivas</span>
						</TabsTrigger>
						<TabsTrigger value="banks" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
							<Building className="h-4 w-4" />
							<span className="hidden sm:inline">Por Banco</span>
						</TabsTrigger>
					</TabsList>

					{/* Tab: Todas las cuentas */}
					<TabsContent value="all" className="space-y-6">
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{accounts.map((account) => (
								<AccountCard key={account.id} account={account} />
							))}
						</div>
					</TabsContent>

					{/* Tab: Cuentas positivas */}
					<TabsContent value="positive" className="space-y-6">
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{accounts.filter(account => account.balance > 0).map((account) => (
								<AccountCard key={account.id} account={account} />
							))}
						</div>
					</TabsContent>

					{/* Tab: Por banco */}
					<TabsContent value="banks" className="space-y-6">
						{Array.from(new Set(accounts.map(account => account.bank))).map((bank) => (
							<Card key={bank} className="border-border/50 dark:border-border/20">
								<CardHeader>
									<CardTitle className="flex items-center gap-2 text-foreground">
										<Building className="h-5 w-5" />
										{bank}
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
										{accounts.filter(account => account.bank === bank).map((account) => (
											<AccountCard key={account.id} account={account} />
										))}
									</div>
								</CardContent>
							</Card>
						))}
					</TabsContent>
				</Tabs>

				{/* Información adicional */}
				<Card className="mt-8 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 border-blue-200/50 dark:border-blue-800/30">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
							<CreditCard className="h-5 w-5" />
							Información de Cuentas
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
							<div>
								<p className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Total de Cuentas:</p>
								<p className="text-blue-700 dark:text-blue-300">{accounts.length} cuentas activas</p>
							</div>
							<div>
								<p className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Balance Promedio:</p>
								<p className="text-blue-700 dark:text-blue-300">
									${accounts.length > 0 ? Math.round(accounts.reduce((sum, acc) => sum + acc.balance, 0) / accounts.length).toLocaleString() : 0}
								</p>
							</div>
							<div>
								<p className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Bancos Únicos:</p>
								<p className="text-blue-700 dark:text-blue-300">
									{Array.from(new Set(accounts.map(acc => acc.bank))).length} bancos diferentes
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
