'use client'

import { useSearchParams } from 'next/navigation'
import { KeyboardEvent, ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react'
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
	onValueChange?: (_value: string) => void
	noContent?: boolean
	/** URL query param name to sync tab state. Defaults to "tab". Set to false to disable URL sync. */
	urlParam?: string | false
}

export function AnimatedTabs({
	tabs,
	defaultValue,
	className,
	orientation = 'horizontal',
	onValueChange,
	noContent = false,
	urlParam = 'tab',
}: AnimatedTabsProps) {
	const searchParams = useSearchParams()
	const idPrefix = useId()

	const urlTab = urlParam ? searchParams.get(urlParam) : null
	const validUrlTab = urlTab && tabs.some((t) => t.value === urlTab) ? urlTab : null
	const [activeTab, setActiveTab] = useState(validUrlTab || defaultValue)

	const updateUrl = useCallback(
		(value: string) => {
			if (!urlParam) return
			const params = new URLSearchParams(window.location.search)
			if (value === defaultValue) {
				params.delete(urlParam)
			} else {
				params.set(urlParam, value)
			}
			const query = params.toString()
			const { pathname } = window.location
			// The tab is client state (no server component reads it): update the URL
			// without the RSC round trip that router.replace would cost per click.
			// Next.js keeps useSearchParams in sync with history.replaceState.
			window.history.replaceState(window.history.state, '', query ? `${pathname}?${query}` : pathname)
		},
		[urlParam, defaultValue],
	)
	const tabsRef = useRef<HTMLDivElement>(null)
	const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
	const [indicatorStyle, setIndicatorStyle] = useState({
		left: 0,
		width: 0,
		top: 0,
		height: 0,
		opacity: 0,
	})

	// Encuentra el índice del tab activo
	const activeIndex = tabs.findIndex((tab) => tab.value === activeTab)

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
						opacity: 1,
					})
				} else {
					setIndicatorStyle({
						left: 0,
						width: 0,
						top: activeRect.top - containerRect.top,
						height: activeRect.height,
						opacity: 1,
					})
				}
			}
		} else {
			setIndicatorStyle((prev) => ({ ...prev, opacity: 0 }))
		}
	}, [activeIndex, orientation])

	// Actualiza las referencias cuando el componente se re-renderiza
	useEffect(() => {
		tabRefs.current = tabRefs.current.slice(0, tabs.length)
	}, [tabs.length])

	const handleTabClick = (value: string) => {
		if (tabs.find((tab) => tab.value === value)?.disabled) return
		setActiveTab(value)
		updateUrl(value)
		if (onValueChange) {
			onValueChange(value)
		}
	}

	const activeTabContent = tabs.find((tab) => tab.value === activeTab)?.content

	// WAI-ARIA tabs keyboard model: arrows move (and select) the next enabled tab, Home/End jump to the ends.
	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const prevKey = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp'
		const nextKey = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown'
		if (![prevKey, nextKey, 'Home', 'End'].includes(event.key)) return
		const enabled = tabs.map((tab, index) => ({ tab, index })).filter(({ tab }) => !tab.disabled)
		if (enabled.length === 0) return
		event.preventDefault()
		const position = enabled.findIndex(({ index }) => index === activeIndex)
		let target = enabled[0]
		if (event.key === 'End') target = enabled[enabled.length - 1]
		else if (event.key === nextKey) target = enabled[(position + 1) % enabled.length]
		else if (event.key === prevKey) target = enabled[(position - 1 + enabled.length) % enabled.length]
		handleTabClick(target.tab.value)
		tabRefs.current[target.index]?.focus()
	}

	return (
		<div className={cn('space-y-6', className)}>
			{/* Tabs List */}
			<div
				ref={tabsRef}
				role='tablist'
				aria-orientation={orientation}
				onKeyDown={handleKeyDown}
				className={cn(
					'relative inline-flex h-10 w-full items-center justify-center rounded-lg border border-border/50 bg-muted/50 p-1 text-muted-foreground sm:w-auto',
					// Many tabs (e.g. the dashboard's 5) don't fit at 390px: scroll instead of overflowing the page.
					orientation === 'horizontal' && 'flex-row max-w-full justify-start overflow-x-auto sm:justify-center',
					orientation === 'vertical' && 'flex-col h-auto',
				)}
			>
				{/* Indicador animado horizontal */}
				{orientation === 'horizontal' && (
					<>
						{/* Linea inferior del indicador */}
						<div
							className='absolute bottom-0 h-0.5 bg-primary rounded-full transition-[left,width,opacity] duration-300 ease-out pointer-events-none z-10'
							style={{
								left: `${indicatorStyle.left}px`,
								width: `${indicatorStyle.width}px`,
								opacity: indicatorStyle.opacity,
							}}
						/>

						{/* Fondo del indicador */}
						<div
							className='absolute top-1 bottom-1 bg-primary/10 rounded-md transition-[left,width,opacity] duration-300 ease-out pointer-events-none z-0'
							style={{
								left: `${indicatorStyle.left}px`,
								width: `${indicatorStyle.width}px`,
								opacity: indicatorStyle.opacity,
							}}
						/>
					</>
				)}

				{/* Indicador animado vertical */}
				{orientation === 'vertical' && (
					<>
						<div
							className='absolute left-0 w-0.5 bg-primary rounded-full transition-[top,height,opacity] duration-300 ease-out pointer-events-none z-10'
							style={{
								top: `${indicatorStyle.top}px`,
								height: `${indicatorStyle.height}px`,
								opacity: indicatorStyle.opacity,
							}}
						/>

						<div
							className='absolute left-1 right-1 bg-primary/10 rounded-md transition-[top,height,opacity] duration-300 ease-out pointer-events-none z-0'
							style={{
								top: `${indicatorStyle.top}px`,
								height: `${indicatorStyle.height}px`,
								opacity: indicatorStyle.opacity,
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
							type='button'
							key={tab.value}
							ref={(el) => {
								tabRefs.current[index] = el
							}}
							role='tab'
							// On mobile only the icon is visible: keep an accessible name (same text as the sm+ label).
							aria-label={tab.icon ? tab.label : undefined}
							aria-selected={isActive}
							// Only point at a panel that exists (filter-only tabs render none).
							aria-controls={noContent ? undefined : `${idPrefix}-panel-${tab.value}`}
							id={`${idPrefix}-tab-${tab.value}`}
							tabIndex={isActive ? 0 : -1}
							onClick={() => handleTabClick(tab.value)}
							disabled={isDisabled}
							className={cn(
								'relative inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group z-20',
								isActive ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground',
								isDisabled && 'opacity-50 cursor-not-allowed',
							)}
						>
							{/* Efecto de hover */}
							<div className='absolute inset-0 bg-primary/5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none' />

							{/* Icono */}
							{tab.icon && (
								<span
									aria-hidden='true'
									className={cn(
										'transition-all duration-200 relative z-10',
										isActive ? 'text-primary' : 'group-hover:text-foreground',
									)}
								>
									{tab.icon}
								</span>
							)}

							{/* Label - Hidden on mobile when icon exists */}
							<span
								className={cn(
									'transition-all duration-200 relative z-10',
									tab.icon ? 'hidden sm:inline sm:ml-2' : '',
									isActive ? 'text-primary font-semibold' : 'group-hover:text-foreground',
								)}
							>
								{tab.label}
							</span>
						</button>
					)
				})}
			</div>

			{/* Tab Content */}
			{!noContent && (
				<div
					role='tabpanel'
					id={`${idPrefix}-panel-${activeTab}`}
					aria-labelledby={`${idPrefix}-tab-${activeTab}`}
					className='min-h-[200px] transition-opacity duration-300 ease-in-out'
				>
					{activeTabContent}
				</div>
			)}
		</div>
	)
}
