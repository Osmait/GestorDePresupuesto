'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tag, Activity, Palette } from 'lucide-react'
import { AnimatedCounter } from '@/components/ui/animated-counter'
import { useTranslations } from 'next-intl'
import { Category } from '@/types/category'
import { Transaction } from '@/types/transaction'

export function CategorySummaryCard({ categories, transactions }: { categories: Category[], transactions: Transaction[] }) {
    const t = useTranslations('categories')
    const activeCategories = categories.filter(cat =>
        transactions.some(t => t.category_id === cat.id)
    )
    const totalTransactions = transactions.length
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
                            <AnimatedCounter value={categories.length} />
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
