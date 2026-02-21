'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Pencil, Trash2, Check, X, AlertTriangle, Plus, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DatePicker } from '@/components/ui/date-picker'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { Transaction, TypeTransaction } from '@/types/transaction'
import { Category } from '@/types/category'
import { AIPotentialDuplicate } from '@/types/ai'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { useTranslations } from 'next-intl'

interface TransactionPreviewProps {
	transactions: Transaction[]
	categories: Category[]
	potentialDuplicatesByTransactionId?: Record<string, AIPotentialDuplicate>
	onEdit: (index: number, transaction: Transaction) => void
	onRemove: (index: number) => void
	onSelect: (index: number, selected: boolean) => void
	selectedIndices: Set<number>
	onCreateCategory?: () => void
}

export function TransactionPreview({
	transactions,
	categories,
	potentialDuplicatesByTransactionId,
	onEdit,
	onRemove,
	onSelect,
	selectedIndices,
	onCreateCategory,
}: TransactionPreviewProps) {
	const t = useTranslations('ai.preview')
	const tCommon = useTranslations('ai.common')
	const [editingIndex, setEditingIndex] = useState<number | null>(null)
	const [editForm, setEditForm] = useState<Transaction | null>(null)

	const startEdit = (index: number, transaction: Transaction) => {
		setEditingIndex(index)
		setEditForm({ ...transaction })
	}

	const saveEdit = () => {
		if (editingIndex !== null && editForm) {
			onEdit(editingIndex, editForm)
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
		try {
			return format(new Date(dateString), 'MMM d, yyyy')
		} catch {
			return t('invalidDate')
		}
	}

	if (transactions.length === 0) {
		return (
			<div className="text-center py-8 text-muted-foreground">
				{t('noTransactions')}
			</div>
		)
	}

	const duplicateEntries = Object.values(potentialDuplicatesByTransactionId || {})
	const duplicateCount = duplicateEntries.filter((item) => item.match_type === 'duplicate').length
	const similarCount = duplicateEntries.filter((item) => item.match_type === 'similar').length

	return (
		<div className="space-y-3">
			{potentialDuplicatesByTransactionId && Object.keys(potentialDuplicatesByTransactionId).length > 0 && (
				<div className="rounded-lg border border-orange-300/50 bg-orange-50/70 dark:bg-orange-950/20 p-3 text-sm">
					<div className="flex items-center gap-2 text-orange-700 dark:text-orange-300 font-medium">
						<AlertTriangle className="h-4 w-4" />
						<span>{t('duplicateWarningTitle')}</span>
					</div>
					<p className="text-muted-foreground mt-1">{t('duplicateWarningDescription')}</p>
					<div className="mt-2 flex flex-wrap gap-2 text-xs">
						{duplicateCount > 0 && (
							<span className="px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
								{t('possibleDuplicateCount', { count: duplicateCount })}
							</span>
						)}
						{similarCount > 0 && (
							<span className="px-2 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
								{t('similarTransactionCount', { count: similarCount })}
							</span>
						)}
					</div>
				</div>
			)}

			<div className="flex items-center justify-between mb-4">
				<span className="text-sm text-muted-foreground">
					{t('selectedCount', { selected: selectedIndices.size, total: transactions.length })}
				</span>
				<div className="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							transactions.forEach((_, i) => onSelect(i, true))
						}}
					>
						{t('selectAll')}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							transactions.forEach((_, i) => onSelect(i, false))
						}}
					>
						{t('deselectAll')}
					</Button>
				</div>
			</div>

			<AnimatePresence>
				{transactions.map((transaction, index) => {
					const isEditing = editingIndex === index
					const isSelected = selectedIndices.has(index)
					const isIncome = transaction.type_transation === TypeTransaction.INCOME
					const hasCategory = !!transaction.category_id
					const duplicateInfo = potentialDuplicatesByTransactionId?.[transaction.id]
					const isPossibleDuplicate = duplicateInfo?.match_type === 'duplicate'
					const isSimilarTransaction = duplicateInfo?.match_type === 'similar'

					return (
						<motion.div
							key={`transaction-${index}`}
							initial={{ opacity: 0, y: 10 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, x: -10 }}
							className={cn(
								'p-4 rounded-lg border transition-colors',
								isSelected ? 'border-primary bg-primary/5' : 'border-border',
								!hasCategory && 'border-yellow-500/50',
								isPossibleDuplicate && 'border-red-400/70 bg-red-50/40 dark:bg-red-950/20',
								isSimilarTransaction && 'border-orange-400/70 bg-orange-50/30 dark:bg-orange-950/20'
							)}
						>
							{isEditing && editForm ? (
								<div className="space-y-4">
									<div className="grid grid-cols-2 gap-3">
										<div>
											<label className="text-xs text-muted-foreground mb-1 block">
												{t('name')}
											</label>
											<Input
												value={editForm.name}
												onChange={(e) =>
													setEditForm({ ...editForm, name: e.target.value })
												}
												placeholder={t('name')}
											/>
										</div>
										<div>
											<label className="text-xs text-muted-foreground mb-1 block">
												{t('amount')}
											</label>
										<Input
											type="number"
											value={editForm.amount}
												onChange={(e) =>
													setEditForm({
														...editForm,
														amount: parseFloat(e.target.value) || 0,
													})
												}
											placeholder={t('amount')}
										/>
									</div>
									<div>
										<label className="text-xs text-muted-foreground mb-1 block">Currency</label>
										<Select
											value={editForm.currency || 'DOP'}
											onValueChange={(v) =>
												setEditForm({ ...editForm, currency: v as 'DOP' | 'USD' })
											}
										>
											<SelectTrigger>
												<SelectValue placeholder="DOP" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="DOP">DOP</SelectItem>
												<SelectItem value="USD">USD</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>

									<div>
										<label className="text-xs text-muted-foreground mb-1 block">
											{t('description')}
										</label>
										<Input
											value={editForm.description || ''}
											onChange={(e) =>
												setEditForm({ ...editForm, description: e.target.value })
											}
											placeholder={t('description')}
										/>
									</div>

									<div className="grid grid-cols-2 gap-3">
										<div>
											<label className="text-xs text-muted-foreground mb-1 block">
												{t('date')}
											</label>
											<DatePicker
												value={
													editForm.created_at
														? new Date(editForm.created_at)
														: new Date()
												}
												onChange={(date) =>
													setEditForm({
														...editForm,
														created_at: date?.toISOString() || '',
													})
												}
												placeholder={t('date')}
											/>
										</div>

										<div>
											<label className="text-xs text-muted-foreground mb-1 block">
												{t('category')}
											</label>
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
												<SelectTrigger>
													<SelectValue placeholder={t('selectCategory')} />
												</SelectTrigger>
												<SelectContent>
													{categories.map((cat) => (
														<SelectItem key={cat.id} value={cat.id}>
															{cat.icon} {cat.name}
														</SelectItem>
													))}
													<SelectSeparator />
													<SelectItem value="__create_new__">
														<Plus className="h-4 w-4 mr-1 inline" /> {t('createNewCategory')}
													</SelectItem>
												</SelectContent>
											</Select>
										</div>
									</div>

									<div className="flex justify-end gap-2">
										<Button size="sm" variant="outline" onClick={cancelEdit}>
											<X className="h-4 w-4 mr-1" />
											{tCommon('cancel')}
										</Button>
										<Button size="sm" onClick={saveEdit}>
											<Check className="h-4 w-4 mr-1" />
											{tCommon('save')}
										</Button>
									</div>
								</div>
							) : (
								<div className="flex items-start justify-between">
									<div className="flex items-start gap-3">
										<input
											type="checkbox"
											checked={isSelected}
											onChange={(e) => onSelect(index, e.target.checked)}
											className="mt-1 h-4 w-4 rounded border-gray-300"
										/>
										<div>
										<div className="flex items-center gap-2">
											<span className="font-medium">{transaction.name}</span>
											{isPossibleDuplicate && (
												<span className="text-[11px] px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
													{t('possibleDuplicate')}
												</span>
											)}
											{isSimilarTransaction && (
												<span className="text-[11px] px-2 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
													{t('similarTransaction')}
												</span>
											)}
											{!hasCategory && (
													<span
														className="text-yellow-500"
														title={t('noCategoryMatched')}
													>
														<AlertTriangle className="h-4 w-4" />
													</span>
												)}
										</div>
										{duplicateInfo && duplicateInfo.candidates.length > 0 && (
											<p className="text-xs text-muted-foreground mt-1">
												{t('matchedWith', {
													name: duplicateInfo.candidates[0].name,
													date: formatDate(duplicateInfo.candidates[0].created_at),
												})}
											</p>
										)}
										<p className="text-sm text-muted-foreground">
											{transaction.description}
											</p>
											<div className="flex items-center gap-2 mt-1 flex-wrap">
												<span className="text-lg">
													{isIncome
														? '💰'
														: getCategoryIcon(transaction.category_id)}
												</span>
												<span className="text-xs text-muted-foreground">
													{getCategoryName(transaction.category_id)}
												</span>
												<span
													className={cn(
														'text-xs px-2 py-0.5 rounded',
														isIncome
															? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
															: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
													)}
												>
													{isIncome ? t('income') : t('expense')}
												</span>
												<span className="text-xs text-muted-foreground flex items-center gap-1">
													<Calendar className="h-3 w-3" />
													{formatDate(transaction.created_at)}
												</span>
											</div>
										</div>
									</div>
									<div className="flex items-center gap-2">
										<span
											className={cn(
												'text-lg font-semibold',
												isIncome ? 'text-green-600' : 'text-red-600'
											)}
										>
											{isIncome ? '+' : '-'}{transaction.currency || 'DOP'} {transaction.amount.toFixed(2)}
										</span>
										<Button
											variant="ghost"
											size="icon"
											onClick={() => startEdit(index, transaction)}
										>
											<Pencil className="h-4 w-4" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											onClick={() => onRemove(index)}
										>
											<Trash2 className="h-4 w-4 text-destructive" />
										</Button>
									</div>
								</div>
							)}
						</motion.div>
					)
				})}
			</AnimatePresence>
		</div>
	)
}
