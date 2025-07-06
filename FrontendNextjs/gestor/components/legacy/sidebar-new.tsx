'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { UserNav } from '@/components/common/user-nav'
import { Search } from '@/components/common/search'
import { SidebarController } from '@/components/common/sidebar-controller'
import { AnimatedSidebarNav } from '@/components/common/sidebar-nav-animated'
import { 
	LayoutDashboard,
	CreditCard,
	ArrowUpDown,
	Tags,
	Bitcoin,
	PiggyBank,
	Menu,
	X,
	ChevronLeft,
	ChevronRight,
	Home,
	Settings,
	HelpCircle,
	Bell,
	Plus,
	Mouse,
	BarChart
} from 'lucide-react'

interface SidebarProps {
	children: React.ReactNode
}

interface NavItem {
	title: string
	href: string
	icon: React.ComponentType<{ className?: string }>
	badge?: string
	description: string
}

const navItems: NavItem[] = [
	{
		title: 'Dashboard',
		href: '/app',
		icon: LayoutDashboard,
		description: 'Vista general del sistema'
	},
	{
		title: 'Cuentas',
		href: '/app/accounts',
		icon: CreditCard,
		description: 'Gestión de cuentas bancarias'
	},
	{
		title: 'Transacciones',
		href: '/app/transactions',
		icon: ArrowUpDown,
		description: 'Historial de movimientos'
	},
	{
		title: 'Categorías',
		href: '/app/category',
		icon: Tags,
		description: 'Organización de gastos'
	},
	{
		title: 'Presupuestos',
		href: '/app/budget',
		icon: PiggyBank,
		description: 'Planificación financiera'
	},
	{
		title: 'Crypto',
		href: '/app/crypto',
		icon: Bitcoin,
		badge: 'Beta',
		description: 'Portafolio de criptomonedas'
	},
	{
		title: 'Analíticas',
		href: '/app/analysis',
		icon: BarChart,
		description: 'Visualización y reportes',
	},
]

const bottomNavItems: NavItem[] = [
	{
		title: 'Configuración',
		href: '/app/settings',
		icon: Settings,
		description: 'Ajustes del sistema'
	},
	{
		title: 'Ayuda',
		href: '/app/help',
		icon: HelpCircle,
		description: 'Soporte y documentación'
	}
]



// Server Component para el header del sidebar
function SidebarHeader({ isExpanded }: { isExpanded: boolean }) {
	return (
		<div className={`flex items-center gap-3 p-4 border-b border-border/50 ${!isExpanded && 'justify-center'}`}>
			{isExpanded && (
				<div className="flex items-center gap-2">
					<div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center">
						<Home className="h-4 w-4 text-primary-foreground" />
					</div>
					<div>
						<h2 className="text-lg font-semibold text-foreground">FinanceApp</h2>
						<p className="text-xs text-muted-foreground">Gestor Personal</p>
					</div>
				</div>
			)}
			{!isExpanded && (
				<div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center">
					<Home className="h-4 w-4 text-primary-foreground" />
				</div>
			)}
		</div>
	)
}

// Wrapper para la navegación animada
function SidebarNavWrapper({ items, isExpanded, onMobileClose }: { 
	items: NavItem[] 
	isExpanded: boolean 
	onMobileClose?: () => void
}) {
	return (
		<nav className="flex-1 p-4 space-y-2">
			<AnimatedSidebarNav 
				items={items}
				isExpanded={isExpanded}
				onMobileClose={onMobileClose}
			/>
		</nav>
	)
}

// Server Component para el footer del sidebar
function SidebarFooter({ 
	items, 
	isExpanded, 
	sidebarHoverEnabled, 
	toggleCollapsed 
}: { 
	items: NavItem[] 
	isExpanded: boolean 
	sidebarHoverEnabled: boolean
	toggleCollapsed: () => void
}) {
	return (
		<div className="border-t border-border/50 p-4 space-y-2">
			<AnimatedSidebarNav 
				items={items}
				isExpanded={isExpanded}
			/>
			
			<div className="pt-2">
				<Button 
					variant="ghost" 
					size="sm" 
					onClick={toggleCollapsed}
					className={`w-full transition-all duration-300 ${!isExpanded && 'px-2'} group`}
				>
					{isExpanded ? (
						<>
							<ChevronLeft className="h-4 w-4 mr-2 transition-all duration-200 group-hover:scale-110" />
							<span className="transition-all duration-200 group-hover:translate-x-1">Contraer</span>
							{sidebarHoverEnabled && (
								<Mouse className="h-3 w-3 ml-2 opacity-50 transition-all duration-200 group-hover:opacity-100" />
							)}
						</>
					) : (
						<ChevronRight className="h-4 w-4 transition-all duration-200 group-hover:scale-110 group-hover:translate-x-1" />
					)}
				</Button>
			</div>
		</div>
	)
}

// Server Component para el header principal
function MainHeader({ isExpanded, toggleMobile }: { 
	isExpanded: boolean 
	toggleMobile: () => void 
}) {
	return (
		<header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-lg">
			<div className="flex h-16 items-center justify-between px-4 lg:px-6">
				<div className="flex items-center gap-4">
					<Button
						variant="ghost"
						size="sm"
						onClick={toggleMobile}
						className="lg:hidden"
					>
						<Menu className="h-4 w-4" />
					</Button>
					
					{isExpanded && (
						<div>
							<h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
							<p className="text-sm text-muted-foreground">Panel de control financiero</p>
						</div>
					)}
				</div>
				
				<div className="flex items-center gap-4">
					<Search />
					
					<div className="flex items-center gap-2">
						<Button variant="ghost" size="sm">
							<Bell className="h-4 w-4" />
						</Button>
						<Button variant="ghost" size="sm">
							<Plus className="h-4 w-4" />
						</Button>
					</div>
					
					<UserNav />
				</div>
			</div>
		</header>
	)
}

// Componente principal que combina Client Components
export function SidebarNew({ children }: SidebarProps) {
	const pathname = usePathname()

	return (
		<SidebarController>
			{({
				isMobileOpen,
				isExpanded,
				sidebarHoverEnabled,
				toggleCollapsed,
				toggleMobile,
				handleMouseEnter,
				handleMouseLeave,
				getSidebarClassName
			}) => (
				<div className="flex h-screen bg-background">
					{/* Mobile Overlay */}
					{isMobileOpen && (
						<div 
							className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
							onClick={toggleMobile}
						/>
					)}

					{/* Sidebar */}
					<aside
						className={getSidebarClassName()}
						onMouseEnter={handleMouseEnter}
						onMouseLeave={handleMouseLeave}
					>
						<div className="flex h-full flex-col">
							<SidebarHeader isExpanded={isExpanded} />
							
							<SidebarNavWrapper 
								items={navItems} 
								isExpanded={isExpanded} 
								onMobileClose={toggleMobile}
							/>
							
							<SidebarFooter 
								items={bottomNavItems}
								isExpanded={isExpanded} 
								sidebarHoverEnabled={sidebarHoverEnabled}
								toggleCollapsed={toggleCollapsed}
							/>
						</div>
					</aside>

					{/* Main content */}
					<div className="flex-1 flex flex-col min-w-0">
						<MainHeader 
							isExpanded={isExpanded} 
							toggleMobile={toggleMobile} 
						/>
						
						<main className="flex-1 overflow-auto">
							{children}
						</main>
					</div>
				</div>
			)}
		</SidebarController>
	)
} 