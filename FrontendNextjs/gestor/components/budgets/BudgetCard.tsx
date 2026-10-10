'use client'

import { AlertTriangle, CheckCircle, Clock, Edit, MoreHorizontal, PiggyBank, Target, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAppLocale } from '@/lib/i18n/date-locale'
import { formatCurrency } from '@/lib/utils'
import { Budget } from '@/types/budget'
import { Category } from '@/types/category'

export interface BudgetCardProps {
	budget: Budget
	category?: Category
	/** Expenses linked to the budget; undefined while loading. */
	transactionCount?: number
	onDelete: (_id: string) => void
	onEdit: (_budget: Budget) => void
}

export function BudgetCard({ budget, category, transactionCount, onDelete, onEdit }: BudgetCardProps) {
	const t = useTranslations('budgets')
	const tForms = useTranslations('forms')
	const locale = useAppLocale()
	const router = useRouter()
	const spentAmount = budget.current_amount
	const progressPercentage = budget.amount > 0 ? (spentAmount / budget.amount) * 100 : 0
	// The API sums the linked expenses converted to DOP (USD × rate), so budgets are DOP.
	const formatMoney = (value: number) => formatCurrency(value, 'DOP', { locale })
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
			console.error('Failed to delete budget', error)
		} finally {
			setIsDeleting(false)
		}
	}

	const handleEdit = (e: React.MouseEvent) => {
		e.stopPropagation()
		onEdit(budget)
	}

	const transactionsHref = `/app/transactions?budget=${budget.id}`
	const handleCardClick = () => {
		router.push(transactionsHref)
	}

	const getStatusColor = () => {
		if (isOverBudget) return 'destructive'
		if (progressPercentage > 80) return 'default'
		if (progressPercentage > 60) return 'secondary'
		return 'default'
	}

	const getStatusIcon = () => {
		if (isOverBudget) return <AlertTriangle className='h-4 w-4' />
		if (progressPercentage > 90) return <Clock className='h-4 w-4' />
		if (progressPercentage < 50) return <CheckCircle className='h-4 w-4' />
		return <Target className='h-4 w-4' />
	}

	return (
		<>
			<Card
				className='hover:bg-accent/40 dark:hover:bg-accent/40 transition-all duration-300 border-border/50 dark:border-border/20 group cursor-pointer'
				onClick={handleCardClick}
			>
				<CardContent className='p-4 sm:p-6'>
					<div className='flex items-center justify-between gap-2 mb-4'>
						<div className='flex min-w-0 items-center gap-3 sm:gap-4'>
							<div className='shrink-0 p-3 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 dark:from-blue-500/10 dark:to-purple-500/10'>
								<PiggyBank className='h-6 w-6 text-blue-600 dark:text-blue-400' />
							</div>
							<div className='min-w-0'>
								<Link
									href={transactionsHref}
									className='block truncate font-semibold text-foreground text-lg rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
									onClick={(e) => e.stopPropagation()}
								>
									{category ? `${t('budgetFor')} ${category.name}` : `${t('budget')} #${budget.id}`}
								</Link>
								<p className='text-sm text-muted-foreground flex items-center gap-1 truncate'>
									{category && (
										<>
											<span>{category.icon}</span>
											<span>{category.name}</span>
										</>
									)}
								</p>
							</div>
						</div>

						<div className='flex shrink-0 items-center gap-2'>
							<Badge variant={getStatusColor()} className='items-center gap-1 hidden sm:flex'>
								{getStatusIcon()}
								<span className='text-xs'>
									{isOverBudget ? t('exceeded') : progressPercentage > 80 ? t('critical') : t('active')}
								</span>
							</Badge>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant='ghost'
										size='sm'
										className='h-8 w-8 p-0'
										onClick={(e) => e.stopPropagation()}
										aria-label={t('edit')}
									>
										<MoreHorizontal className='h-4 w-4' aria-hidden='true' />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align='end' onClick={(e) => e.stopPropagation()}>
									<DropdownMenuItem className='flex items-center gap-2 cursor-pointer' onClick={handleEdit}>
										<Edit className='h-4 w-4' />
										{t('edit')}
									</DropdownMenuItem>
									<DropdownMenuItem
										className='flex items-center gap-2 cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400'
										onClick={(e) => {
											e.stopPropagation()
											setShowDeleteDialog(true)
										}}
									>
										<Trash2 className='h-4 w-4' />
										{t('delete')}
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>

					<div className='space-y-4'>
						<div className='flex justify-between items-center'>
							<span className='text-sm text-muted-foreground'>{t('budget')}</span>
							<span className='font-bold text-lg text-foreground tabular-nums'>{formatMoney(budget.amount)}</span>
						</div>

						<div className='flex justify-between items-center'>
							<span className='text-sm text-muted-foreground'>{t('spent')}</span>
							<span
								className={`font-bold text-lg tabular-nums ${isOverBudget ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`}
							>
								{formatMoney(spentAmount)}
							</span>
						</div>
						<p className='text-xs text-muted-foreground -mt-2'>{t('spentHint')}</p>

						<div className='flex justify-between items-center'>
							<span className='text-sm text-muted-foreground'>{t('remaining')}</span>
							<span
								className={`font-bold text-lg tabular-nums ${remaining >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
							>
								{formatMoney(remaining)}
							</span>
						</div>

						<div className='space-y-2'>
							<div className='flex justify-between items-center'>
								<span className='text-xs text-muted-foreground'>{t('progress')}</span>
								<span className='text-xs text-muted-foreground'>{Math.round(progressPercentage)}%</span>
							</div>
							<div className='relative h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700'>
								<div
									className='h-full transition-all duration-500 rounded-full'
									style={{
										width: `${Math.max(Math.min(progressPercentage, 100), progressPercentage > 0 ? 5 : 0)}%`,
										minWidth: progressPercentage > 0 ? '8px' : '0px',
										backgroundColor:
											progressPercentage > 80 ? '#ef4444' : progressPercentage > 60 ? '#eab308' : '#22c55e',
									}}
								/>
							</div>
						</div>

						<div className='flex justify-between items-center pt-2 border-t border-border/50'>
							<span className='text-xs text-muted-foreground'>{t('transactions')}</span>
							<span className='text-xs text-muted-foreground'>
								{transactionCount ?? '–'} {t('registered')}
							</span>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Sibling of the Card so clicks inside the (portaled) dialog don't trigger the Card navigation. */}
			<Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<DialogContent onClick={(e) => e.stopPropagation()}>
					<DialogHeader>
						<DialogTitle>{t('deleteTitle')}</DialogTitle>
						<DialogDescription>{t('deleteDescription')}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant='outline' onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
							{tForms('cancel')}
						</Button>
						<Button variant='destructive' onClick={handleDelete} disabled={isDeleting}>
							{isDeleting ? t('deleting') : tForms('delete')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}
