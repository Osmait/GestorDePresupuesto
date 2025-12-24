'use client'

import { useTranslations } from 'next-intl'
import {
    LayoutDashboard,
    CreditCard,
    ArrowUpDown,
    Tags,
    PiggyBank,
    BarChart,
    TrendingUp,
} from 'lucide-react'

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

    const navItems: NavItem[] = [
        {
            title: t('dashboard'),
            href: '/app',
            icon: LayoutDashboard,
            description: t('dashboardDesc')
        },
        {
            title: t('accounts'),
            href: '/app/accounts',
            icon: CreditCard,
            description: t('accountsDesc')
        },
        {
            title: t('transactions'),
            href: '/app/transactions',
            icon: ArrowUpDown,
            description: t('transactionsDesc')
        },
        {
            title: t('categories'),
            href: '/app/category',
            icon: Tags,
            description: t('categoriesDesc')
        },
        {
            title: t('budgets'),
            href: '/app/budget',
            icon: PiggyBank,
            description: t('budgetsDesc')
        },
        {
            title: t('investments'),
            href: '/app/investments',
            icon: TrendingUp,
            badge: t('new'),
            description: t('investmentsDesc')
        },
        {
            title: t('analytics'),
            href: '/app/analysis',
            icon: BarChart,
            description: t('analyticsDesc'),
        },
    ]

    const bottomNavItems: NavItem[] = []

    return { navItems, bottomNavItems }
}
