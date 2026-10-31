'use client'

import { AlertTriangle, Calendar, Check, FileSearch, Pencil, Plus, Trash2, X } from 'lucide-react'
import { AnimatePresence, domAnimation, LazyMotion, m } from 'motion/react'
import { useTranslations } from 'next-intl'
import { type ReactNode, useId, useState } from 'react'
import { Amount } from '@/components/shared/Amount'
import { EmptyState } from '@/components/shared/EmptyState'
import { MoneyInput } from '@/components/shared/MoneyInput'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useUniqueCategoryName } from '@/hooks/useUniqueCategoryName'
import { calendarDateParts, calendarDateToNoonUTC, getAppTodayDate, parseCalendarDate } from '@/lib/app-time'
import { formatLocalDate, useAppLocale } from '@/lib/i18n/date-locale'
import { moneyInputToNumber, toMoneyInputText } from '@/lib/money-input'
import { cn } from '@/lib/utils'
import { AICategorySuggestion, AIPotentialDuplicate } from '@/types/ai'
import { Category } from '@/types/category'
import { Transaction, TypeTransaction } from '@/types/transaction'

interface TransactionPreviewProps {
	transactions: Transaction[]
	categories: Category[]
	potentialDuplicatesByTransactionId?: Record<string, AIPotentialDuplicate>
	categorySuggestionsByTransactionId?: Record<string, AICategorySuggestion>
	onEdit: (index: number, transaction: Transaction) => void
	onRemove: (index: number) => void
	onSelect: (index: number, selected: boolean) => void
	selectedIndices: Set<number>
	onCreateCategory?: () => void
	onApplyCategorySuggestion?: (transactionId: string) => void
	onCreateCategoryFromSuggestion?: (transactionId: string, categoryName: string) => void
}

type ChipTone = 'destructive' | 'warning' | 'success' | 'muted'

const CHIP_TONE: Record<ChipTone, string> = {
	destructive: 'bg-destructive/10 text-destructive',
	warning: 'bg-warning/10 text-warning',
	success: 'bg-success/10 text-success',
	muted: 'bg-muted text-muted-foreground',
}

/** Small status label. Tokens only (DESIGN.md > Status colors). */
function Chip({ tone, children }: { tone: ChipTone; children: ReactNode }) {
	return <span className={cn('rounded px-2 py-0.5 text-xs font-medium', CHIP_TONE[tone])}>{children}</span>
}

const CONFIDENCE_TONE: Record<string, ChipTone> = { high: 'success', medium: 'warning', low: 'muted' }

// m + LazyMotion(domAnimation) instead of motion: only fades/scales are used, so the
// full feature bundle (layout, drag) is not needed.
export function TransactionPreview(props: TransactionPreviewProps) {
	return (
		<LazyMotion features={domAnimation}>
			<TransactionPreviewView {...props} />
		</LazyMotion>
	)
}

