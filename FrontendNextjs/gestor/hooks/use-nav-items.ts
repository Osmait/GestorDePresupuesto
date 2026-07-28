'use client'

import {
	ArrowUpDown,
	BarChart,
	CalendarClock,
	CreditCard,
	CreditCard as CreditCardIcon,
	FileCheck,
	HandCoins,
	LayoutDashboard,
	PiggyBank,
	Shield,
	Tags,
	TrendingUp,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAdmin } from './useAdmin'
import { useFeatureFlags } from './useFeatureFlags'

/**
 * Interface representing a navigation item in the sidebar.
 * @property title - The display title of the item.
 * @property href - The URL path the item links to.
 * @property icon - The icon component to display.
 * @property badge - Optional badge text to display (e.g., "New").
 * @property description - A brief description of the item.
 */
interface NavItem {
	title: string
	href: string
	icon: React.ComponentType<{ className?: string }>
	badge?: string
	description: string
}

/**
 * Custom hook to retrieve localized navigation items for the application sidebar.
 * Returns both main navigation items and bottom navigation items (settings, help).
 *
 * @returns An object containing `navItems` and `bottomNavItems`.
 */
export function useNavItems() {
	const t = useTranslations('nav')
	const { isEnabled, isLoading: isFeatureFlagsLoading } = useFeatureFlags()

	const navItems: NavItem[] = [
		{
			title: t('dashboard'),
			href: '/app',
			icon: LayoutDashboard,
			description: t('dashboardDesc'),
		},
		{
			title: t('accounts'),
			href: '/app/accounts',
			icon: CreditCard,
			description: t('accountsDesc'),
		},
		{
			title: t('transactions'),
			href: '/app/transactions',
			icon: ArrowUpDown,
			description: t('transactionsDesc'),
		},
		{
			title: t('categories'),
			href: '/app/category',
			icon: Tags,
			description: t('categoriesDesc'),
		},
		{
			title: t('budgets'),
			href: '/app/budget',
			icon: PiggyBank,
			description: t('budgetsDesc'),
		},
		{
			title: t('monthlyPlan'),
			href: '/app/monthly',
			icon: CalendarClock,
			badge: t('new'),
			description: t('monthlyPlanDesc'),
		},
		...(isFeatureFlagsLoading || isEnabled('module_investments')
			? [
					{
						title: t('investments'),
						href: '/app/investments',
						icon: TrendingUp,
						badge: t('new'),
						description: t('investmentsDesc'),
					},
				]
			: []),
		...(isFeatureFlagsLoading || isEnabled('module_certificates')
			? [
					{
						title: t('certificates'),
						href: '/app/certificates',
						icon: FileCheck,
						description: t('certificatesDesc'),
					},
				]
			: []),
		...(isFeatureFlagsLoading || isEnabled('module_loans')
			? [
					{
						title: t('loans'),
						href: '/app/loans',
						icon: HandCoins,
						description: t('loansDesc'),
					},
				]
			: []),
		...(isFeatureFlagsLoading || isEnabled('module_credit_cards')
			? [
					{
						title: t('creditCards'),
						href: '/app/credit-cards',
						icon: CreditCardIcon,
						badge: t('new'),
						description: t('creditCardsDesc'),
					},
				]
			: []),
		{
			title: t('analytics'),
			href: '/app/analysis',
			icon: BarChart,
			description: t('analyticsDesc'),
		},
	]

	const bottomNavItems: NavItem[] = []

	const { isAdmin } = useAdmin()
	if (isAdmin) {
		navItems.push({
			title: 'Admin',
			href: '/admin/dashboard',
			icon: Shield, // Need to import Shield
			description: 'Admin Management',
		})
	}

	return { navItems, bottomNavItems }
}
