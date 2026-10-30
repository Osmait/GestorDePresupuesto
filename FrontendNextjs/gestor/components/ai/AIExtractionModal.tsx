'use client'

import { AlertCircle, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCallback, useId, useState } from 'react'
import { toast } from 'sonner'
import { DEFAULT_CATEGORY_COLOR } from '@/components/shared/ColorSwatchPicker'
import { FormDialog } from '@/components/shared/FormDialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { useExtractFromFile } from '@/hooks/queries/useAIQuery'
import { useCreateCategoryMutation, useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import { useCreateTransactionMutation } from '@/hooks/queries/useTransactionsQuery'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import { extractedDateToInstant } from '@/lib/app-time'
import { AICategorySuggestion, AIExtractResponse, AIPotentialDuplicate, DocumentType } from '@/types/ai'
import { Category } from '@/types/category'
import { Transaction, TypeTransaction } from '@/types/transaction'
import { DocumentUploader } from './DocumentUploader'
import { QuickCategoryCreate } from './QuickCategoryCreate'
import { TransactionPreview } from './TransactionPreview'

interface AIExtractionModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	defaultAccountId?: string
}

function ensureUniqueCategoryName(baseName: string, existingNames: string[]): string {
	const normalized = new Set(existingNames.map((name) => name.trim().toLowerCase()))
	const cleanBase = baseName.trim() || 'Nueva categoría'

	if (!normalized.has(cleanBase.toLowerCase())) {
		return cleanBase
	}

	let candidate = `${cleanBase} (IA)`
	let index = 2
	while (normalized.has(candidate.toLowerCase())) {
		candidate = `${cleanBase} (IA ${index})`
		index++
	}

	return candidate
}

