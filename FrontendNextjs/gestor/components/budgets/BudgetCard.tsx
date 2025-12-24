'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Budget } from '@/types/budget'
import { Category } from '@/types/category'
import { Transaction } from '@/types/transaction'
import {
    PiggyBank,
    Target,
    CheckCircle,
    Clock,
    AlertTriangle,
    Trash2,
    MoreHorizontal,
    Edit
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
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
import { formatCurrency } from '@/lib/utils'

export interface BudgetCardProps {
    budget: Budget
    category?: Category
    transactions: Transaction[]
    onDelete: (id: string) => void
    onEdit: (budget: Budget) => void
}

export function BudgetCard({ budget, category, transactions, onDelete, onEdit }: BudgetCardProps) {
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
                            {formatCurrency(budget.amount)}
                        </span>
                    </div>

                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">{t('spent')}</span>
                        <span className={`font-bold text-lg ${isOverBudget ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`}>
                            {formatCurrency(spentAmount)}
                        </span>
                    </div>

                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">{t('remaining')}</span>
                        <span className={`font-bold text-lg ${remaining >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {formatCurrency(remaining)}
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
