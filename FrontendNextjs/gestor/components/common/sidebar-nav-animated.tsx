'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
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
	const router = useRouter()
	const navRef = useRef<HTMLDivElement>(null)
	const itemRefs = useRef<(HTMLAnchorElement | null)[]>([])
	const [indicatorStyle, setIndicatorStyle] = useState({
		top: 0,
		height: 0,
		opacity: 0,
	})

	// Encuentra el índice del item activo
	const activeIndex = items.findIndex((item) => item.href === pathname)

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
					opacity: 1,
				})
			}
		} else {
			setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }))
		}
	}, [activeIndex])

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
		<div ref={navRef} className='relative'>
			{/* Active indicator: a bar and a soft fill that slide to the active item
			    (the one authored motion in the nav; reduced motion makes it jump). */}
			<div
				aria-hidden='true'
				className='absolute left-0 w-1 rounded-r-full bg-primary transition-all duration-300 ease-out pointer-events-none z-10'
				style={{
					top: `${indicatorStyle.top}px`,
					height: `${indicatorStyle.height}px`,
					opacity: indicatorStyle.opacity,
					boxShadow: indicatorStyle.opacity > 0 ? '0 0 10px hsl(var(--primary) / 0.4)' : 'none',
				}}
			/>
			<div
				aria-hidden='true'
				className={`absolute rounded-lg bg-primary/10 transition-all duration-300 ease-out pointer-events-none z-0 ${isExpanded ? 'left-3 right-3' : 'left-2 right-2'}`}
				style={{
					top: `${indicatorStyle.top}px`,
					height: `${indicatorStyle.height}px`,
					opacity: indicatorStyle.opacity,
				}}
			/>

			{/* Items de navegación */}
			<div className='relative z-20 space-y-1'>
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
							aria-current={isActive ? 'page' : undefined}
							// Dynamic pages: prefetch on intent (hover/focus) instead of every link on every load.
							prefetch={false}
							onMouseEnter={() => router.prefetch(item.href)}
							onFocus={() => router.prefetch(item.href)}
							onClick={(e) => handleLinkClick(e, item)}
							className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 group relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
								isActive
									? 'text-primary font-semibold'
									: 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
							} ${!isExpanded && 'justify-center px-2'}`}
						>
							<Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-primary' : 'group-hover:text-foreground'}`} />

							{isExpanded && (
								<>
									<span className='flex-1 truncate' title={item.title}>
										{item.title}
									</span>
									{item.badge && (
										<Badge variant='secondary' className='text-xs'>
											{item.badge}
										</Badge>
									)}
								</>
							)}

							{/* Tooltip para sidebar colapsado (also the link's accessible name) */}
							{!isExpanded && (
								<div className='absolute left-full ml-3 px-3 py-2 bg-popover text-popover-foreground text-xs rounded-lg shadow-md border border-border/50 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap'>
									<div className='font-medium'>{item.title}</div>
									{item.badge && <div className='text-xs text-muted-foreground mt-1'>{item.badge}</div>}
								</div>
							)}
						</Link>
					)
				})}
			</div>
		</div>
	)
}
