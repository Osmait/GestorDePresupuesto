'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { 
	Bitcoin, 
	TrendingUp, 
	TrendingDown, 
	PlusCircle, 
	Wallet,
	DollarSign,
	BarChart3,
	Coins,
	AlertTriangle,
	Target
} from 'lucide-react'

interface CryptoAsset {
	id: string
	name: string
	symbol: string
	price: number
	priceChange24h: number
	marketCap: number
	volume24h: number
	supply: number
	holdings: number
	value: number
	icon: string
}

interface CryptoCardProps {
	asset: CryptoAsset
}

function LoadingSpinner() {
	return (
		<div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-background to-secondary/20 dark:from-background dark:to-secondary/10">
			<div className="text-center">
				<div className="relative">
					<div className="animate-spin rounded-full h-16 w-16 border-4 border-muted border-t-primary mx-auto"></div>
					<div className="absolute inset-0 rounded-full h-16 w-16 border-4 border-transparent border-t-primary/60 animate-spin mx-auto" style={{animationDelay: '0.3s', animationDuration: '1.2s'}}></div>
				</div>
				<div className="mt-6 text-xl font-semibold text-foreground">Cargando Criptomonedas</div>
				<div className="mt-2 text-sm text-muted-foreground">Preparando tu portafolio cripto...</div>
			</div>
		</div>
	)
}

