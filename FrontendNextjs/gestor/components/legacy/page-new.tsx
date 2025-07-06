import { Card, CardContent, CardHeader, CardTitle } from '@/components/common/ui/card'
import { Badge } from '@/components/common/ui/badge'
import { Button } from '@/components/common/ui/button'
import { AccountsDataLoader } from '@/components/common/client/accounts-data-loader'
import { TabsController } from '@/components/common/client/tabs-controller'
import { Account } from '@/types/account'
import { 
	CreditCard,
	DollarSign,
	TrendingUp,
	Building,
	Wallet,
	PlusCircle
} from 'lucide-react'

interface AccountCardProps {
	account: Account
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
				<div className="mt-6 text-xl font-semibold text-foreground">Cargando Cuentas</div>
				<div className="mt-2 text-sm text-muted-foreground">Preparando tus cuentas financieras...</div>
			</div>
		</div>
	)
}

// Server Component para AccountCard
function AccountCard({ account }: AccountCardProps) {
	const isPositive = account.balance > 0

	return (
		<Card className="border-border/50 dark:border-border/20 hover:shadow-lg dark:hover:shadow-lg/25 transition-all duration-200">
			<CardContent className="p-6">
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="w-12 h-12 bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 rounded-lg flex items-center justify-center">
								<CreditCard className="h-5 w-5 text-primary" />
							</div>
							<div>
								<h3 className="font-semibold text-foreground">{account.name_account}</h3>
								<p className="text-sm text-muted-foreground">{account.bank}</p>
							</div>
						</div>
						<div className="text-right">
							{isPositive ? (
								<TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
							) : (
								<TrendingUp className="h-5 w-5 text-red-600 dark:text-red-400 rotate-180" />
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

// Server Component para AccountSummaryCard
function AccountSummaryCard({ accounts }: { accounts: Account[] }) {
	const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0)
	const positiveAccounts = accounts.filter(account => account.balance > 0)
	
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

// Server Component para el header
function AccountsHeader() {
	return (
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
	)
}

// Server Component para información adicional
function AccountsInfo({ accounts }: { accounts: Account[] }) {
	return (
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
	)
}

// Componente principal - Server Component que usa AccountsDataLoader
export default function AccountsPageNew() {
	return (
		<AccountsDataLoader>
			{({ accounts, isLoading, error }) => {
				if (isLoading) {
					return <LoadingSpinner />
				}

				if (error) {
					return (
						<div className="flex items-center justify-center min-h-screen">
							<div className="text-center">
								<h2 className="text-xl font-semibold text-red-600 mb-2">Error al cargar cuentas</h2>
								<p className="text-muted-foreground">{error}</p>
							</div>
						</div>
					)
				}

				// Preparar tabs para el TabsController
				const tabs = [
					{
						value: 'all',
						label: 'Todas',
						icon: <Wallet className="h-4 w-4" />,
						content: (
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
								{accounts.map((account) => (
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
								{accounts.filter(account => account.balance > 0).map((account) => (
									<AccountCard key={account.id} account={account} />
								))}
							</div>
						)
					},
					{
						value: 'banks',
						label: 'Por Banco',
						icon: <Building className="h-4 w-4" />,
						content: (
							<div className="space-y-6">
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
							</div>
						)
					}
				]

				return (
					<div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20">
						<div className="container mx-auto px-4 py-8">
							<AccountsHeader />
							
							{/* Resumen de cuentas */}
							<div className="mb-8">
								<AccountSummaryCard accounts={accounts} />
							</div>

							{/* Contenido principal con tabs */}
							<TabsController 
								tabs={tabs}
								defaultValue="all"
								className="space-y-6"
								listClassName="grid w-full grid-cols-3 lg:w-auto lg:grid-cols-3 bg-muted/50 dark:bg-muted/30"
							/>

							{/* Información adicional */}
							<AccountsInfo accounts={accounts} />
						</div>
					</div>
				)
			}}
		</AccountsDataLoader>
	)
} 