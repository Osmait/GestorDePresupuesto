'use client'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
    PiggyBank,
    TrendingUp,
    TrendingDown,
    DollarSign,
    AlertTriangle,
} from 'lucide-react'
import { AnimatedCounter } from '@/components/ui/animated-counter'
import { useTranslations } from 'next-intl'
import { Budget } from '@/types/budget'
import { Transaction } from '@/types/transaction'

export function BudgetSummaryCard({ budgets, transactions }: { budgets: Budget[], transactions: Transaction[] }) {
    const t = useTranslations('budgets')
    const totalBudget = budgets?.reduce((sum, budget) => sum + budget.amount, 0) || 0
    const totalSpent = budgets?.reduce((sum, budget) => sum + Math.abs(budget.current_amount), 0) || 0
    const totalRemaining = totalBudget - totalSpent
    const overBudgetCount = budgets?.filter(budget => Math.abs(budget.current_amount) > budget.amount).length || 0

    return (
        <Card className="border-border/50 dark:border-border/20">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                    <PiggyBank className="h-5 w-5" />
                    {t('summary')}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-cyan-500/10 dark:from-blue-500/5 dark:to-cyan-500/5">
                        <DollarSign className="h-6 w-6 mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                        <p className="text-sm font-medium text-muted-foreground">{t('totalBudget')}</p>
                        <p className="text-xl font-bold text-foreground">
                            <AnimatedCounter value={totalBudget} prefix="$" decimals={2} />
                        </p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-gradient-to-br from-orange-500/10 to-red-500/10 dark:from-orange-500/5 dark:to-red-500/5">
                        <TrendingDown className="h-6 w-6 mx-auto mb-2 text-orange-600 dark:text-orange-400" />
                        <p className="text-sm font-medium text-muted-foreground">{t('totalSpent')}</p>
                        <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                            <AnimatedCounter value={totalSpent} prefix="$" decimals={2} />
                        </p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-500/10 dark:from-green-500/5 dark:to-emerald-500/5">
                        <TrendingUp className="h-6 w-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
                        <p className="text-sm font-medium text-muted-foreground">{t('totalRemaining')}</p>
                        <p className={`text-xl font-bold ${totalRemaining >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            <AnimatedCounter value={totalRemaining} prefix="$" decimals={2} />
                        </p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-gradient-to-br from-red-500/10 to-pink-500/10 dark:from-red-500/5 dark:to-pink-500/5">
                        <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-red-600 dark:text-red-400" />
                        <p className="text-sm font-medium text-muted-foreground">{t('exceededBudgets')}</p>
                        <p className="text-xl font-bold text-red-600 dark:text-red-400">
                            <AnimatedCounter value={overBudgetCount} />
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
