'use client'

import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DocumentUploader } from './DocumentUploader'
import { TransactionPreview } from './TransactionPreview'
import { QuickCategoryCreate } from './QuickCategoryCreate'
import { useExtractFromFile } from '@/hooks/queries/useAIQuery'
import { useGetCategories, useCreateCategoryMutation } from '@/hooks/queries/useCategoriesQuery'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { useCreateTransactionMutation } from '@/hooks/queries/useTransactionsQuery'
import { Transaction, TypeTransaction } from '@/types/transaction'
import { Category } from '@/types/category'
import { DocumentType, AIExtractResponse, AIPotentialDuplicate } from '@/types/ai'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'

interface AIExtractionModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	defaultAccountId?: string
}

export function AIExtractionModal({ open, onOpenChange, defaultAccountId }: AIExtractionModalProps) {
	const t = useTranslations('ai.extraction')
	const tCommon = useTranslations('ai.common')
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
	const [pendingCategorySelection, setPendingCategorySelection] = useState<{
		index: number
	} | null>(null)

	const { extract, isExtracting, extractData, reset } = useExtractFromFile()
	const { data: categories = [] } = useGetCategories()
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
				{} as Record<string, AIPotentialDuplicate>
			)
			setPotentialDuplicatesByTransactionId(duplicatesMap)

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
		} catch (error) {
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
					createdAt: txn.created_at ? new Date(txn.created_at) : undefined,
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
		setPendingCategorySelection(null)
		reset()
		onOpenChange(false)
	}

	const handleBack = () => {
		setStep('upload')
		setExtractedTransactions([])
		setSelectedIndices(new Set())
		setPotentialDuplicatesByTransactionId({})
	}

	return (
		<>
			<Dialog open={open} onOpenChange={handleClose}>
				<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Sparkles className="h-5 w-5 text-primary" />
							{t('title')}
						</DialogTitle>
						<DialogDescription>
							{t('description')}
						</DialogDescription>
					</DialogHeader>

					{step === 'upload' && (
						<div className="space-y-6">
							<div className="space-y-4">
								<div>
									<label className="text-sm font-medium mb-2 block">{t('account')}</label>
									<Select value={accountId} onValueChange={setAccountId}>
										<SelectTrigger>
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

								<div>
									<label className="text-sm font-medium mb-2 block">{t('documentType')}</label>
									<Select
										value={documentType}
										onValueChange={(v) => setDocumentType(v as DocumentType)}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="receipt">{t('receipt')}</SelectItem>
											<SelectItem value="invoice">{t('invoice')}</SelectItem>
											<SelectItem value="statement">{t('bankStatement')}</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>

							<DocumentUploader
								onFilesSelected={handleFilesSelected}
								disabled={isExtracting}
							/>

							<div className="flex justify-end gap-2">
								<Button variant="outline" onClick={handleClose}>
									{tCommon('cancel')}
								</Button>
								<Button
									onClick={handleExtract}
									disabled={files.length === 0 || !accountId || isExtracting}
								>
									{isExtracting ? (
										<>
											<Loader2 className="h-4 w-4 mr-2 animate-spin" />
											{t('extracting')}
										</>
									) : (
										<>
											<Sparkles className="h-4 w-4 mr-2" />
											{t('extractButton')}
										</>
									)}
								</Button>
							</div>
						</div>
					)}

					{step === 'preview' && (
						<div className="space-y-6">
							{extractData && 'data' in extractData && (
								<div className="flex items-center gap-4 text-sm text-muted-foreground bg-muted p-3 rounded-lg">
									<div className="flex items-center gap-1">
										<CheckCircle className="h-4 w-4 text-green-500" />
										<span>{t('transactionsFound', { count: extractData.data.count })}</span>
									</div>
									<div className="flex items-center gap-1">
										{extractData.data.unmatched_categories > 0 && (
											<>
												<AlertCircle className="h-4 w-4 text-yellow-500" />
												<span>{t('needCategory', { count: extractData.data.unmatched_categories })}</span>
											</>
										)}
									</div>
									<div className="ml-auto">
										<span>{extractData.processing_time_ms}ms</span>
									</div>
								</div>
							)}

							<TransactionPreview
								transactions={extractedTransactions}
								categories={categories}
								potentialDuplicatesByTransactionId={potentialDuplicatesByTransactionId}
								onEdit={handleEdit}
								onRemove={handleRemove}
								onSelect={handleSelect}
								selectedIndices={selectedIndices}
								onCreateCategory={handleCreateCategoryRequest}
							/>

							<div className="flex justify-between">
								<Button variant="outline" onClick={handleBack}>
									{tCommon('back')}
								</Button>
								<Button
									onClick={handleSaveTransactions}
									disabled={selectedIndices.size === 0}
								>
									{t('saveTransactions', { count: selectedIndices.size })}
								</Button>
							</div>
						</div>
					)}

					{step === 'saving' && (
						<div className="flex flex-col items-center justify-center py-12">
							<Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
							<p className="text-muted-foreground">{t('savingTransactions')}</p>
						</div>
					)}
				</DialogContent>
			</Dialog>

			<QuickCategoryCreate
				open={showQuickCategory}
				onOpenChange={setShowQuickCategory}
				onCategoryCreated={handleCategoryCreated}
				isCreating={createCategoryMutation.isPending}
			/>
		</>
	)
}