function TransactionPreviewView({
	transactions,
	categories,
	potentialDuplicatesByTransactionId,
	categorySuggestionsByTransactionId,
	onEdit,
	onRemove,
	onSelect,
	selectedIndices,
	onCreateCategory,
	onApplyCategorySuggestion,
	onCreateCategoryFromSuggestion,
}: TransactionPreviewProps) {
	const t = useTranslations('ai.preview')
	const tCommon = useTranslations('ai.common')
	const uniqueCategoryName = useUniqueCategoryName()
	const tForms = useTranslations('forms')
	const locale = useAppLocale()
	const idPrefix = useId()
	const [editingIndex, setEditingIndex] = useState<number | null>(null)
	const [editForm, setEditForm] = useState<Transaction | null>(null)
	// The amount is edited as text (decimal comma or point) and parsed on save.
	const [amountText, setAmountText] = useState('')
	const editAmount = moneyInputToNumber(amountText)
	const editAmountValid = editAmount > 0

	const startEdit = (index: number, transaction: Transaction) => {
		setEditingIndex(index)
		setEditForm({ ...transaction })
		setAmountText(toMoneyInputText(transaction.amount))
	}

	const saveEdit = () => {
		if (editingIndex !== null && editForm && editAmountValid) {
			onEdit(editingIndex, { ...editForm, amount: editAmount })
			setEditingIndex(null)
			setEditForm(null)
		}
	}

	const cancelEdit = () => {
		setEditingIndex(null)
		setEditForm(null)
	}

	const getCategoryName = (categoryId: string) => {
		const category = categories.find((c) => c.id === categoryId)
		return category?.name || t('uncategorized')
	}

	const getCategoryIcon = (categoryId: string) => {
		const category = categories.find((c) => c.id === categoryId)
		return category?.icon || '📦'
	}

	const formatDate = (dateString: string) => {
		const formatted = formatLocalDate(dateString, locale)
		return formatted === '-' ? t('invalidDate') : formatted
	}

	if (transactions.length === 0) {
		return (
			<EmptyState compact icon={FileSearch} title={t('noTransactions')} description={t('noTransactionsDescription')} />
		)
	}

	const duplicateEntries = Object.values(potentialDuplicatesByTransactionId || {})
	const duplicateCount = duplicateEntries.filter((item) => item.match_type === 'duplicate').length
	const similarCount = duplicateEntries.filter((item) => item.match_type === 'similar').length

	return (
		<div className='space-y-3'>
			{duplicateEntries.length > 0 && (
				<div role='status' className='rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm'>
					<div className='flex items-center gap-2 font-medium text-warning'>
						<AlertTriangle className='h-4 w-4 shrink-0' aria-hidden='true' />
						<span>{t('duplicateWarningTitle')}</span>
					</div>
					<p className='mt-1 text-foreground/80'>{t('duplicateWarningDescription')}</p>
					<div className='mt-2 flex flex-wrap gap-2'>
						{duplicateCount > 0 && (
							<Chip tone='destructive'>{t('possibleDuplicateCount', { count: duplicateCount })}</Chip>
						)}
						{similarCount > 0 && <Chip tone='warning'>{t('similarTransactionCount', { count: similarCount })}</Chip>}
					</div>
				</div>
			)}

			<div className='flex flex-wrap items-center justify-between gap-2'>
				<span className='text-sm text-muted-foreground tabular-nums' aria-live='polite'>
					{t('selectedCount', { selected: selectedIndices.size, total: transactions.length })}
				</span>
				<div className='flex gap-2'>
					<Button
						type='button'
						variant='outline'
						size='sm'
						onClick={() => {
							for (let i = 0; i < transactions.length; i++) onSelect(i, true)
						}}
					>
						{t('selectAll')}
					</Button>
					<Button
						type='button'
						variant='outline'
						size='sm'
						onClick={() => {
							for (let i = 0; i < transactions.length; i++) onSelect(i, false)
						}}
					>
						{t('deselectAll')}
					</Button>
				</div>
			</div>

			<ul className='space-y-3'>
				<AnimatePresence>
					{transactions.map((transaction, index) => {
						const isEditing = editingIndex === index
						const isSelected = selectedIndices.has(index)
						const isIncome = transaction.type_transation === TypeTransaction.INCOME
						const hasCategory = !!transaction.category_id
						const duplicateInfo = potentialDuplicatesByTransactionId?.[transaction.id]
						const categorySuggestion = categorySuggestionsByTransactionId?.[transaction.id]
						const createSuggestedName = categorySuggestion
							? uniqueCategoryName(
									categorySuggestion.new_category_name || categorySuggestion.category_name,
									categories.map((category) => category.name),
								)
							: ''
						const isPossibleDuplicate = duplicateInfo?.match_type === 'duplicate'
						const isSimilarTransaction = duplicateInfo?.match_type === 'similar'
						const rowId = `${idPrefix}-${index}`

						return (
							<m.li
								key={transaction.id || `transaction-${index}`}
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, x: -10 }}
								className={cn(
									'rounded-lg border p-3 transition-colors sm:p-4',
									isSelected ? 'border-primary bg-primary/5' : 'border-border',
									!hasCategory && 'border-warning/60',
									isPossibleDuplicate && 'border-destructive/60 bg-destructive/5',
									isSimilarTransaction && 'border-warning/60 bg-warning/5',
								)}
							>
								{isEditing && editForm ? (
									<div className='space-y-4'>
										<div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
											<div className='space-y-1.5 sm:col-span-3'>
												<Label htmlFor={`${rowId}-name`}>{t('name')}</Label>
												<Input
													id={`${rowId}-name`}
													value={editForm.name}
													onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
												/>
											</div>
											<div className='space-y-1.5 sm:col-span-2'>
												<Label htmlFor={`${rowId}-amount`}>{t('amount')}</Label>
												<MoneyInput
													id={`${rowId}-amount`}
													value={amountText}
													onChange={(e) => setAmountText(e.target.value)}
													aria-invalid={!editAmountValid}
													aria-describedby={editAmountValid ? undefined : `${rowId}-amount-error`}
												/>
												{editAmountValid ? null : (
													<p id={`${rowId}-amount-error`} className='text-xs font-medium text-destructive'>
														{tForms('invalidAmount')}
													</p>
												)}
											</div>
											<div className='space-y-1.5'>
												<Label htmlFor={`${rowId}-currency`}>{t('currency')}</Label>
												<Select
													value={editForm.currency || 'DOP'}
													onValueChange={(v) => setEditForm({ ...editForm, currency: v as 'DOP' | 'USD' })}
												>
													<SelectTrigger id={`${rowId}-currency`}>
														<SelectValue placeholder='DOP' />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value='DOP'>DOP</SelectItem>
														<SelectItem value='USD'>USD</SelectItem>
													</SelectContent>
												</Select>
											</div>
										</div>

										<div className='space-y-1.5'>
											<Label htmlFor={`${rowId}-description`}>{t('description')}</Label>
											<Input
												id={`${rowId}-description`}
												value={editForm.description || ''}
												onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
											/>
										</div>

										<div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
											<fieldset className='min-w-0'>
												<legend className='mb-1.5 text-sm font-medium leading-none'>{t('date')}</legend>
												<DatePicker
													// Calendar days: a statement date is a day, not an instant.
													value={editForm.created_at ? parseCalendarDate(editForm.created_at) : getAppTodayDate()}
													onChange={(date) =>
														setEditForm({
															...editForm,
															// That day at 12:00 UTC: the same day in UTC and Santo Domingo.
															created_at: date ? calendarDateToNoonUTC(calendarDateParts(date)).toISOString() : '',
														})
													}
													placeholder={t('date')}
												/>
											</fieldset>

											<div className='space-y-1.5'>
												<Label htmlFor={`${rowId}-category`}>{t('category')}</Label>
												<Select
													value={editForm.category_id || ''}
													onValueChange={(v) => {
														if (v === '__create_new__') {
															onCreateCategory?.()
														} else {
															setEditForm({ ...editForm, category_id: v })
														}
													}}
												>
													<SelectTrigger id={`${rowId}-category`}>
														<SelectValue placeholder={t('selectCategory')} />
													</SelectTrigger>
													<SelectContent>
														{categories.map((cat) => (
															<SelectItem key={cat.id} value={cat.id}>
																<span aria-hidden='true'>{cat.icon}</span> {cat.name}
															</SelectItem>
														))}
														<SelectSeparator />
														<SelectItem value='__create_new__'>
															<Plus className='mr-1 inline h-4 w-4' aria-hidden='true' /> {t('createNewCategory')}
														</SelectItem>
													</SelectContent>
												</Select>
											</div>
										</div>

										<div className='flex justify-end gap-2'>
											<Button type='button' size='sm' variant='outline' onClick={cancelEdit}>
												<X className='mr-1 h-4 w-4' aria-hidden='true' />
												{tCommon('cancel')}
											</Button>
											<Button type='button' size='sm' onClick={saveEdit} disabled={!editAmountValid}>
												<Check className='mr-1 h-4 w-4' aria-hidden='true' />
												{tCommon('save')}
											</Button>
										</div>
									</div>
								) : (
									<div className='flex items-start gap-3'>
										<Checkbox
											id={`${rowId}-select`}
											checked={isSelected}
											onCheckedChange={(checked) => onSelect(index, checked === true)}
											className='mt-1'
										/>
										<div className='min-w-0 flex-1 space-y-1'>
											<div className='flex flex-wrap items-start justify-between gap-x-3 gap-y-1'>
												<div className='flex min-w-0 flex-wrap items-center gap-2'>
													<Label htmlFor={`${rowId}-select`} className='cursor-pointer break-words font-medium'>
														{transaction.name}
													</Label>
													{isPossibleDuplicate && <Chip tone='destructive'>{t('possibleDuplicate')}</Chip>}
													{isSimilarTransaction && <Chip tone='warning'>{t('similarTransaction')}</Chip>}
													{!hasCategory && (
														<span className='inline-flex items-center gap-1 text-xs text-warning'>
															<AlertTriangle className='h-3.5 w-3.5' aria-hidden='true' />
															{t('noCategoryMatched')}
														</span>
													)}
												</div>
												<Amount
													value={isIncome ? transaction.amount : -transaction.amount}
													currency={transaction.currency || 'DOP'}
													tone='auto'
													signed
													className='text-base font-semibold'
												/>
											</div>
											{duplicateInfo && duplicateInfo.candidates.length > 0 && (
												<p className='text-xs text-muted-foreground'>
													{t('matchedWith', {
														name: duplicateInfo.candidates[0].name,
														date: formatDate(duplicateInfo.candidates[0].created_at),
													})}
												</p>
											)}
											{categorySuggestion &&
												(!hasCategory || transaction.category_id !== categorySuggestion.category_id) && (
													<div className='flex flex-wrap items-center gap-2 pt-1'>
														<Chip tone={CONFIDENCE_TONE[categorySuggestion.confidence] ?? 'muted'}>
															{t('suggestedCategory', {
																name: categorySuggestion.category_name,
																confidence: t(`confidence.${categorySuggestion.confidence}`),
															})}
														</Chip>
														<Button
															type='button'
															variant='outline'
															size='sm'
															onClick={() => onApplyCategorySuggestion?.(transaction.id)}
														>
															{t('applySuggestion')}
														</Button>
														<Button
															type='button'
															variant='secondary'
															size='sm'
															title={createSuggestedName}
															onClick={() => onCreateCategoryFromSuggestion?.(transaction.id, createSuggestedName)}
														>
															{t('createSuggestedCategory')}
														</Button>
													</div>
												)}
											{transaction.description && (
												<p className='text-sm text-muted-foreground'>{transaction.description}</p>
											)}
											<div className='flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground'>
												<span className='inline-flex items-center gap-1'>
													<span aria-hidden='true'>{isIncome ? '💰' : getCategoryIcon(transaction.category_id)}</span>
													{getCategoryName(transaction.category_id)}
												</span>
												<Chip tone={isIncome ? 'success' : 'destructive'}>{isIncome ? t('income') : t('expense')}</Chip>
												<span className='inline-flex items-center gap-1'>
													<Calendar className='h-3 w-3' aria-hidden='true' />
													{formatDate(transaction.created_at)}
												</span>
											</div>
										</div>
										<div className='-mr-2 -mt-2 flex shrink-0 items-center'>
											<Button
												type='button'
												variant='ghost'
												size='icon'
												onClick={() => startEdit(index, transaction)}
												aria-label={t('editTransaction', { name: transaction.name })}
											>
												<Pencil className='h-4 w-4' aria-hidden='true' />
											</Button>
											<Button
												type='button'
												variant='ghost'
												size='icon'
												className='text-destructive hover:text-destructive'
												onClick={() => onRemove(index)}
												aria-label={t('removeTransaction', { name: transaction.name })}
											>
												<Trash2 className='h-4 w-4' aria-hidden='true' />
											</Button>
										</div>
									</div>
								)}
							</m.li>
						)
					})}
				</AnimatePresence>
			</ul>
		</div>
	)
}
