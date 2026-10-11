'use client'

import { useSearchParams } from 'next/navigation'
import { type ReactNode, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export interface PageTab {
	value: string
	label: ReactNode
	/**
	 * Optional icon element before the label, e.g. `<BarChart3 className='h-4 w-4' />`
	 * (an element, not a component, so server pages can pass it). Hidden from screen readers.
	 */
	icon?: ReactNode
	content: ReactNode
	disabled?: boolean
}

export interface PageTabsProps {
	tabs: readonly PageTab[]
	/** Tab shown when the URL has no (valid) value. It is left out of the URL. */
	defaultValue: string
	/**
	 * Query param that mirrors the active tab (`?tab=budgets`), so a section can
	 * be linked and survives a reload. Default `'tab'`; `false` turns it off.
	 * Use another name when a filter on the same page already uses `tab`.
	 */
	urlParam?: string | false
	/** Controlled value; pair with `onValueChange`. */
	value?: string
	onValueChange?: (value: string) => void
	/** Accessible name of the tab list. */
	'aria-label'?: string
	id?: string
	className?: string
	listClassName?: string
}

function readUrlTab(search: URLSearchParams | null, param: string | false, tabs: readonly PageTab[]) {
	if (!param) return null
	const value = search?.get(param)
	return value && tabs.some((tab) => tab.value === value) ? value : null
}

/**
 * Page sections as tabs (Radix `ui/tabs`): the active tab is mirrored in the
 * URL and the tab list scrolls horizontally on narrow screens instead of
 * overflowing the page. For a segmented *filter* inside a section use
 * `AnimatedTabs` (see DESIGN.md > Tabs). Only the active panel is mounted.
 *
 * The URL is written with `history.replaceState` (Next.js keeps
 * `useSearchParams` in sync): the tab is client state, so a `router.replace`
 * would only add a server round trip and re-render the page.
 *
 * @example
 * <PageTabs
 *   defaultValue='overview'
 *   tabs={[
 *     { value: 'overview', label: t('overview'), icon: <BarChart3 className='h-4 w-4' />, content: <Overview /> },
 *     { value: 'budgets', label: t('budgets'), icon: <PieChart className='h-4 w-4' />, content: <Budgets /> },
 *   ]}
 * />
 */
export function PageTabs({
	tabs,
	defaultValue,
	urlParam = 'tab',
	value,
	onValueChange,
	'aria-label': ariaLabel,
	id,
	className,
	listClassName,
}: PageTabsProps) {
	const searchParams = useSearchParams()
	const urlTab = readUrlTab(searchParams, urlParam, tabs)
	const [localValue, setLocalValue] = useState(urlTab ?? defaultValue)
	// Follow external URL changes (a link to `?tab=…` while the page is mounted).
	const [lastUrlTab, setLastUrlTab] = useState(urlTab)
	if (urlTab !== lastUrlTab) {
		setLastUrlTab(urlTab)
		if (urlTab) setLocalValue(urlTab)
	}
	const active = value ?? localValue

	function handleValueChange(next: string) {
		setLocalValue(next)
		if (urlParam) {
			const params = new URLSearchParams(window.location.search)
			if (next === defaultValue) params.delete(urlParam)
			else params.set(urlParam, next)
			const query = params.toString()
			const { pathname } = window.location
			window.history.replaceState(window.history.state, '', query ? `${pathname}?${query}` : pathname)
		}
		onValueChange?.(next)
	}

	return (
		<Tabs id={id} value={active} onValueChange={handleValueChange} className={cn('min-w-0 space-y-6', className)}>
			<TabsList
				aria-label={ariaLabel}
				className={cn(
					// Scroll the list (not the page) when the tabs don't fit; scrollbar hidden, the cut-off tab hints at more.
					'h-auto max-w-full justify-start overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
					listClassName,
				)}
			>
				{tabs.map(({ value: tabValue, label, icon, disabled }) => (
					<TabsTrigger key={tabValue} value={tabValue} disabled={disabled} className='min-h-8 shrink-0 gap-2'>
						{icon ? (
							<span aria-hidden='true' className='inline-flex'>
								{icon}
							</span>
						) : null}
						{label}
					</TabsTrigger>
				))}
			</TabsList>
			{tabs.map((tab) => (
				<TabsContent key={tab.value} value={tab.value} className='mt-0'>
					{tab.content}
				</TabsContent>
			))}
		</Tabs>
	)
}
