'use client'

import { AlertTriangle, CheckCircle, Clock, Edit, MoreHorizontal, PiggyBank, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { Amount } from '@/components/shared/Amount'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { getProgressTone, Progress } from '@/components/ui/progress'
import { useFormatPercent } from '@/hooks/useFormatPercent'
import { cn } from '@/lib/utils'
import { Budget } from '@/types/budget'
import { Category } from '@/types/category'

export interface BudgetCardProps {
	budget: Budget
	category?: Category
	/** Expenses linked to the budget; undefined while loading. */
	transactionCount?: number
	/** Omit both handlers for a read-only card (no menu). */
	onDelete?: (_id: string) => unknown
	onEdit?: (_budget: Budget) => void
	/** Dashboard variant: drops the spent hint and the transaction count. */
	compact?: boolean
}

export function BudgetCard({ budget, category, transactionCount, onDelete, onEdit, compact = false }: BudgetCardProps) {
	const t = useTranslations('budgets')
	const tCommon = useTranslations('common')
	const formatPercent = useFormatPercent()
	const [showDeleteDialog, setShowDeleteDialog] = useState(false)

	// The API sums the linked expenses converted to DOP (USD × rate), so budgets are DOP.
	const spentAmount = budget.current_amount
	const progressPercentage = budget.amount > 0 ? (spentAmount / budget.amount) * 100 : 0
	const remaining = budget.amount - spentAmount
	const isOverBudget = spentAmount > budget.amount
	const isCritical = !isOverBudget && progressPercentage > 80
	const name = category ? category.name : `#${budget.id}`
	const title = category ? `${t('budgetFor')} ${category.name}` : `${t('budget')} #${budget.id}`
	const transactionsHref = `/app/transactions?budget=${budget.id}`
	const hasActions = Boolean(onEdit || onDelete)

	const StatusIcon = isOverBudget ? AlertTriangle : progressPercentage > 90 ? Clock : CheckCircle

	const handleDelete = async () => {
		if (!onDelete) return
		try {
			await onDelete(budget.id)
		} catch (error) {
			toast.error(t('deleteError'))
			throw error
		}
	}

	return (
		<>
			{/* The title is a real link stretched over the card; the menu sits above it (z-10). */}
			<Card className='relative transition-colors hover:bg-muted/40 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-offset-2 has-[a:focus-visible]:ring-offset-background'>
				<CardContent className='p-5'>
					<div className='mb-4 flex items-start justify-between gap-2'>
						<div className='flex min-w-0 items-center gap-3'>
							{category ? (
								<div
									className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg'
									style={{ backgroundColor: category.color }}
									aria-hidden='true'
								>
									{category.icon}
								</div>
							) : (
								<div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted'>
									<PiggyBank className='h-5 w-5 text-muted-foreground' aria-hidden='true' />
								</div>
							)}
							<div className='min-w-0 space-y-1'>
								<Link
									href={transactionsHref}
									className='block truncate text-base font-semibold text-foreground focus-visible:outline-none after:absolute after:inset-0'
								>
									{title}
								</Link>
								<Badge
									variant='outline'
									className={cn(
										'gap-1 font-medium',
										isOverBudget && 'border-destructive/40 text-destructive',
										isCritical && 'border-warning/40 text-warning',
									)}
								>
									<StatusIcon className='h-3 w-3' aria-hidden='true' />
									{isOverBudget ? t('exceeded') : isCritical ? t('critical') : t('active')}
								</Badge>
							</div>
						</div>

						{hasActions ? (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant='ghost'
										size='icon'
										className='relative z-10 shrink-0'
										aria-label={tCommon('actions.rowMenu', { name })}
									>
										<MoreHorizontal className='h-4 w-4' aria-hidden='true' />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align='end'>
									{onEdit ? (
										<DropdownMenuItem className='flex items-center gap-2' onSelect={() => onEdit(budget)}>
											<Edit className='h-4 w-4' aria-hidden='true' />
											{t('edit')}
										</DropdownMenuItem>
									) : null}
									{onDelete ? (
										<DropdownMenuItem
											className='flex items-center gap-2 text-destructive focus:text-destructive'
											onSelect={() => setShowDeleteDialog(true)}
										>
											<Trash2 className='h-4 w-4' aria-hidden='true' />
											{t('delete')}
										</DropdownMenuItem>
									) : null}
								</DropdownMenuContent>
							</DropdownMenu>
						) : null}
					</div>

					<dl className='space-y-2 text-sm'>
						<div className='flex items-baseline justify-between gap-2'>
							<dt className='text-muted-foreground'>{t('budget')}</dt>
							<dd className='font-semibold'>
								<Amount value={budget.amount} currency='DOP' />
							</dd>
						</div>
						<div className='flex items-baseline justify-between gap-2'>
							<dt className='text-muted-foreground'>{t('spent')}</dt>
							<dd className='font-semibold'>
								<Amount value={spentAmount} currency='DOP' tone={isOverBudget ? 'negative' : 'neutral'} />
							</dd>
						</div>
						<div className='flex items-baseline justify-between gap-2'>
							<dt className='text-muted-foreground'>{t('remaining')}</dt>
							<dd className='font-semibold'>
								<Amount value={remaining} currency='DOP' tone={remaining < 0 ? 'negative' : 'neutral'} />
							</dd>
						</div>
					</dl>
					{compact ? null : <p className='mt-1 text-xs text-muted-foreground'>{t('spentHint')}</p>}

					<div className='mt-4 space-y-2'>
						<div className='flex items-center justify-between text-xs text-muted-foreground'>
							<span>{t('progress')}</span>
							<span className='tabular-nums'>{formatPercent(progressPercentage, { maximumFractionDigits: 0 })}</span>
						</div>
						<Progress
							value={progressPercentage}
							tone={getProgressTone(progressPercentage)}
							aria-label={t('progressLabel', { name })}
						/>
					</div>

					{compact ? null : (
						<div className='mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground'>
							<span>{t('transactions')}</span>
							<span className='tabular-nums'>
								{transactionCount ?? '–'} {t('registered')}
							</span>
						</div>
					)}
				</CardContent>
			</Card>

			{onDelete ? (
				<ConfirmDialog
					open={showDeleteDialog}
					onOpenChange={setShowDeleteDialog}
					title={t('deleteTitle', { name })}
					description={tCommon('confirm.irreversible')}
					destructive
					onConfirm={handleDelete}
				/>
			) : null}
		</>
	)
}
