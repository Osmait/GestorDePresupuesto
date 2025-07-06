'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface TabItem {
	value: string
	label: string
	icon?: ReactNode
	content: ReactNode
	disabled?: boolean
}

interface AnimatedTabsProps {
	tabs: TabItem[]
	defaultValue: string
	className?: string
	orientation?: 'horizontal' | 'vertical'
	onValueChange?: (value: string) => void
}

export function AnimatedTabs({ 
	tabs, 
	defaultValue, 
	className, 
	orientation = 'horizontal',
	onValueChange 
}: AnimatedTabsProps) {
	const [activeTab, setActiveTab] = useState(defaultValue)
	const tabsRef = useRef<HTMLDivElement>(null)
	const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
	const [indicatorStyle, setIndicatorStyle] = useState({
		left: 0,
		width: 0,
		top: 0,
		height: 0,
		opacity: 0
	})

	// Encuentra el índice del tab activo
	const activeIndex = tabs.findIndex(tab => tab.value === activeTab)

	// Actualiza la posición del indicador cuando cambia el tab activo
	useEffect(() => {
		if (activeIndex !== -1 && tabRefs.current[activeIndex] && tabsRef.current) {
			const activeElement = tabRefs.current[activeIndex]
			const tabsContainer = tabsRef.current
			
			if (activeElement) {
				const containerRect = tabsContainer.getBoundingClientRect()
				const activeRect = activeElement.getBoundingClientRect()
				
				if (orientation === 'horizontal') {
					setIndicatorStyle({
						left: activeRect.left - containerRect.left,
						width: activeRect.width,
						top: 0,
						height: 0,
						opacity: 1
					})
				} else {
					setIndicatorStyle({
						left: 0,
						width: 0,
						top: activeRect.top - containerRect.top,
						height: activeRect.height,
						opacity: 1
					})
				}
			}
		} else {
			setIndicatorStyle(prev => ({ ...prev, opacity: 0 }))
		}
	}, [activeIndex, orientation])

	// Actualiza las referencias cuando el componente se re-renderiza
	useEffect(() => {
		tabRefs.current = tabRefs.current.slice(0, tabs.length)
	}, [tabs.length])

	const handleTabClick = (value: string) => {
		if (tabs.find(tab => tab.value === value)?.disabled) return
		setActiveTab(value)
		if (onValueChange) {
			onValueChange(value)
		}
	}

	const activeTabContent = tabs.find(tab => tab.value === activeTab)?.content

	return (
		<div className={cn('space-y-6', className)}>
			{/* Tabs List */}
			<div 
				ref={tabsRef}
				className={cn(
					'relative inline-flex h-10 items-center justify-center rounded-lg bg-muted/50 p-1 text-muted-foreground backdrop-blur-sm border border-border/50',
					orientation === 'horizontal' && 'flex-row',
					orientation === 'vertical' && 'flex-col h-auto'
				)}
			>
				{/* Indicador animado horizontal */}
				{orientation === 'horizontal' && (
					<>
						<div
							className="absolute bottom-0 h-0.5 bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500 ease-out pointer-events-none z-10"
							style={{
								left: `${indicatorStyle.left}px`,
								width: `${indicatorStyle.width}px`,
								opacity: indicatorStyle.opacity,
								boxShadow: indicatorStyle.opacity > 0 ? '0 0 8px rgba(var(--primary), 0.6)' : 'none'
							}}
						/>
						
						{/* Fondo del indicador */}
						<div
							className="absolute top-1 bottom-1 bg-gradient-to-r from-primary/15 to-primary/8 rounded-md border border-primary/30 transition-all duration-500 ease-out pointer-events-none z-0 shadow-sm"
							style={{
								left: `${indicatorStyle.left}px`,
								width: `${indicatorStyle.width}px`,
								opacity: indicatorStyle.opacity,
								backdropFilter: 'blur(2px)'
							}}
						/>

						{/* Efecto de brillo */}
						<div
							className="absolute top-1 bottom-1 bg-gradient-to-r from-primary/20 via-primary/30 to-primary/20 rounded-md transition-all duration-500 ease-out pointer-events-none z-5 animate-tab-indicator-pulse"
							style={{
								left: `${indicatorStyle.left}px`,
								width: `${indicatorStyle.width}px`,
								opacity: indicatorStyle.opacity * 0.7,
								filter: 'blur(1px)'
							}}
						/>
					</>
				)}

				{/* Indicador animado vertical */}
				{orientation === 'vertical' && (
					<>
						<div
							className="absolute left-0 w-0.5 bg-gradient-to-b from-primary to-primary/80 rounded-full transition-all duration-500 ease-out pointer-events-none z-10"
							style={{
								top: `${indicatorStyle.top}px`,
								height: `${indicatorStyle.height}px`,
								opacity: indicatorStyle.opacity,
								boxShadow: indicatorStyle.opacity > 0 ? '0 0 8px rgba(var(--primary), 0.6)' : 'none'
							}}
						/>
						
						<div
							className="absolute left-1 right-1 bg-gradient-to-r from-primary/15 to-primary/8 rounded-md border border-primary/30 transition-all duration-500 ease-out pointer-events-none z-0 shadow-sm"
							style={{
								top: `${indicatorStyle.top}px`,
								height: `${indicatorStyle.height}px`,
								opacity: indicatorStyle.opacity,
								backdropFilter: 'blur(2px)'
							}}
						/>
					</>
				)}

				{/* Tab Buttons */}
				{tabs.map((tab, index) => {
					const isActive = activeTab === tab.value
					const isDisabled = tab.disabled

					return (
						<button
							key={tab.value}
							ref={(el) => {
								tabRefs.current[index] = el
							}}
							onClick={() => handleTabClick(tab.value)}
							disabled={isDisabled}
							className={cn(
								'relative inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group z-20',
								isActive 
									? 'text-primary font-semibold' 
									: 'text-muted-foreground hover:text-foreground',
								isDisabled && 'opacity-50 cursor-not-allowed'
							)}
						>
							{/* Efecto de hover con gradiente */}
							<div className="absolute inset-0 bg-gradient-to-r from-primary/8 via-primary/4 to-transparent rounded-md opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none" />
							
							{/* Efecto de brillo en hover */}
							<div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/15 to-transparent rounded-md opacity-0 group-hover:opacity-100 transition-all duration-500 pointer-events-none" />
							
							{/* Icono */}
							{tab.icon && (
								<span className={cn(
									'transition-all duration-300 relative z-10',
									isActive 
										? 'text-primary scale-110 animate-icon-bounce' 
										: 'group-hover:scale-110 group-hover:text-foreground group-hover:rotate-6'
								)}>
									{tab.icon}
								</span>
							)}
							
							{/* Label */}
							<span className={cn(
								'transition-all duration-300 relative z-10',
								tab.icon && 'ml-2',
								isActive 
									? 'text-primary font-semibold' 
									: 'group-hover:text-foreground group-hover:translate-x-1'
							)}>
								{tab.label}
							</span>
						</button>
					)
				})}
			</div>

			{/* Tab Content */}
			<div className="min-h-[200px] transition-all duration-300 ease-in-out animate-tab-content-fade">
				{activeTabContent}
			</div>
		</div>
	)
} 