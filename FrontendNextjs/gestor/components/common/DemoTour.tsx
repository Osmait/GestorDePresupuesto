'use client'

import type { DriveStep } from 'driver.js'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'

type Side = 'top' | 'bottom' | 'left' | 'right'

interface TourStep {
	/** CSS selector of the anchor element on the page. */
	element: string
	/** Message key under `auth.demo.tour.<page>`. */
	id: string
	side: Side
	align?: 'start' | 'center' | 'end'
}

/** One tour per page: the sessionStorage key and its steps (text comes from `auth.demo.tour`). */
const TOURS: Record<string, { key: string; page: string; steps: TourStep[] }> = {
	'/app': {
		key: 'hasSeenDemoTour_dashboard',
		page: 'dashboard',
		steps: [
			{ element: '#dashboard-header', id: 'welcome', side: 'bottom', align: 'start' },
			{ element: '#stats-grid', id: 'stats', side: 'bottom' },
			{ element: '#dashboard-charts', id: 'charts', side: 'top' },
			{ element: '#recent-transactions', id: 'recent', side: 'left' },
		],
	},
	'/app/accounts': {
		key: 'hasSeenDemoTour_accounts',
		page: 'accounts',
		steps: [
			{ element: '#accounts-header', id: 'header', side: 'bottom', align: 'start' },
			{ element: '#add-account-btn', id: 'add', side: 'left' },
			{ element: '#accounts-list', id: 'list', side: 'top' },
		],
	},
	'/app/category': {
		key: 'hasSeenDemoTour_categories',
		page: 'categories',
		steps: [
			{ element: '#categories-header', id: 'header', side: 'bottom', align: 'start' },
			{ element: '#add-category-btn', id: 'add', side: 'left' },
			{ element: '#categories-list', id: 'list', side: 'top' },
		],
	},
	'/app/budget': {
		key: 'hasSeenDemoTour_budgets',
		page: 'budgets',
		steps: [
			{ element: '#budgets-header', id: 'header', side: 'bottom', align: 'start' },
			{ element: '#add-budget-btn', id: 'add', side: 'left' },
			{ element: '#budgets-list', id: 'list', side: 'top' },
		],
	},
	'/app/transactions': {
		key: 'hasSeenDemoTour_transactions',
		page: 'transactions',
		steps: [
			{ element: '#transactions-header', id: 'header', side: 'bottom', align: 'start' },
			{ element: '#add-transaction-btn', id: 'add', side: 'left' },
			{ element: '#transactions-tabs', id: 'tabs', side: 'bottom' },
			{ element: '#transactions-list', id: 'list', side: 'top' },
		],
	},
}

interface DemoTourProps {
	user: {
		email?: string | null
		name?: string | null
	}
}

export function DemoTour({ user }: DemoTourProps) {
	const pathname = usePathname()
	const t = useTranslations('auth.demo.tour')

	useEffect(() => {
		// Check if user is a demo user
		// Ensure case-insensitive check and trim
		const email = user?.email?.toLowerCase().trim()
		const isDemoUser = email?.startsWith('demo+')

		if (!isDemoUser) return

		const tour = TOURS[pathname]
		if (!tour) return
		const tourKey = tour.key
		const steps: DriveStep[] = tour.steps.map((step) => ({
			element: step.element,
			popover: {
				title: t(`${tour.page}.${step.id}.title`),
				description: t(`${tour.page}.${step.id}.description`),
				side: step.side,
				...(step.align ? { align: step.align } : {}),
			},
		}))

		const hasSeenTour = sessionStorage.getItem(tourKey)

		if (steps.length > 0 && !hasSeenTour) {
			let cancelled = false
			// Small delay to ensure DOM is ready and transitions finished. driver.js and
			// its CSS are only downloaded here, i.e. for demo users who have a tour to see.
			const timer = setTimeout(async () => {
				const { driver } = await import('./demo-tour-driver')
				if (cancelled) return
				const driverObj = driver({
					showProgress: true,
					animate: true,
					allowClose: true,
					doneBtnText: t('done'),
					nextBtnText: t('next'),
					prevBtnText: t('prev'),
					// driver.js fills in its own {{current}}/{{total}} placeholders.
					progressText: t('progress', { current: '{{current}}', total: '{{total}}' }),
					steps: steps,
					onDestroyStarted: () => {
						if (tourKey) {
							sessionStorage.setItem(tourKey, 'true')
						}
						driverObj.destroy()
					},
				})
				driverObj.drive()
			}, 1000)

			return () => {
				cancelled = true
				clearTimeout(timer)
			}
		}
	}, [user, pathname, t])

	return null
}
