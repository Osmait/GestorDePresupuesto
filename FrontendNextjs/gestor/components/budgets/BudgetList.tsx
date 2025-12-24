'use client'

import { useBudgetContext } from '@/components/budgets/BudgetContext'
import { useRouter } from 'next/navigation'
import { useGetAllTransactions } from '@/hooks/queries/useTransactionsQuery'
import { useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import { BudgetsPageSkeleton } from './BudgetsPageSkeleton'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Budget } from '@/types/budget'
import { Category } from '@/types/category'
import { Transaction } from '@/types/transaction'
import {
    PiggyBank,
    TrendingUp,
    TrendingDown,
    Target,
    DollarSign,
    CheckCircle,
    Clock,
    AlertTriangle,
    PlusCircle,
    Trash2,
    MoreHorizontal,
    Edit
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { BudgetFormModal } from './BudgetFormModal'
import { AnimatedCounter } from '@/components/ui/animated-counter'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useTranslations } from 'next-intl'


// --- Helper Components copied from original BudgetsClient or improved ---

// Update BudgetCard props
interface BudgetCardProps {
    budget: Budget
    category?: Category
    transactions: Transaction[]
    onDelete: (id: string) => void
    onEdit: (budget: Budget) => void
}


function BudgetCard({ budget, category, transactions, onDelete, onEdit }: BudgetCardProps) {
    const t = useTranslations('budgets')
    const tForms = useTranslations('forms')
    const router = useRouter()
    const spentAmount = Math.abs(budget.current_amount)
    const progressPercentage = (spentAmount / budget.amount) * 100
    const remaining = budget.amount - spentAmount
    const isOverBudget = spentAmount > budget.amount

    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    const handleDelete = async (e?: React.MouseEvent) => {
        e?.stopPropagation()
        setIsDeleting(true)
        try {
            await onDelete(budget.id)
            setShowDeleteDialog(false)
        } catch (error) {
            console.error("Failed to delete budget", error)
        } finally {
            setIsDeleting(false)
        }
    }

    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation()
        onEdit(budget)
    }

    const handleCardClick = () => {
        router.push(`/app/transactions?budget=${budget.id}`)
    }

    const getStatusColor = () => {
        if (isOverBudget) return 'destructive'
        if (progressPercentage > 80) return 'default'
        if (progressPercentage > 60) return 'secondary'
        return 'default'
    }

    const getStatusIcon = () => {
        if (isOverBudget) return <AlertTriangle className="h-4 w-4" />
        if (progressPercentage > 90) return <Clock className="h-4 w-4" />
        if (progressPercentage < 50) return <CheckCircle className="h-4 w-4" />
        return <Target className="h-4 w-4" />
    }

    return (
        <Card
            className="hover:bg-accent/40 dark:hover:bg-accent/40 transition-all duration-300 border-border/50 dark:border-border/20 group cursor-pointer"
            onClick={handleCardClick}
        >
            <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                        <div className="p-3 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 dark:from-blue-500/10 dark:to-purple-500/10">
                            <PiggyBank className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div className="pr-2">
                            <p className="font-semibold text-foreground text-lg truncate max-w-[150px]">
                                {category ? `${t('budgetFor')} ${category.name}` : `${t('budget')} #${budget.id}`}
                            </p>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                                {category && (
                                    <>
                                        <span>{category.icon}</span>
                                        <span>{category.name}</span>
                                    </>
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Badge variant={getStatusColor()} className="flex items-center gap-1 hidden sm:flex">
                            {getStatusIcon()}
                            <span className="text-xs">
                                {isOverBudget ? t('exceeded') : progressPercentage > 80 ? t('critical') : t('active')}
                            </span>
                        </Badge>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem className="flex items-center gap-2 cursor-pointer" onClick={handleEdit}>
                                    <Edit className="h-4 w-4" />
                                    {t('edit')}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="flex items-center gap-2 cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setShowDeleteDialog(true)
                                    }}
                                >
                                    <Trash2 className="h-4 w-4" />
                                    {t('delete')}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">{t('budget')}</span>
                        <span className="font-bold text-lg text-foreground">
                            ${budget.amount.toLocaleString()}
                        </span>
                    </div>

                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">{t('spent')}</span>
                        <span className={`font-bold text-lg ${isOverBudget ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`}>
                            ${spentAmount.toLocaleString()}
                        </span>
                    </div>

                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">{t('remaining')}</span>
                        <span className={`font-bold text-lg ${remaining >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            ${remaining.toLocaleString()}
                        </span>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">{t('progress')}</span>
                            <span className="text-xs text-muted-foreground">
                                {Math.round(progressPercentage)}%
                            </span>
                        </div>
                        <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                            <div
                                className="h-full transition-all duration-500 rounded-full"
                                style={{
                                    width: `${Math.max(Math.min(progressPercentage, 100), progressPercentage > 0 ? 5 : 0)}%`,
                                    minWidth: progressPercentage > 0 ? '8px' : '0px',
                                    backgroundColor: progressPercentage > 80 ? '#ef4444' : progressPercentage > 60 ? '#eab308' : '#22c55e'
                                }}
                            />
                        </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-border/50">
                        <span className="text-xs text-muted-foreground">{t('transactions')}</span>
                        <span className="text-xs text-muted-foreground">
                            {transactions.length} {t('registered')}
                        </span>
                    </div>
                </div>
            </CardContent>

            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('deleteTitle')}</DialogTitle>
                        <DialogDescription>
                            {t('deleteDescription')}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowDeleteDialog(false)}
                            disabled={isDeleting}
                        >
                            {tForms('cancel')}
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? t('deleting') : tForms('delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}

function BudgetSummaryCard({ budgets, transactions }: { budgets: Budget[], transactions: Transaction[] }) {
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
                            <AnimatedCounter value={totalBudget} prefix="$" />
                        </p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-gradient-to-br from-orange-500/10 to-red-500/10 dark:from-orange-500/5 dark:to-red-500/5">
                        <TrendingDown className="h-6 w-6 mx-auto mb-2 text-orange-600 dark:text-orange-400" />
                        <p className="text-sm font-medium text-muted-foreground">{t('totalSpent')}</p>
                        <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                            <AnimatedCounter value={totalSpent} prefix="$" />
                        </p>
                    </div>
                    <div className="text-center p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-500/10 dark:from-green-500/5 dark:to-emerald-500/5">
                        <TrendingUp className="h-6 w-6 mx-auto mb-2 text-green-600 dark:text-green-400" />
                        <p className="text-sm font-medium text-muted-foreground">{t('totalRemaining')}</p>
                        <p className={`text-xl font-bold ${totalRemaining >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            <AnimatedCounter value={totalRemaining} prefix="$" />
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

export function BudgetList() {
    const t = useTranslations('budgets')
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
                <BudgetFormModal open={isModalOpen} setOpen={setModalOpen} />
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
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
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
            <BudgetFormModal open={isModalOpen} setOpen={setModalOpen} />
        </motion.div>
    )
}
