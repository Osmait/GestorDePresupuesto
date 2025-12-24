"use client"

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { UserNav } from '@/components/auth/user-nav'
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
	Bell,
	Plus,
	Mouse,
	BarChart,
	TrendingUp,
	Wallet
} from 'lucide-react'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useGlobalAction } from '@/contexts/GlobalActionContext'
import { NotificationCenter } from '@/components/common/NotificationCenter'
import { useTranslations } from 'next-intl'
import { useNavItems } from '@/hooks/use-nav-items'

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

// Navigation items are now provided by useNavItems hook with translations

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
	toggleCollapsed,
	onItemClick
}: {
	items: NavItem[]
	isExpanded: boolean
	sidebarHoverEnabled: boolean
	toggleCollapsed: () => void
	onItemClick: (item: NavItem, e: React.MouseEvent) => void
}) {
	const t = useTranslations('nav')
	return (
		<div className="border-t border-border/50 p-4 space-y-2">
			<AnimatedSidebarNav
				items={items}
				isExpanded={isExpanded}
				onItemClick={onItemClick}
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
							<span className="transition-all duration-200 group-hover:translate-x-1">{t('collapse')}</span>
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

// Component for main header
function MainHeader({ isExpanded, toggleMobile }: {
	isExpanded: boolean
	toggleMobile: () => void
}) {
	const { openModal } = useGlobalAction()
	const t = useTranslations('nav')
	const tDash = useTranslations('dashboard')
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
							<h1 className="text-xl font-semibold text-foreground">{tDash('title')}</h1>
							<p className="text-sm text-muted-foreground">{t('dashboardDesc')}</p>
						</div>
					)}
				</div>

				<div className="flex items-center gap-4">
					<Search />

					<div className="flex items-center gap-2">
						<NotificationCenter />
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="sm">
									<Plus className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-56">
								<DropdownMenuLabel>{t('quickActions')}</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem onClick={() => openModal('TRANSACTION')}>
									<ArrowUpDown className="mr-2 h-4 w-4" />
									<span>{t('newTransaction')}</span>
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => openModal('CATEGORY')}>
									<Tags className="mr-2 h-4 w-4" />
									<span>{t('newCategory')}</span>
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => openModal('BUDGET')}>
									<PiggyBank className="mr-2 h-4 w-4" />
									<span>{t('newBudget')}</span>
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => openModal('ACCOUNT')}>
									<Wallet className="mr-2 h-4 w-4" />
									<span>{t('newAccount')}</span>
								</DropdownMenuItem>
								<DropdownMenuItem onClick={() => openModal('INVESTMENT')}>
									<TrendingUp className="mr-2 h-4 w-4" />
									<span>{t('newInvestment')}</span>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>

					<UserNav />
				</div>
			</div>
		</header>
	)
}

// Componente principal que combina Client Components
export function Sidebar({ children }: SidebarProps) {
	const pathname = usePathname()
	const { navItems, bottomNavItems } = useNavItems()

	// Estado local para settings eliminada al moverla al UserNav
	const handleItemClick = (item: NavItem, e: React.MouseEvent) => {
		// Handler vacío por ahora, o eliminar si no se usa
	}

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
								onItemClick={handleItemClick}
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

