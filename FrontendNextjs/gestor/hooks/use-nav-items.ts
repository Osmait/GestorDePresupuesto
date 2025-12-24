'use client'

import { useTranslations } from 'next-intl'
import {
    LayoutDashboard,
    CreditCard,
    ArrowUpDown,
    Tags,
    PiggyBank,
    Settings,
    HelpCircle,
    BarChart,
    TrendingUp,
} from 'lucide-react'

interface NavItem {
    title: string
    href: string
    icon: React.ComponentType<{ className?: string }>
    badge?: string
    description: string
}

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

    const bottomNavItems: NavItem[] = [
        {
            title: t('settings'),
            href: '/app/settings',
            icon: Settings,
            description: t('settingsDesc')
        },
        {
            title: t('help'),
            href: '/app/help',
            icon: HelpCircle,
            description: t('helpDesc')
        }
    ]

    return { navItems, bottomNavItems }
}
