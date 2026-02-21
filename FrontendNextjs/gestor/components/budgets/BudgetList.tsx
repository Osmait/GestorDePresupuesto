'use client'

import { useBudgetContext } from '@/components/budgets/BudgetContext'
import { useGetAllTransactions } from '@/hooks/queries/useTransactionsQuery'
import { useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import { BudgetsPageSkeleton } from './BudgetsPageSkeleton'
import { motion, AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Budget } from '@/types/budget'
import { Transaction } from '@/types/transaction'
import { PiggyBank, AlertTriangle, PlusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BudgetFormModal } from './BudgetFormModal'
import { useTranslations } from 'next-intl'
import { BudgetCard } from './BudgetCard'
import { BudgetSummaryCard } from './BudgetSummaryCard'


export function BudgetList() {
    const t = useTranslations('budgets')
    const router = useRouter()
    const searchParams = useSearchParams()
    const { budgets, isLoading, error, deleteBudget, setEditingBudget, isModalOpen, setModalOpen } = useBudgetContext()
    const { data: categories = [] } = useGetCategories()
    const { data: transactions = [] } = useGetAllTransactions()

    function getBudgetTransactions(budgetId: string) {
        return transactions?.filter((t: Transaction) => t.budget_id === budgetId && t.type_transation === 'bill') || []
    }

    const handleEdit = (budget: Budget) => {
        setEditingBudget(budget)
        setModalOpen(true)
    }

    const suggestedCategoryId = searchParams.get('category') || ''
    const selectedBudgetId = searchParams.get('selected') || ''

    useEffect(() => {
        const shouldOpenCreate = searchParams.get('create') === '1'
        if (!shouldOpenCreate) return

        setEditingBudget(null)
        setModalOpen(true)
        router.replace('/app/budget', { scroll: false })
    }, [router, searchParams, setEditingBudget, setModalOpen])

    useEffect(() => {
        if (!selectedBudgetId) return
        const element = document.getElementById(`budget-card-${selectedBudgetId}`)
        if (!element) return
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, [selectedBudgetId, budgets])

    if (isLoading) {
        return <BudgetsPageSkeleton />
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <AlertTriangle className="h-16 w-16 text-red-500 mb-4" />
                <h2 className="text-2xl font-bold text-foreground mb-2">{t('errorLoading')}</h2>
                <p className="text-muted-foreground text-center max-w-md">{error}</p>
                <Button className="mt-4" onClick={() => window.location.reload()}>{t('tryAgain')}</Button>
            </div>
        )
    }

    if (!budgets || budgets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <div className="p-6 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 dark:from-blue-500/10 dark:to-purple-500/10 mb-6">
                    <PiggyBank className="h-16 w-16 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">{t('noBudgets')}</h2>
                <p className="text-muted-foreground text-center max-w-md mb-6">
                    {t('noBudgetsDescription')}
                </p>
                <Button
                    className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                    onClick={() => setModalOpen(true)}
                >
                    <PlusCircle className="h-4 w-4 mr-2" />
                    {t('createFirstBudget')}
                </Button>
                <BudgetFormModal open={isModalOpen} setOpen={setModalOpen} initialCategoryId={suggestedCategoryId} />
            </div>
        )
    }

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
        >
            <div className="mb-8">
                <BudgetSummaryCard budgets={budgets} transactions={transactions} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout" initial={false}>
                    {budgets.map(budget => {
                        const category = categories?.find(c => c.id === budget.category_id)
                        const txs = getBudgetTransactions(budget.id)
                        return (
                            <motion.div
                                key={budget.id}
                                id={`budget-card-${budget.id}`}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                                className={selectedBudgetId === budget.id ? 'rounded-xl ring-2 ring-primary/70 ring-offset-2 ring-offset-background' : ''}
                            >
                                <BudgetCard
                                    budget={budget}
                                    category={category}
                                    transactions={txs}
                                    onDelete={deleteBudget}
                                    onEdit={handleEdit}
                                />
                            </motion.div>
                        )
                    })}
                </AnimatePresence>
            </div>

            {/* Context-controlled Modal for Edit/Create */}
            <BudgetFormModal open={isModalOpen} setOpen={setModalOpen} initialCategoryId={suggestedCategoryId} />
        </motion.div>
    )
}
