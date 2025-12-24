'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Badge } from '@/components/ui/badge'

interface NavItem {
	title: string
	href: string
	icon: React.ComponentType<{ className?: string }>
	badge?: string
	description: string
}

interface AnimatedSidebarNavProps {
	items: NavItem[]
	isExpanded: boolean
	onMobileClose?: () => void
	onItemClick?: (_item: NavItem, _e: React.MouseEvent) => void
}

export function AnimatedSidebarNav({ items, isExpanded, onMobileClose, onItemClick }: AnimatedSidebarNavProps) {
	const pathname = usePathname()
	const navRef = useRef<HTMLDivElement>(null)
	const itemRefs = useRef<(HTMLAnchorElement | null)[]>([])
	const [indicatorStyle, setIndicatorStyle] = useState({
		top: 0,
		height: 0,
		opacity: 0
	})

	// Encuentra el índice del item activo
	const activeIndex = items.findIndex(item => item.href === pathname)

	// Actualiza la posición del indicador cuando cambia la ruta activa
	useEffect(() => {
		if (activeIndex !== -1 && itemRefs.current[activeIndex] && navRef.current) {
			const activeElement = itemRefs.current[activeIndex]
			const navElement = navRef.current

			if (activeElement) {
				const navRect = navElement.getBoundingClientRect()
				const activeRect = activeElement.getBoundingClientRect()

				setIndicatorStyle({
					top: activeRect.top - navRect.top,
					height: activeRect.height,
					opacity: 1
				})
			}
		} else {
			setIndicatorStyle(prev => ({ ...prev, opacity: 0 }))
		}
	}, [activeIndex, isExpanded])

	// Actualiza las referencias cuando el componente se re-renderiza
	useEffect(() => {
		itemRefs.current = itemRefs.current.slice(0, items.length)
	}, [items.length])

	const handleLinkClick = (e: React.MouseEvent, item: NavItem) => {
		if (onItemClick) {
			onItemClick(item, e)
		}
		if (onMobileClose) {
			onMobileClose()
		}
	}

	return (
		<div ref={navRef} className="relative">
			{/* Indicador animado */}
			<div
				className="absolute left-0 w-1 bg-gradient-to-b from-primary to-primary/80 rounded-r-full transition-all duration-500 ease-out pointer-events-none z-10 shadow-lg animate-slide-indicator"
				style={{
					top: `${indicatorStyle.top}px`,
					height: `${indicatorStyle.height}px`,
					opacity: indicatorStyle.opacity,
					transform: 'translateY(0)',
					boxShadow: indicatorStyle.opacity > 0 ? '0 0 10px rgba(var(--primary), 0.4)' : 'none'
				}}
			/>

			{/* Fondo del indicador con efecto de brillo */}
			<div
				className={`absolute bg-gradient-to-r from-primary/15 to-primary/8 rounded-lg border border-primary/30 transition-all duration-500 ease-out pointer-events-none z-0 shadow-sm ${isExpanded ? 'left-3 right-3' : 'left-2 right-2'}`}
				style={{
					top: `${indicatorStyle.top}px`,
					height: `${indicatorStyle.height}px`,
					opacity: indicatorStyle.opacity,
					backdropFilter: 'blur(1px)'
				}}
			/>

			{/* Efecto de pulso sutil */}
			<div
				className="absolute left-0 w-1 bg-primary/50 rounded-r-full transition-all duration-500 ease-out pointer-events-none z-5 animate-glow-pulse"
				style={{
					top: `${indicatorStyle.top}px`,
					height: `${indicatorStyle.height}px`,
					opacity: indicatorStyle.opacity * 0.6,
					filter: 'blur(1px)'
				}}
			/>

			{/* Items de navegación */}
			<div className="relative z-20 space-y-1">
				{items.map((item, index) => {
					const isActive = pathname === item.href
					const Icon = item.icon

					return (
						<Link
							key={item.href}
							ref={(el) => {
								itemRefs.current[index] = el
							}}
							href={item.href}
							onClick={(e) => handleLinkClick(e, item)}
							className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 group relative ${isActive
								? 'text-primary font-semibold'
								: 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
								} ${!isExpanded && 'justify-center px-2'}`}
						>
							{/* Efecto de hover con gradiente */}
							<div className={`absolute inset-0 bg-gradient-to-r from-primary/8 via-primary/4 to-transparent rounded-lg opacity-0 transition-all duration-300 pointer-events-none ${!isActive ? 'group-hover:opacity-100' : ''}`} />

							{/* Efecto de brillo en hover */}
							<div className={`absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent rounded-lg opacity-0 transition-all duration-500 pointer-events-none ${!isActive ? 'group-hover:opacity-100' : ''}`} />

							<Icon className={`h-4 w-4 flex-shrink-0 transition-all duration-300 ${isActive
								? 'text-primary scale-110 animate-icon-bounce'
								: 'group-hover:scale-110 group-hover:text-foreground group-hover:rotate-3'
								}`} />

							{isExpanded && (
								<>
									<span className={`flex-1 truncate transition-all duration-300 ${isActive ? 'text-primary font-semibold' : 'group-hover:text-foreground group-hover:translate-x-1'
										}`}>
										{item.title}
									</span>
									{item.badge && (
										<Badge
											variant={isActive ? "default" : "secondary"}
											className={`text-xs transition-all duration-300 transform ${isActive
												? 'bg-primary/25 text-primary border-primary/40 scale-105 shadow-sm'
												: 'group-hover:bg-muted group-hover:scale-105 group-hover:shadow-sm'
												}`}
										>
											{item.badge}
										</Badge>
									)}
								</>
							)}

							{/* Tooltip para sidebar colapsado */}
							{!isExpanded && (
								<div className="absolute left-full ml-3 px-3 py-2 bg-popover/95 backdrop-blur-sm text-popover-foreground text-xs rounded-lg shadow-xl border border-border/50 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-50 whitespace-nowrap group-hover:translate-x-1 group-hover:scale-105">
									<div className="font-medium">{item.title}</div>
									{item.badge && (
										<div className="text-xs text-muted-foreground mt-1">
											{item.badge}
										</div>
									)}
									{/* Flecha del tooltip */}
									<div className="absolute left-0 top-1/2 transform -translate-x-1 -translate-y-1/2 w-2 h-2 bg-popover border-l border-b border-border/50 rotate-45"></div>
								</div>
							)}
						</Link>
					)
				})}
			</div>
		</div>
	)
} 
