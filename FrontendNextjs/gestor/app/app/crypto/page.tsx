import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { 
	Bitcoin, 
	TrendingUp, 
	TrendingDown, 
	DollarSign, 
	BarChart3,
	Zap,
	Shield,
	PieChart,
	Activity
} from 'lucide-react'

interface CryptoAsset {
	id: string
	name: string
	symbol: string
	price: number
	priceChange24h: number
	volume24h: number
	marketCap: number
	holdings: number
	icon: string
}

interface CryptoCardProps {
	asset: CryptoAsset
}

// Datos mock de criptomonedas
const mockCryptoAssets: CryptoAsset[] = [
	{
		id: 'bitcoin',
		name: 'Bitcoin',
		symbol: 'BTC',
		price: 43250.50,
		priceChange24h: 2.45,
		volume24h: 28500000000,
		marketCap: 847000000000,
		holdings: 0.2567,
		icon: '₿'
	},
	{
		id: 'ethereum',
		name: 'Ethereum',
		symbol: 'ETH',
		price: 2650.75,
		priceChange24h: -1.23,
		volume24h: 15200000000,
		marketCap: 318000000000,
		holdings: 2.5834,
		icon: 'Ξ'
	},
	{
		id: 'binancecoin',
		name: 'BNB',
		symbol: 'BNB',
		price: 315.40,
		priceChange24h: 0.87,
		volume24h: 1800000000,
		marketCap: 48500000000,
		holdings: 5.2341,
		icon: '⬡'
	},
	{
		id: 'cardano',
		name: 'Cardano',
		symbol: 'ADA',
		price: 0.485,
		priceChange24h: -3.21,
		volume24h: 420000000,
		marketCap: 17200000000,
		holdings: 1250.75,
		icon: '₳'
	},
	{
		id: 'solana',
		name: 'Solana',
		symbol: 'SOL',
		price: 98.20,
		priceChange24h: 4.12,
		volume24h: 2100000000,
		marketCap: 42800000000,
		holdings: 15.845,
		icon: '◎'
	},
	{
		id: 'polkadot',
		name: 'Polkadot',
		symbol: 'DOT',
		price: 7.32,
		priceChange24h: -0.65,
		volume24h: 185000000,
		marketCap: 9200000000,
		holdings: 68.234,
		icon: '●'
	}
]

// Server Component para LoadingSpinner (no se usa en Server Components)
function LoadingSpinner() {
	return (
		<div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary/20 dark:from-background dark:to-secondary/10">
			<div className="text-center">
				<div className="relative">
					<div className="animate-spin rounded-full h-16 w-16 border-4 border-muted border-t-primary mx-auto"></div>
					<div className="absolute inset-0 rounded-full h-16 w-16 border-4 border-transparent border-t-primary/60 animate-spin mx-auto" style={{animationDelay: '0.3s', animationDuration: '1.2s'}}></div>
				</div>
				<div className="mt-6 text-xl font-semibold text-foreground">Cargando Criptomonedas</div>
				<div className="mt-2 text-sm text-muted-foreground">Conectando con el mercado crypto...</div>
			</div>
		</div>
	)
}

