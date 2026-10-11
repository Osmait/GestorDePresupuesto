import { ArrowDownRight, ArrowUpRight, Calendar, Edit, MoreHorizontal, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { memo, useContext, useState } from 'react'
import { toast } from 'sonner'
import { Amount } from '@/components/shared/Amount'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { formatLocalDate, useAppLocale } from '@/lib/i18n/date-locale'
import { getSignedAmount, isInflowTransaction } from '@/lib/transaction-utils'
import { Category } from '@/types/category'
import { Transaction, TypeTransaction } from '@/types/transaction'
import { TransactionActionsContext } from './TransactionContext'

interface TransactionItemProps {
	transaction: Transaction
	category?: Category
	onTransactionDeleted?: () => void | Promise<void>
	onEdit?: (_transaction: Transaction) => void
	onOpenDetails?: (_transaction: Transaction) => void
}

const stopPropagation = (event: { stopPropagation: () => void }) => event.stopPropagation()

function TransactionItem({ transaction, category, onTransactionDeleted, onEdit, onOpenDetails }: TransactionItemProps) {
	const t = useTranslations('transactions')
	const tCommon = useTranslations('common')
	const locale = useAppLocale()
	// Only the stable callbacks: rows must not re-render when the list data or the filters change.
	const actions = useContext(TransactionActionsContext)
	const setEditingTransaction = actions?.setEditingTransaction
	const setModalOpen = actions?.setModalOpen
	// The menu content and the delete dialog are mounted on first use only (then kept,
	// so their close animations still run): a list renders dozens of rows that are
	// never opened.
	const [menuOpen, setMenuOpen] = useState(false)
	const [menuMounted, setMenuMounted] = useState(false)
	const [showDeleteDialog, setShowDeleteDialog] = useState(false)
	const [deleteDialogMounted, setDeleteDialogMounted] = useState(false)

	const isIncome = isInflowTransaction(transaction.type_transation)
	const canEdit = Boolean(onEdit || (setEditingTransaction && setModalOpen))

	const getCategoryIcon = (icon?: string) => {
		if (!icon) return '🏷️'
		const normalized = icon.trim().toLowerCase()
		if (normalized === 'hand-coins' || normalized === 'hand_coins' || normalized === 'handcoins') return '💸'
		if (normalized === 'landmark' || normalized === 'bank' || normalized === 'coins') return '💰'
		if (normalized.includes('-') || normalized.includes('_')) return '🏷️'
		return icon
	}

	const getLoanMovementLabel = () => {
		if (transaction.type_transation === TypeTransaction.LOAN_COLLECTION) {
			return t('loanPrincipalCollection')
		}

		const categoryName = category?.name?.trim().toLowerCase()
		if (transaction.type_transation === TypeTransaction.INCOME && categoryName === 'intereses cobrados') {
			return t('loanInterestIncome')
		}

		return null
	}

	const loanMovementLabel = getLoanMovementLabel()

	// Returning the promise keeps the dialog open with a spinner until it settles;
	// on failure it stays open and the toast explains why.
	const handleDeleteTransaction = async () => {
		if (!transaction.id || !onTransactionDeleted) return
		try {
			await onTransactionDeleted()
		} catch (error) {
			toast.error(t('deleteError'))
			throw error
		}
	}

	return (
		<>
			<Card
				className='cursor-pointer transition-colors hover:bg-muted/40'
				onClick={() => onOpenDetails?.(transaction)}
				data-testid='transaction-card'
			>
				<CardContent className='p-4 sm:p-6'>
					<div className='flex items-start gap-3 sm:items-center sm:gap-4'>
						<div
							className={`shrink-0 rounded-full p-2 sm:p-3 ${isIncome ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}
						>
							{isIncome ? (
								<ArrowUpRight className='h-5 w-5' aria-hidden='true' />
							) : (
								<ArrowDownRight className='h-5 w-5' aria-hidden='true' />
							)}
						</div>
						<div className='min-w-0 flex-1'>
							<div className='flex flex-wrap items-center gap-x-2 gap-y-1 mb-1'>
								{onOpenDetails ? (
									<button
										type='button'
										className='max-w-full truncate text-left font-semibold text-foreground rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
										onClick={(event) => {
											event.stopPropagation()
											onOpenDetails(transaction)
										}}
									>
										{transaction.name}
									</button>
								) : (
									<p className='max-w-full truncate font-semibold text-foreground'>{transaction.name}</p>
								)}
								{loanMovementLabel && (
									<Badge variant='secondary' className='text-xs font-medium'>
										{loanMovementLabel}
									</Badge>
								)}
								{category && (
									<Badge variant='outline' className='max-w-full gap-1.5 truncate text-xs font-medium'>
										{/* User-chosen color as a dot: text keeps the theme's contrast. */}
										<span
											aria-hidden='true'
											className='h-2 w-2 shrink-0 rounded-full'
											style={{ backgroundColor: category.color }}
										/>
										<span aria-hidden='true'>{getCategoryIcon(category.icon)}</span>
										{category.name}
									</Badge>
								)}
							</div>
							{transaction.description && (
								<p className='text-sm text-muted-foreground mb-1 truncate'>{transaction.description}</p>
							)}
							<p className='text-xs sm:text-sm text-muted-foreground flex items-center gap-1'>
								<Calendar className='h-3 w-3 shrink-0' aria-hidden='true' />
								<span className='truncate'>
									{formatLocalDate(transaction.created_at, locale, {
										day: 'numeric',
										month: 'long',
										year: 'numeric',
										hour: '2-digit',
										minute: '2-digit',
									})}
								</span>
							</p>
						</div>
						<div className='flex shrink-0 items-start gap-1 sm:items-center sm:gap-4'>
							<Amount
								value={getSignedAmount(transaction)}
								currency={transaction.currency}
								tone='auto'
								signed
								className='text-right text-base font-semibold sm:text-lg'
							/>
							<DropdownMenu
								open={menuOpen}
								onOpenChange={(open) => {
									if (open) setMenuMounted(true)
									setMenuOpen(open)
								}}
							>
								<DropdownMenuTrigger asChild>
									<Button
										variant='ghost'
										size='icon'
										className='shrink-0'
										aria-label={tCommon('actions.rowMenu', { name: transaction.name })}
										onClick={stopPropagation}
									>
										<MoreHorizontal className='h-4 w-4' aria-hidden='true' />
									</Button>
								</DropdownMenuTrigger>
								{/* Content is portaled, but React events still bubble to the Card: stop them here. */}
								{menuMounted && (
									<DropdownMenuContent align='end' onClick={stopPropagation}>
										{canEdit ? (
											<DropdownMenuItem
												className='flex items-center gap-2 cursor-pointer'
												onClick={(event) => {
													event.stopPropagation()
													if (onEdit) {
														onEdit(transaction)
													} else if (setEditingTransaction && setModalOpen) {
														setEditingTransaction(transaction)
														setModalOpen(true)
													}
												}}
											>
												<Edit className='h-4 w-4' aria-hidden='true' />
												{t('edit')}
											</DropdownMenuItem>
										) : null}
										<DropdownMenuItem
											className='flex cursor-pointer items-center gap-2 text-destructive focus:text-destructive'
											onClick={(event) => {
												event.stopPropagation()
												setDeleteDialogMounted(true)
												setShowDeleteDialog(true)
											}}
										>
											<Trash2 className='h-4 w-4' aria-hidden='true' />
											{t('delete')}
										</DropdownMenuItem>
									</DropdownMenuContent>
								)}
							</DropdownMenu>
						</div>
					</div>
				</CardContent>
			</Card>

			{/*
			 * The confirmation dialog is a sibling of the Card, not a child: React
			 * propagates events through portals along the component tree, so a click
			 * on "Eliminar" inside the Card would also fire the Card's onClick and
			 * open the details of the transaction being deleted.
			 */}
			{deleteDialogMounted && (
				<ConfirmDialog
					open={showDeleteDialog}
					onOpenChange={setShowDeleteDialog}
					title={t('deleteTitle')}
					description={t('deleteDescription', { name: transaction.name?.trim() || transaction.description })}
					destructive
					onConfirm={handleDeleteTransaction}
				/>
			)}
		</>
	)
}

export default memo(TransactionItem)
