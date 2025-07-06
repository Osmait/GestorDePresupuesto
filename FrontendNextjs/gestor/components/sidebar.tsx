'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UserNav } from '@/components/user-nav'
import { Search } from '@/components/search'
import { useSettings } from '../contexts'
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

export function Sidebar({ children }: SidebarProps) {
	const [isCollapsed, setIsCollapsed] = useState(false)
	const [isMobileOpen, setIsMobileOpen] = useState(false)
	const [isHovered, setIsHovered] = useState(false)
	const pathname = usePathname()
	const { sidebarHoverEnabled } = useSettings()

	const toggleCollapsed = () => {
		setIsCollapsed(!isCollapsed)
	}

	const toggleMobile = () => {
		setIsMobileOpen(!isMobileOpen)
	}

	const handleMouseEnter = () => {
		if (sidebarHoverEnabled && isCollapsed) {
			// Small delay to prevent accidental expansion
			setTimeout(() => {
				setIsHovered(true)
			}, 100)
		}
	}

	const handleMouseLeave = () => {
		if (sidebarHoverEnabled && isCollapsed) {
			setIsHovered(false)
		}
	}

	// Determine if sidebar should be expanded (either not collapsed or hovered)
	const isExpanded = !isCollapsed || (isCollapsed && isHovered && sidebarHoverEnabled)

	const NavLink = ({ item }: { item: NavItem }) => {
		const isActive = pathname === item.href
		const Icon = item.icon

		return (
			<Link
				href={item.href}
				onClick={() => setIsMobileOpen(false)}
				className={cn(
					'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group relative',
					isActive
						? 'bg-gradient-to-r from-primary/10 to-primary/5 text-primary border border-primary/20 shadow-sm'
						: 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
					!isExpanded && 'justify-center px-2'
				)}
			>
				<Icon className={cn('h-4 w-4 flex-shrink-0', isActive && 'text-primary')} />
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

	return (
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
				className={cn(
					'fixed left-0 top-0 z-50 h-full bg-gradient-to-b from-background via-background to-muted/20 border-r border-border/50 transition-all duration-300 lg:relative lg:translate-x-0',
					isExpanded ? 'w-64' : 'w-16',
					isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
				)}
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
			>
				<div className="flex h-full flex-col">
					{/* Header */}
					<div className={cn('flex items-center gap-3 p-4 border-b border-border/50', !isExpanded && 'justify-center')}>
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

					{/* Navigation */}
					<nav className="flex-1 p-4 space-y-2 overflow-y-auto">
						<div className="space-y-1">
							{navItems.map((item) => (
								<NavLink key={item.href} item={item} />
							))}
						</div>

						{/* Divider */}
						<div className={cn('my-4 border-t border-border/50', !isExpanded && 'mx-2')} />

						{/* Bottom Navigation */}
						<div className="space-y-1">
							{bottomNavItems.map((item) => (
								<NavLink key={item.href} item={item} />
							))}
						</div>
					</nav>

					{/* Collapse Button */}
					<div className="p-4 border-t border-border/50">
						<Button
							variant="ghost"
							size="sm"
							onClick={toggleCollapsed}
							className={cn(
								'w-full justify-start gap-2 text-muted-foreground hover:text-foreground relative',
								!isExpanded && 'justify-center px-2'
							)}
						>
							{isCollapsed ? (
								<>
									<ChevronRight className="h-4 w-4" />
									{sidebarHoverEnabled && (
										<Mouse className="h-3 w-3 absolute -top-1 -right-1 text-primary" />
									)}
								</>
							) : (
								<>
									<ChevronLeft className="h-4 w-4" />
									<span>Contraer</span>
									{sidebarHoverEnabled && (
										<Mouse className="h-3 w-3 text-primary" />
									)}
								</>
							)}
						</Button>
					</div>
				</div>
			</aside>

			{/* Main Content */}
			<div className="flex-1 flex flex-col min-w-0">
				{/* Top Bar */}
				<header className="h-16 border-b border-border/50 bg-gradient-to-r from-background to-muted/20 flex items-center justify-between px-4 lg:px-6">
					<div className="flex items-center gap-4">
						<Button
							variant="ghost"
							size="sm"
							onClick={toggleMobile}
							className="lg:hidden"
						>
							{isMobileOpen ? (
								<X className="h-4 w-4" />
							) : (
								<Menu className="h-4 w-4" />
							)}
						</Button>
						
						<div className="hidden lg:block">
							<h1 className="text-xl font-semibold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
								{navItems.find(item => item.href === pathname)?.title || 'Dashboard'}
							</h1>
							<p className="text-sm text-muted-foreground">
								{navItems.find(item => item.href === pathname)?.description || 'Bienvenido a tu panel de control'}
							</p>
						</div>
					</div>

					<div className="flex items-center gap-4">
						<Search />
						
						<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
							<Bell className="h-4 w-4" />
						</Button>
						
						<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
							<Plus className="h-4 w-4" />
						</Button>
						
						<UserNav />
					</div>
				</header>

				{/* Content */}
				<main className="flex-1 overflow-auto p-4 lg:p-6">
					<div className="max-w-7xl mx-auto">
						{children}
					</div>
				</main>
			</div>
		</div>
	)
} 