// Server Component para CryptoCard
function CryptoCard({ asset }: CryptoCardProps) {
	const isPositive = asset.priceChange24h > 0
	const totalValue = asset.price * asset.holdings
	
	return (
		<Card className="hover:shadow-lg hover:shadow-primary/5 dark:hover:shadow-primary/10 transition-all duration-300 border-border/50 dark:border-border/20">
			<CardContent className="p-6">
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center space-x-4">
						<div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-500/20 to-yellow-500/20 dark:from-orange-500/10 dark:to-yellow-500/10 flex items-center justify-center text-2xl font-bold">
							{asset.icon}
						</div>
						<div>
							<p className="font-semibold text-foreground text-lg">{asset.name}</p>
							<p className="text-sm text-muted-foreground">{asset.symbol}</p>
						</div>
					</div>
					<div className="text-right">
						<p className="font-bold text-xl text-foreground">
							${asset.price.toLocaleString()}
						</p>
						<div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
							{isPositive ? (
								<TrendingUp className="h-3 w-3" />
							) : (
								<TrendingDown className="h-3 w-3" />
							)}
							{Math.abs(asset.priceChange24h).toFixed(2)}%
						</div>
					</div>
				</div>
				
				<div className="space-y-3 pt-3 border-t border-border/50">
					<div className="flex justify-between items-center">
						<span className="text-sm text-muted-foreground">Holdings</span>
						<span className="font-medium text-foreground">
							{asset.holdings.toFixed(4)} {asset.symbol}
						</span>
					</div>
					
					<div className="flex justify-between items-center">
						<span className="text-sm text-muted-foreground">Valor Total</span>
						<span className="font-bold text-lg text-foreground">
							${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
						</span>
					</div>
					
					<div className="flex justify-between items-center">
						<span className="text-sm text-muted-foreground">Market Cap</span>
						<span className="text-sm text-muted-foreground">
							${(asset.marketCap / 1000000000).toFixed(1)}B
						</span>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

// Server Component para CryptoSummaryCard
function CryptoSummaryCard({ assets }: { assets: CryptoAsset[] }) {
	const totalPortfolioValue = assets.reduce((sum, asset) => sum + (asset.price * asset.holdings), 0)
	const totalGainLoss = assets.reduce((sum, asset) => {
		const currentValue = asset.price * asset.holdings
		const change = (asset.priceChange24h / 100) * currentValue
		return sum + change
	}, 0)
	const profitableAssets = assets.filter(asset => asset.priceChange24h > 0).length
	
	return (
		<Card className="border-border/50 dark:border-border/20">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-foreground">
					<Bitcoin className="h-5 w-5" />
					Resumen del Portfolio
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div className="text-center p-4 rounded-lg bg-gradient-to-br from-orange-500/10 to-yellow-500/10 dark:from-orange-500/5 dark:to-yellow-500/5">
						<DollarSign className="h-6 w-6 mx-auto mb-2 text-orange-600 dark:text-orange-400" />
						<p className="text-sm font-medium text-muted-foreground">Valor Total</p>
						<p className="text-2xl font-bold text-foreground">
							${totalPortfolioValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
						</p>
					</div>
					<div className={`text-center p-4 rounded-lg bg-gradient-to-br ${totalGainLoss >= 0 ? 'from-green-500/10 to-emerald-500/10 dark:from-green-500/5 dark:to-emerald-500/5' : 'from-red-500/10 to-rose-500/10 dark:from-red-500/5 dark:to-rose-500/5'}`}>
						{totalGainLoss >= 0 ? (
							<TrendingUp className="h-6 w-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
						) : (
							<TrendingDown className="h-6 w-6 mx-auto mb-2 text-red-600 dark:text-red-400" />
						)}
						<p className="text-sm font-medium text-muted-foreground">Ganancia/Pérdida 24h</p>
						<p className={`text-2xl font-bold ${totalGainLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
							${totalGainLoss >= 0 ? '+' : ''}${totalGainLoss.toLocaleString(undefined, { maximumFractionDigits: 2 })}
						</p>
					</div>
					<div className="text-center p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 dark:from-blue-500/5 dark:to-cyan-500/5">
						<Activity className="h-6 w-6 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
						<p className="text-sm font-medium text-muted-foreground">Assets en Positivo</p>
						<p className="text-2xl font-bold text-foreground">{profitableAssets}/{assets.length}</p>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

// Componente principal - Server Component que simula carga de datos
export default async function CryptoPage() {
	// Simular delay de carga en el servidor (opcional para Server Components)
	// await new Promise(resolve => setTimeout(resolve, 100))
	
	// En un caso real, aquí cargarías datos de una API externa
	const assets = mockCryptoAssets

	const profitableAssets = assets.filter(asset => asset.priceChange24h > 0)
	const declineAssets = assets.filter(asset => asset.priceChange24h < 0)

	return (
		<div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20">
			<div className="container mx-auto px-4 py-8">
				{/* Header */}
				<div className="mb-8">
					<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
						<div>
							<h1 className="text-4xl font-bold bg-gradient-to-r from-foreground via-primary to-primary bg-clip-text text-transparent">
								Portfolio de Criptomonedas
							</h1>
							<p className="text-muted-foreground mt-2 text-lg">
								Monitorea y gestiona tus inversiones en criptomonedas
							</p>
						</div>
						<div className="flex items-center gap-3">
							<Button variant="outline" className="border-border/50">
								<BarChart3 className="h-4 w-4 mr-2" />
								Análisis
							</Button>
							<Button className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70">
								<Zap className="h-4 w-4 mr-2" />
								Trading
							</Button>
						</div>
					</div>
				</div>

				{/* Resumen del portfolio */}
				<div className="mb-8">
					<CryptoSummaryCard assets={assets} />
				</div>

				{/* Contenido principal con tabs */}
				<Tabs defaultValue="all" className="space-y-6">
					<TabsList className="grid w-full grid-cols-3 lg:w-auto lg:grid-cols-3 bg-muted/50 dark:bg-muted/30">
						<TabsTrigger value="all" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
							<PieChart className="h-4 w-4" />
							<span className="hidden sm:inline">Todo</span>
						</TabsTrigger>
						<TabsTrigger value="gainers" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
							<TrendingUp className="h-4 w-4" />
							<span className="hidden sm:inline">Ganadores</span>
						</TabsTrigger>
						<TabsTrigger value="losers" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
							<TrendingDown className="h-4 w-4" />
							<span className="hidden sm:inline">Perdedores</span>
						</TabsTrigger>
					</TabsList>

					<TabsContent value="all" className="space-y-6">
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{assets.map((asset) => (
								<CryptoCard key={asset.id} asset={asset} />
							))}
						</div>
					</TabsContent>

					<TabsContent value="gainers" className="space-y-6">
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{profitableAssets.map((asset) => (
								<CryptoCard key={asset.id} asset={asset} />
							))}
						</div>
					</TabsContent>

					<TabsContent value="losers" className="space-y-6">
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{declineAssets.map((asset) => (
								<CryptoCard key={asset.id} asset={asset} />
							))}
						</div>
					</TabsContent>
				</Tabs>

				{/* Información de desarrollo */}
				<Card className="mt-8 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 border-blue-200/50 dark:border-blue-800/30">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
							<Bitcoin className="h-5 w-5" />
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
									<Badge variant="outline" className="bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-400">
										⚡ Mock data (desarrollo)
									</Badge>
								</div>
							</div>
							<div>
								<p className="font-semibold text-blue-800 dark:text-blue-200 mb-3">Datos Disponibles:</p>
								<div className="space-y-2">
									<Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-400">
										₿ {assets.length} criptomonedas
									</Badge>
									<Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-400">
										📈 {profitableAssets.length} en positivo
									</Badge>
									<Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-400">
										📉 {declineAssets.length} en negativo
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
