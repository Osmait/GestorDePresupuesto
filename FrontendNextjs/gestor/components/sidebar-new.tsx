import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { UserNav } from '@/components/user-nav'
import { Search } from '@/components/search'
import { SidebarController } from '@/components/client/sidebar-controller'
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
	Mouse
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
	}
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

// Server Component para NavLink
function NavLink({ item, isExpanded, pathname }: { 
	item: NavItem 
	isExpanded: boolean 
	pathname: string 
}) {
	const isActive = pathname === item.href
	const Icon = item.icon

	return (
		<Link
			href={item.href}
			className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group relative ${
				isActive
					? 'bg-gradient-to-r from-primary/10 to-primary/5 text-primary border border-primary/20 shadow-sm'
					: 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
			} ${!isExpanded && 'justify-center px-2'}`}
		>
			<Icon className={`h-4 w-4 flex-shrink-0 ${isActive && 'text-primary'}`} />
			{isExpanded && (
				<>
					<span className="flex-1 truncate">{item.title}</span>
					{item.badge && (
						<Badge variant="secondary" className="text-xs">
							{item.badge}
						</Badge>
					)}
				</>
			)}
			{!isExpanded && (
				<div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md shadow-lg border opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
					{item.title}
					{item.badge && ` (${item.badge})`}
				</div>
			)}
		</Link>
	)
}

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

// Server Component para la navegación
function SidebarNav({ items, isExpanded, pathname }: { 
	items: NavItem[] 
	isExpanded: boolean 
	pathname: string 
}) {
	return (
		<nav className="flex-1 p-4 space-y-2">
			{items.map((item) => (
				<NavLink 
					key={item.href} 
					item={item} 
					isExpanded={isExpanded} 
					pathname={pathname} 
				/>
			))}
		</nav>
	)
}

// Server Component para el footer del sidebar
function SidebarFooter({ 
	items, 
	isExpanded, 
	pathname, 
	sidebarHoverEnabled, 
	toggleCollapsed 
}: { 
	items: NavItem[] 
	isExpanded: boolean 
	pathname: string 
	sidebarHoverEnabled: boolean
	toggleCollapsed: () => void
}) {
	return (
		<div className="border-t border-border/50 p-4 space-y-2">
			{items.map((item) => (
				<NavLink 
					key={item.href} 
					item={item} 
					isExpanded={isExpanded} 
					pathname={pathname} 
				/>
			))}
			
			<div className="pt-2">
				<Button 
					variant="ghost" 
					size="sm" 
					onClick={toggleCollapsed}
					className={`w-full transition-all duration-200 ${!isExpanded && 'px-2'}`}
				>
					{isExpanded ? (
						<>
							<ChevronLeft className="h-4 w-4 mr-2" />
							Contraer
							{sidebarHoverEnabled && (
								<Mouse className="h-3 w-3 ml-2 opacity-50" />
							)}
						</>
					) : (
						<ChevronRight className="h-4 w-4" />
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

// Componente principal que combina Server y Client Components
export function SidebarNew({ children }: SidebarProps) {
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
							
							<SidebarNav 
								items={navItems} 
								isExpanded={isExpanded} 
								pathname="/app" // TODO: Get actual pathname
							/>
							
							<SidebarFooter 
								items={bottomNavItems}
								isExpanded={isExpanded} 
								pathname="/app" // TODO: Get actual pathname
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