function CryptoCard({ asset }: CryptoCardProps) {
	const isPositive = asset.priceChange24h > 0
	const profitLoss = (asset.value - (asset.holdings * asset.price)) / (asset.holdings * asset.price) * 100
	
	return (
		<Card className="hover:shadow-lg hover:shadow-primary/5 dark:hover:shadow-primary/10 transition-all duration-300 border-border/50 dark:border-border/20">
			<CardContent className="p-6">
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center space-x-4">
						<div className="p-3 rounded-full bg-gradient-to-br from-orange-500/20 to-yellow-500/20 dark:from-orange-500/10 dark:to-yellow-500/10">
							<span className="text-2xl">{asset.icon}</span>
						</div>
						<div>
							<p className="font-semibold text-foreground text-lg">{asset.name}</p>
							<p className="text-sm text-muted-foreground">{asset.symbol}</p>
						</div>
					</div>
					<Badge variant={isPositive ? "default" : "destructive"} className="flex items-center gap-1">
						{isPositive ? (
							<TrendingUp className="h-3 w-3" />
						) : (
							<TrendingDown className="h-3 w-3" />
						)}
						<span className="text-xs">
							{isPositive ? '+' : ''}{asset.priceChange24h.toFixed(2)}%
						</span>
					</Badge>
				</div>
				
				<div className="space-y-3">
					<div className="flex justify-between items-center">
						<span className="text-sm text-muted-foreground">Precio Actual</span>
						<span className="font-bold text-lg text-foreground">
							${asset.price.toLocaleString()}
						</span>
					</div>
					
					<div className="flex justify-between items-center">
						<span className="text-sm text-muted-foreground">Tenencias</span>
						<span className="font-semibold text-foreground">
							{asset.holdings.toFixed(4)} {asset.symbol}
						</span>
					</div>
					
					<div className="flex justify-between items-center">
						<span className="text-sm text-muted-foreground">Valor Total</span>
						<span className="font-bold text-lg text-foreground">
							${asset.value.toLocaleString()}
						</span>
					</div>
					
					<div className="flex justify-between items-center pt-2 border-t border-border/50">
						<span className="text-xs text-muted-foreground">24h Volumen</span>
						<span className="text-xs text-muted-foreground">
							${(asset.volume24h / 1000000000).toFixed(1)}B
						</span>
					</div>
					
					<div className="flex justify-between items-center">
						<span className="text-xs text-muted-foreground">Cap. Mercado</span>
						<span className="text-xs text-muted-foreground">
							${(asset.marketCap / 1000000000).toFixed(1)}B
						</span>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

function CryptoSummaryCard({ assets }: { assets: CryptoAsset[] }) {
	const totalValue = assets.reduce((sum, asset) => sum + asset.value, 0)
	const totalChange24h = assets.reduce((sum, asset) => sum + (asset.value * asset.priceChange24h / 100), 0)
	const totalChangePercent = totalValue > 0 ? (totalChange24h / totalValue) * 100 : 0
	const assetsInProfit = assets.filter(asset => asset.priceChange24h > 0).length
	
	return (
		<Card className="border-border/50 dark:border-border/20">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-foreground">
					<Coins className="h-5 w-5" />
					Resumen del Portafolio
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
					<div className="text-center p-4 rounded-lg bg-gradient-to-br from-orange-500/10 to-yellow-500/10 dark:from-orange-500/5 dark:to-yellow-500/5">
						<DollarSign className="h-6 w-6 mx-auto mb-2 text-orange-600 dark:text-orange-400" />
						<p className="text-sm font-medium text-muted-foreground">Valor Total</p>
						<p className="text-2xl font-bold text-foreground">${totalValue.toLocaleString()}</p>
					</div>
					<div className="text-center p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-500/10 dark:from-green-500/5 dark:to-emerald-500/5">
						<TrendingUp className="h-6 w-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
						<p className="text-sm font-medium text-muted-foreground">Cambio 24h</p>
						<p className={`text-2xl font-bold ${totalChangePercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
							{totalChangePercent >= 0 ? '+' : ''}${totalChange24h.toLocaleString()}
						</p>
					</div>
					<div className="text-center p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 dark:from-blue-500/5 dark:to-cyan-500/5">
						<BarChart3 className="h-6 w-6 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
						<p className="text-sm font-medium text-muted-foreground">Activos en Positivo</p>
						<p className="text-2xl font-bold text-foreground">{assetsInProfit}</p>
					</div>
					<div className="text-center p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-violet-500/10 dark:from-purple-500/5 dark:to-violet-500/5">
						<Wallet className="h-6 w-6 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
						<p className="text-sm font-medium text-muted-foreground">Total Activos</p>
						<p className="text-2xl font-bold text-foreground">{assets.length}</p>
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

// Mock data para criptomonedas
const mockCryptoAssets: CryptoAsset[] = [
	{
		id: '1',
		name: 'Bitcoin',
		symbol: 'BTC',
		price: 43250,
		priceChange24h: 2.5,
		marketCap: 847000000000,
		volume24h: 15600000000,
		supply: 19600000,
		holdings: 0.0234,
		value: 1012.05,
		icon: '₿'
	},
	{
		id: '2',
		name: 'Ethereum',
		symbol: 'ETH',
		price: 2680,
		priceChange24h: -1.2,
		marketCap: 322000000000,
		volume24h: 8900000000,
		supply: 120000000,
		holdings: 0.5678,
		value: 1521.65,
		icon: '⟠'
	},
	{
		id: '3',
		name: 'Cardano',
		symbol: 'ADA',
		price: 0.52,
		priceChange24h: 4.8,
		marketCap: 18200000000,
		volume24h: 456000000,
		supply: 45000000000,
		holdings: 1250.0,
		value: 650.00,
		icon: '₳'
	},
	{
		id: '4',
		name: 'Solana',
		symbol: 'SOL',
		price: 98.45,
		priceChange24h: -3.1,
		marketCap: 42800000000,
		volume24h: 1200000000,
		supply: 434000000,
		holdings: 3.2,
		value: 315.04,
		icon: '◎'
	},
	{
		id: '5',
		name: 'Polkadot',
		symbol: 'DOT',
		price: 7.83,
		priceChange24h: 1.9,
		marketCap: 10100000000,
		volume24h: 245000000,
		supply: 1290000000,
		holdings: 45.6,
		value: 357.05,
		icon: '⬟'
	},
	{
		id: '6',
		name: 'Chainlink',
		symbol: 'LINK',
		price: 15.67,
		priceChange24h: 0.8,
		marketCap: 8900000000,
		volume24h: 389000000,
		supply: 1000000000,
		holdings: 12.8,
		value: 200.58,
		icon: '🔗'
	}
]

export default function CryptoPage() {
	const [assets, setAssets] = useState<CryptoAsset[]>([])
	const [isLoading, setIsLoading] = useState(true)

	useEffect(() => {
		const loadCryptoData = async () => {
			try {
				console.log('🔄 Cargando datos de criptomonedas mock...')
				// Simular delay de carga (reducido)
				await new Promise(resolve => setTimeout(resolve, 300))
				setAssets(mockCryptoAssets)
				console.log('✅ Datos de criptomonedas cargados exitosamente')
			} catch (error) {
				console.error('❌ Error cargando datos de criptomonedas:', error)
			} finally {
				setIsLoading(false)
			}
		}

		// Add timeout to prevent infinite loading
		const timeoutId = setTimeout(() => {
			console.log('⏰ Timeout en crypto, forzando fin de carga')
			setIsLoading(false)
		}, 5000)

		loadCryptoData().finally(() => {
			clearTimeout(timeoutId)
		})

		return () => clearTimeout(timeoutId)
	}, [])

	if (isLoading) {
		return <LoadingSpinner />
	}

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
								Portafolio Cripto
							</h1>
							<p className="text-muted-foreground mt-2 text-lg">
								Gestiona y supervisa tus inversiones en criptomonedas
							</p>
						</div>
						<div className="flex items-center gap-3">
							<Button variant="outline" className="border-border/50">
								<BarChart3 className="h-4 w-4 mr-2" />
								Análisis
							</Button>
							<Button className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70">
								<PlusCircle className="h-4 w-4 mr-2" />
								Añadir Activo
							</Button>
						</div>
					</div>
				</div>

				{/* Resumen del portafolio */}
				<div className="mb-8">
					<CryptoSummaryCard assets={assets} />
				</div>

				{/* Contenido principal con tabs */}
				<Tabs defaultValue="all" className="space-y-6">
					<TabsList className="grid w-full grid-cols-3 lg:w-auto lg:grid-cols-3 bg-muted/50 dark:bg-muted/30">
						<TabsTrigger value="all" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
							<Coins className="h-4 w-4" />
							<span className="hidden sm:inline">Todos</span>
						</TabsTrigger>
						<TabsTrigger value="profit" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
							<TrendingUp className="h-4 w-4" />
							<span className="hidden sm:inline">En Alza</span>
						</TabsTrigger>
						<TabsTrigger value="decline" className="flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:text-foreground">
							<TrendingDown className="h-4 w-4" />
							<span className="hidden sm:inline">En Baja</span>
						</TabsTrigger>
					</TabsList>

					{/* Tab: Todos los activos */}
					<TabsContent value="all" className="space-y-6">
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{assets.map((asset) => (
								<CryptoCard key={asset.id} asset={asset} />
							))}
						</div>
					</TabsContent>

					{/* Tab: Activos en alza */}
					<TabsContent value="profit" className="space-y-6">
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{profitableAssets.map((asset) => (
								<CryptoCard key={asset.id} asset={asset} />
							))}
						</div>
						{profitableAssets.length === 0 && (
							<Card className="border-border/50 dark:border-border/20">
								<CardContent className="p-8 text-center">
									<TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
									<p className="text-muted-foreground">No hay activos en alza actualmente</p>
								</CardContent>
							</Card>
						)}
					</TabsContent>

					{/* Tab: Activos en baja */}
					<TabsContent value="decline" className="space-y-6">
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{declineAssets.map((asset) => (
								<CryptoCard key={asset.id} asset={asset} />
							))}
						</div>
						{declineAssets.length === 0 && (
							<Card className="border-border/50 dark:border-border/20">
								<CardContent className="p-8 text-center">
									<TrendingUp className="h-12 w-12 mx-auto mb-4 text-green-600 dark:text-green-400" />
									<p className="text-muted-foreground">¡Excelente! No hay activos en baja</p>
								</CardContent>
							</Card>
						)}
					</TabsContent>
				</Tabs>

				{/* Información adicional */}
				<Card className="mt-8 bg-gradient-to-r from-orange-50/50 to-yellow-50/50 dark:from-orange-900/10 dark:to-yellow-900/10 border-orange-200/50 dark:border-orange-800/30">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-orange-900 dark:text-orange-100">
							<Bitcoin className="h-5 w-5" />
							Estadísticas del Portafolio
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
							<div>
								<p className="font-semibold text-orange-800 dark:text-orange-200 mb-2">Valor Total Portafolio:</p>
								<p className="text-orange-700 dark:text-orange-300">
									${assets.reduce((sum, asset) => sum + asset.value, 0).toLocaleString()}
								</p>
							</div>
							<div>
								<p className="font-semibold text-orange-800 dark:text-orange-200 mb-2">Mejor Rendimiento:</p>
								<p className="text-orange-700 dark:text-orange-300">
									{assets.length > 0 
										? assets.reduce((best, asset) => 
											asset.priceChange24h > best.priceChange24h ? asset : best, assets[0]
										).name 
										: 'N/A'
									}
								</p>
							</div>
							<div>
								<p className="font-semibold text-orange-800 dark:text-orange-200 mb-2">Activo Más Valioso:</p>
								<p className="text-orange-700 dark:text-orange-300">
									{assets.length > 0 
										? assets.reduce((most, asset) => 
											asset.value > most.value ? asset : most, assets[0]
										).name 
										: 'N/A'
									}
								</p>
							</div>
							<div>
								<p className="font-semibold text-orange-800 dark:text-orange-200 mb-2">Diversificación:</p>
								<p className="text-orange-700 dark:text-orange-300">
									{assets.length} activos diferentes
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
