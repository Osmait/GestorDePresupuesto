import { ArrowDownRight, ArrowUpRight, Calendar, Edit, MoreHorizontal, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useContext, useState } from 'react'
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
import { Category } from '@/types/category'
import { Transaction, TypeTransaction } from '@/types/transaction'
import { TransactionContext } from './TransactionContext'

interface TransactionItemProps {
	transaction: Transaction
	category?: Category
	onTransactionDeleted?: () => void
	onEdit?: (_transaction: Transaction) => void
	onOpenDetails?: (_transaction: Transaction) => void
}

export default function TransactionItem({
	transaction,
	category,
	onTransactionDeleted,
	onEdit,
	onOpenDetails,
}: TransactionItemProps) {
	const t = useTranslations('transactions')
	const context = useContext(TransactionContext)
	const setEditingTransaction = context?.setEditingTransaction
	const setModalOpen = context?.setModalOpen
	// ... rest of the code ...
	// Inside the dropdown menu or button actions:
	// <DropdownMenuItem onClick={() => setEditingTransaction(transaction)}>
	//     <Edit className="mr-2 h-4 w-4" />
	//     Editar
	const [showDeleteDialog, setShowDeleteDialog] = useState(false)
	const [isDeleting, setIsDeleting] = useState(false)

	const isIncome =
		transaction.type_transation === TypeTransaction.INCOME ||
		transaction.type_transation === TypeTransaction.LOAN_COLLECTION

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

	const handleDeleteTransaction = async () => {
		if (!transaction.id || !onTransactionDeleted) return

		setIsDeleting(true)
		try {
			onTransactionDeleted()
			setShowDeleteDialog(false)
		} catch (error) {
			console.error('Error deleting transaction:', error)
		} finally {
			setIsDeleting(false)
		}
	}
	return (
		<Card
			className='hover:bg-accent/40 dark:hover:bg-accent/40 transition-colors duration-300 border-border/50 dark:border-border/20 cursor-pointer'
			onClick={() => onOpenDetails?.(transaction)}
		>
			<CardContent className='p-6'>
				<div className='flex items-center justify-between'>
					<div className='flex items-center space-x-4'>
						<div
							className={`p-3 rounded-full ${isIncome ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}
						>
							{isIncome ? (
								<ArrowUpRight className='h-5 w-5 text-green-600 dark:text-green-400' aria-hidden='true' />
							) : (
								<ArrowDownRight className='h-5 w-5 text-red-600 dark:text-red-400' aria-hidden='true' />
							)}
						</div>
						<div className='flex-1'>
							<div className='flex items-center gap-2 mb-1'>
								<p className='font-semibold text-foreground'>{transaction.name}</p>
								{loanMovementLabel && (
									<Badge variant='secondary' className='text-[10px] font-medium'>
										{loanMovementLabel}
									</Badge>
								)}
								{category && (
									<Badge variant='outline' className={`text-xs`} style={{ backgroundColor: category.color }}>
										<span aria-hidden='true'>{getCategoryIcon(category.icon)}</span> {category.name}
									</Badge>
								)}
							</div>
							<p className='text-sm text-muted-foreground mb-1'>{transaction.description}</p>
							<p className='text-sm text-muted-foreground flex items-center gap-1'>
								<Calendar className='h-3 w-3' aria-hidden='true' />
								{new Date(transaction.created_at).toLocaleDateString('es-ES', {
									day: 'numeric',
									month: 'long',
									year: 'numeric',
									hour: '2-digit',
									minute: '2-digit',
								})}
							</p>
						</div>
					</div>
					<div className='flex items-center gap-4'>
						<div className='text-right'>
							<p
								className={`font-bold text-xl ${isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
							>
								<span aria-hidden='true'>{isIncome ? '+' : '-'}</span>
								{new Intl.NumberFormat(transaction.currency === 'DOP' ? 'es-DO' : 'en-US', {
									style: 'currency',
									currency: transaction.currency || 'USD',
								}).format(transaction.amount)}
							</p>
							<p className='text-xs text-muted-foreground'>{transaction.currency || 'USD'}</p>
						</div>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant='ghost'
									size='sm'
									className='h-8 w-8 p-0'
									aria-label='Opciones de transacción'
									onClick={(event) => event.stopPropagation()}
								>
									<MoreHorizontal className='h-4 w-4' aria-hidden='true' />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align='end'>
								{(setEditingTransaction && setModalOpen) || onEdit ? (
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
										<Edit className='h-4 w-4' />
										{t('edit')}
									</DropdownMenuItem>
								) : null}
								<DropdownMenuItem
									className='flex items-center gap-2 cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400'
									onClick={(event) => {
										event.stopPropagation()
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
			</CardContent>

			<Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t('deleteTitle')}</DialogTitle>
						<DialogDescription>
							{t('deleteDescription', { name: transaction.description || transaction.name })}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant='outline' onClick={() => setShowDeleteDialog(false)} disabled={isDeleting}>
							{t('cancel')}
						</Button>
						<Button variant='destructive' onClick={handleDeleteTransaction} disabled={isDeleting}>
							{isDeleting ? t('deleting') : t('delete')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</Card>
	)
}