export function AIExtractionModal({ open, onOpenChange, defaultAccountId }: AIExtractionModalProps) {
	const t = useTranslations('ai.extraction')
	const tCommon = useTranslations('ai.common')
	const fieldId = useId()
	const [files, setFiles] = useState<File[]>([])
	const [documentType, setDocumentType] = useState<DocumentType>('receipt')
	const [accountId, setAccountId] = useState<string>(defaultAccountId || '')
	const [extractedTransactions, setExtractedTransactions] = useState<Transaction[]>([])
	const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
	const [step, setStep] = useState<'upload' | 'preview' | 'saving'>('upload')
	const [showQuickCategory, setShowQuickCategory] = useState(false)
	const [potentialDuplicatesByTransactionId, setPotentialDuplicatesByTransactionId] = useState<
		Record<string, AIPotentialDuplicate>
	>({})
	const [categorySuggestionsByTransactionId, setCategorySuggestionsByTransactionId] = useState<
		Record<string, AICategorySuggestion>
	>({})
	const [_pendingCategorySelection, setPendingCategorySelection] = useState<{
		index: number
	} | null>(null)

	const { extract, isExtracting, extractData, reset } = useExtractFromFile()
	const { isEnabled } = useFeatureFlags()
	const { data: categories = [], refetch: refetchCategories } = useGetCategories()
	const { data: accounts = [] } = useGetAccounts()
	const createTransaction = useCreateTransactionMutation()
	const createCategoryMutation = useCreateCategoryMutation()

	const handleFilesSelected = useCallback((selectedFiles: File[]) => {
		setFiles(selectedFiles)
	}, [])

	const handleExtract = async () => {
		if (files.length === 0 || !accountId) {
			toast.error(t('selectFilesAndAccount'))
			return
		}

		const selectedAccount = accounts.find((a) => a.id === accountId)

		const result = await extract(files, accountId, documentType, selectedAccount?.currency || 'DOP')

		if ('success' in result && result.success) {
			const response = result as AIExtractResponse
			const normalizedTransactions = response.data.transactions.map((transaction) => ({
				...transaction,
				account_id: transaction.account_id || accountId,
				currency: transaction.currency || selectedAccount?.currency || 'DOP',
			}))
			setExtractedTransactions(normalizedTransactions)

			const duplicatesMap = (response.data.potential_duplicates || []).reduce(
				(acc, duplicate) => {
					acc[duplicate.extracted_transaction_id] = duplicate
					return acc
				},
				{} as Record<string, AIPotentialDuplicate>,
			)
			setPotentialDuplicatesByTransactionId(duplicatesMap)

			const categorySuggestionsMap = isEnabled('ai_category_suggestions')
				? (response.data.category_suggestions || []).reduce(
						(acc, suggestion) => {
							if (suggestion.transaction_id) {
								acc[suggestion.transaction_id] = suggestion
							}
							return acc
						},
						{} as Record<string, AICategorySuggestion>,
					)
				: {}
			setCategorySuggestionsByTransactionId(categorySuggestionsMap)

			const initialSelection = new Set<number>()
			normalizedTransactions.forEach((transaction, index) => {
				const duplicateInfo = duplicatesMap[transaction.id]
				if (duplicateInfo?.match_type !== 'duplicate') {
					initialSelection.add(index)
				}
			})
			setSelectedIndices(initialSelection)
			setStep('preview')
			toast.success(t('extractedCount', { count: response.data.count }))
		} else {
			toast.error(t('failedToExtract'))
		}
	}

	const handleEdit = (index: number, transaction: Transaction) => {
		const updated = [...extractedTransactions]
		updated[index] = transaction
		setExtractedTransactions(updated)
	}

	const handleRemove = (index: number) => {
		const updated = extractedTransactions.filter((_, i) => i !== index)
		setExtractedTransactions(updated)
		const newSelected = new Set(selectedIndices)
		newSelected.delete(index)
		setSelectedIndices(newSelected)
	}

	const handleSelect = (index: number, selected: boolean) => {
		const newSelected = new Set(selectedIndices)
		if (selected) {
			newSelected.add(index)
		} else {
			newSelected.delete(index)
		}
		setSelectedIndices(newSelected)
	}

	const handleCreateCategoryRequest = () => {
		setShowQuickCategory(true)
	}

	const handleCategoryCreated = async (tempCategory: Category) => {
		try {
			await createCategoryMutation.mutateAsync({
				name: tempCategory.name,
				icon: tempCategory.icon,
				color: tempCategory.color,
			})

			toast.success(t('categoryCreated', { name: tempCategory.name }))

			setShowQuickCategory(false)
		} catch (_error) {
			toast.error(t('failedToCreateCategory'))
		}
	}

	const handleSaveTransactions = async () => {
		setStep('saving')
		const selectedTransactions = extractedTransactions.filter((_, i) => selectedIndices.has(i))

		let saved = 0
		let failed = 0

		for (let index = 0; index < selectedTransactions.length; index++) {
			const txn = selectedTransactions[index]
			const resolvedAccountId = txn.account_id || accountId
			if (!resolvedAccountId) {
				failed++
				console.error('[AIExtractionModal] Missing account_id for extracted transaction', {
					index,
					transaction: txn,
				})
				continue
			}
			try {
				await createTransaction.mutateAsync({
					name: txn.name,
					description: txn.description || '',
					amount: txn.amount,
					type: txn.type_transation as TypeTransaction,
					accountId: resolvedAccountId,
					categoryId: txn.category_id || '',
					budgetId: txn.budget_id,
					currency: txn.currency || 'DOP',
					// A date without a time (calendar day) is saved on that day.
					createdAt: txn.created_at ? extractedDateToInstant(txn.created_at) : undefined,
				})
				saved++
			} catch (error) {
				failed++
				const err = error as Error & {
					status?: number
					code?: string
					details?: unknown
					requestId?: string
				}
				console.error('[AIExtractionModal] Failed to save extracted transaction', {
					index,
					requestId: err?.requestId,
					status: err?.status,
					code: err?.code,
					message: err?.message,
					details: err?.details,
					transaction: {
						name: txn.name,
						type_transation: txn.type_transation,
						amount: txn.amount,
						currency: txn.currency,
						account_id: txn.account_id,
						category_id: txn.category_id,
						budget_id: txn.budget_id,
						created_at: txn.created_at,
					},
				})
			}
		}

		if (saved > 0) {
			toast.success(t('savedCount', { count: saved }))
		}
		if (failed > 0) {
			toast.error(t('failedToSave', { count: failed }))
		}

		handleClose()
	}

	const handleClose = () => {
		setFiles([])
		setExtractedTransactions([])
		setSelectedIndices(new Set())
		setStep('upload')
		setShowQuickCategory(false)
		setPotentialDuplicatesByTransactionId({})
		setCategorySuggestionsByTransactionId({})
		setPendingCategorySelection(null)
		reset()
		onOpenChange(false)
	}

	const handleBack = () => {
		setStep('upload')
		setExtractedTransactions([])
		setSelectedIndices(new Set())
		setPotentialDuplicatesByTransactionId({})
		setCategorySuggestionsByTransactionId({})
	}

	const handleApplyCategorySuggestion = (transactionId: string) => {
		const suggestion = categorySuggestionsByTransactionId[transactionId]
		if (!suggestion) {
			return
		}

		setExtractedTransactions((prev) =>
			prev.map((transaction) =>
				transaction.id === transactionId
					? {
							...transaction,
							category_id: suggestion.category_id,
						}
					: transaction,
			),
		)

		toast.success(t('appliedCategorySuggestion', { name: suggestion.category_name }))
	}

	const handleCreateCategoryFromSuggestion = async (transactionId: string, categoryName: string) => {
		const normalizedName = ensureUniqueCategoryName(
			categoryName,
			categories.map((category) => category.name),
		)
		if (!normalizedName) {
			return
		}

		try {
			await createCategoryMutation.mutateAsync({
				name: normalizedName,
				icon: '📦',
				color: DEFAULT_CATEGORY_COLOR,
			})

			const refreshed = await refetchCategories()
			const createdCategory = (refreshed.data || []).find(
				(category) => category.name.toLowerCase() === normalizedName.toLowerCase(),
			)

			if (createdCategory) {
				setExtractedTransactions((prev) =>
					prev.map((transaction) =>
						transaction.id === transactionId
							? {
									...transaction,
									category_id: createdCategory.id,
								}
							: transaction,
					),
				)
			}

			toast.success(t('categoryCreated', { name: normalizedName }))
		} catch {
			toast.error(t('failedToCreateCategory'))
		}
	}

	const missingCategoryCount = extractedTransactions.filter(
		(txn, i) => selectedIndices.has(i) && !txn.category_id,
	).length

	const footer =
		step === 'preview' ? (
			<>
				<Button type='button' variant='outline' className='sm:mr-auto' onClick={handleBack}>
					{tCommon('back')}
				</Button>
				<Button
					type='button'
					onClick={handleSaveTransactions}
					disabled={selectedIndices.size === 0 || missingCategoryCount > 0}
				>
					{t('saveTransactions', { count: selectedIndices.size })}
				</Button>
			</>
		) : step === 'saving' ? (
			<Button type='button' disabled aria-busy='true'>
				<Loader2 className='mr-2 h-4 w-4 animate-spin' aria-hidden='true' />
				{t('savingTransactions')}
			</Button>
		) : undefined

	return (
		<>
			<FormDialog
				open={open}
				onOpenChange={(next) => {
					if (!next) handleClose()
				}}
				title={t('title')}
				description={t('description')}
				size='lg'
				onSubmit={step === 'upload' ? handleExtract : undefined}
				submitLabel={isExtracting ? t('extracting') : t('extractButton')}
				cancelLabel={tCommon('cancel')}
				loading={isExtracting || step === 'saving'}
				submitDisabled={files.length === 0 || !accountId}
				footer={footer}
			>
				{step === 'upload' && (
					<div className='space-y-4'>
						<div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
							<div className='space-y-2'>
								<Label htmlFor={`${fieldId}-account`}>{t('account')}</Label>
								<Select value={accountId} onValueChange={setAccountId}>
									<SelectTrigger id={`${fieldId}-account`}>
										<SelectValue placeholder={t('selectAccount')} />
									</SelectTrigger>
									<SelectContent>
										{accounts.map((account) => (
											<SelectItem key={account.id} value={account.id}>
												{account.name} ({account.bank})
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className='space-y-2'>
								<Label htmlFor={`${fieldId}-type`}>{t('documentType')}</Label>
								<Select value={documentType} onValueChange={(v) => setDocumentType(v as DocumentType)}>
									<SelectTrigger id={`${fieldId}-type`}>
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value='receipt'>{t('receipt')}</SelectItem>
										<SelectItem value='invoice'>{t('invoice')}</SelectItem>
										<SelectItem value='statement'>{t('bankStatement')}</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						<DocumentUploader onFilesSelected={handleFilesSelected} disabled={isExtracting} />
					</div>
				)}

				{step === 'preview' && (
					<div className='space-y-4'>
						{extractData && 'data' in extractData && (
							<div className='flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-muted p-3 text-sm text-muted-foreground'>
								<span className='flex items-center gap-1'>
									<CheckCircle className='h-4 w-4 text-success' aria-hidden='true' />
									{t('transactionsFound', { count: extractData.data.count })}
								</span>
								{extractData.data.unmatched_categories > 0 && (
									<span className='flex items-center gap-1'>
										<AlertCircle className='h-4 w-4 text-warning' aria-hidden='true' />
										{t('needCategory', { count: extractData.data.unmatched_categories })}
									</span>
								)}
								<span className='ml-auto tabular-nums'>{extractData.processing_time_ms}ms</span>
							</div>
						)}

						<TransactionPreview
							transactions={extractedTransactions}
							categories={categories}
							potentialDuplicatesByTransactionId={potentialDuplicatesByTransactionId}
							categorySuggestionsByTransactionId={categorySuggestionsByTransactionId}
							onEdit={handleEdit}
							onRemove={handleRemove}
							onSelect={handleSelect}
							onApplyCategorySuggestion={handleApplyCategorySuggestion}
							onCreateCategoryFromSuggestion={handleCreateCategoryFromSuggestion}
							selectedIndices={selectedIndices}
							onCreateCategory={handleCreateCategoryRequest}
						/>

						{selectedIndices.size > 0 && missingCategoryCount > 0 && (
							<p role='status' className='flex items-center gap-1 text-sm text-warning'>
								<AlertTriangle className='h-4 w-4 shrink-0' aria-hidden='true' />
								{t('needCategory', { count: missingCategoryCount })}
							</p>
						)}
					</div>
				)}

				{step === 'saving' && (
					<div className='flex flex-col items-center justify-center py-12' role='status'>
						<Loader2 className='mb-4 h-10 w-10 animate-spin text-muted-foreground' aria-hidden='true' />
						<p className='text-sm text-muted-foreground'>{t('savingTransactions')}</p>
					</div>
				)}
			</FormDialog>

			<QuickCategoryCreate
				open={showQuickCategory}
				onOpenChange={setShowQuickCategory}
				onCategoryCreated={handleCategoryCreated}
				isCreating={createCategoryMutation.isPending}
			/>
		</>
	)
}
