'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tag, Activity, Palette } from 'lucide-react'
import { AnimatedCounter } from '@/components/ui/animated-counter'
import { useTranslations } from 'next-intl'
import { Category } from '@/types/category'
import { CategoryExpense } from '@/types/analytics'

export function CategorySummaryCard({ categories, categoryExpenses }: { categories: Category[], categoryExpenses: CategoryExpense[] }) {
    const t = useTranslations('categories')
    const safeCategories = categories ?? []
    const expenses = categoryExpenses ?? []
    const activeCategories = expenses.filter((item) => item.transaction_count > 0)
    const totalTransactions = expenses.reduce((sum, item) => sum + (item.transaction_count || 0), 0)
    const averagePerCategory = activeCategories.length > 0 ? Math.round(totalTransactions / activeCategories.length) : 0

    return (
        <Card className="border-border/50 dark:border-border/20">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                    <Tag className="h-5 w-5" />
                    {t('summary')}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 dark:from-blue-500/5 dark:to-cyan-500/5">
                        <Tag className="h-6 w-6 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                        <p className="text-sm font-medium text-muted-foreground">{t('totalCategories')}</p>
                        <p className="text-2xl font-bold text-foreground">
                            <AnimatedCounter value={safeCategories.length} />
                        </p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-500/10 dark:from-green-500/5 dark:to-emerald-500/5">
                        <Activity className="h-6 w-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
                        <p className="text-sm font-medium text-muted-foreground">{t('activeCategories')}</p>
                        <p className="text-2xl font-bold text-foreground">
                            <AnimatedCounter value={activeCategories.length} />
                        </p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-violet-500/10 dark:from-purple-500/5 dark:to-violet-500/5">
                        <Palette className="h-6 w-6 mx-auto mb-2 text-purple-600 dark:text-purple-400" />
                        <p className="text-sm font-medium text-muted-foreground">{t('averagePerCategory')}</p>
                        <p className="text-2xl font-bold text-foreground">
                            <AnimatedCounter value={averagePerCategory} />
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
