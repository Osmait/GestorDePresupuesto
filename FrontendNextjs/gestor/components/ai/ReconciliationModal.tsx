'use client'

import { AlertTriangle, CheckCircle2, CircleHelp, Link2, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { aiRepository } from '@/app/repository/aiRepository'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { useReconciliationApplyMutation, useReconciliationPreviewMutation } from '@/hooks/queries/useAIQuery'
import { useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import { DocumentType } from '@/types/ai'
import { DocumentUploader } from './DocumentUploader'

type ReconcileAction = 'create' | 'link' | 'ignore'

interface ReconciliationModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

export function ReconciliationModal({ open, onOpenChange }: ReconciliationModalProps) {
	const t = useTranslations('ai.reconciliation')
	const tCommon = useTranslations('ai.common')
	const { data: accounts = [] } = useGetAccounts()
	const { data: categories = [] } = useGetCategories()
	const reconcilePreview = useReconciliationPreviewMutation()
	const reconcileApply = useReconciliationApplyMutation()

	const [files, setFiles] = useState<File[]>([])
	const [accountId, setAccountId] = useState('')
	const [documentType, setDocumentType] = useState<DocumentType>('statement')
	const [actionByTransactionId, setActionByTransactionId] = useState<Record<string, ReconcileAction>>({})
	const [categoryByTransactionId, setCategoryByTransactionId] = useState<Record<string, string>>({})
	const [failedByTransactionId, setFailedByTransactionId] = useState<Record<string, { code: string; message: string }>>(
		{},
	)
	const [sessionId, setSessionId] = useState('')

	const result =
		reconcilePreview.data && 'success' in reconcilePreview.data && reconcilePreview.data.success
			? reconcilePreview.data
			: null

	const allActionableItems = useMemo(() => {
		if (!result) {
			return []
		}
		return [...result.data.similar_matches, ...result.data.unmatched]
	}, [result])

	const handlePreview = async () => {
		if (files.length === 0 || !accountId) {
			toast.error(t('selectFilesAndAccount'))
			return
		}

		const account = accounts.find((item) => item.id === accountId)
		const preparedFiles = await aiRepository.prepareFiles(files)
		const previewResult = await reconcilePreview.mutateAsync({
			account_id: accountId,
			account_currency: account?.currency || 'DOP',
			document_type: documentType,
			files: preparedFiles,
		})

		const nextAction: Record<string, ReconcileAction> = {}
		const nextCategory: Record<string, string> = {}
		const response = previewResult && 'success' in previewResult && previewResult.success ? previewResult : null
		if (response) {
			setSessionId(response.data.session_id)
			response.data.unmatched.forEach((item) => {
				nextAction[item.extracted.id] = 'create'
				nextCategory[item.extracted.id] = item.extracted.category_id || ''
			})
			response.data.similar_matches.forEach((item) => {
				nextAction[item.extracted.id] = item.candidates.length > 0 ? 'link' : 'create'
				nextCategory[item.extracted.id] = item.extracted.category_id || ''
			})
		}
		setActionByTransactionId(nextAction)
		setCategoryByTransactionId(nextCategory)
		setFailedByTransactionId({})
	}

	const setAction = (id: string, action: ReconcileAction) => {
		setActionByTransactionId((prev) => ({ ...prev, [id]: action }))
		setFailedByTransactionId((prev) => {
			if (!prev[id]) {
				return prev
			}
			const next = { ...prev }
			delete next[id]
			return next
		})
	}

	const setCategory = (id: string, categoryId: string) => {
		setCategoryByTransactionId((prev) => ({ ...prev, [id]: categoryId }))
		setFailedByTransactionId((prev) => {
			if (!prev[id]) {
				return prev
			}
			const next = { ...prev }
			delete next[id]
			return next
		})
	}

	const selectedCreateCount = allActionableItems.filter(
		(item) => actionByTransactionId[item.extracted.id] === 'create',
	).length
	const selectedLinkCount = allActionableItems.filter(
		(item) => actionByTransactionId[item.extracted.id] === 'link',
	).length

	const handleApplyActions = async () => {
		if (!result || !sessionId) {
			return
		}

		const actionableCount = allActionableItems.filter(
			(item) => actionByTransactionId[item.extracted.id] !== 'ignore',
		).length
		if (actionableCount === 0) {
			toast.error(t('selectAtLeastOneAction'))
			return
		}

		const missingCategoryItem = allActionableItems.find((item) => {
			const action = actionByTransactionId[item.extracted.id] || 'ignore'
			if (action !== 'create') {
				return false
			}
			return !(categoryByTransactionId[item.extracted.id] || '').trim()
		})
		if (missingCategoryItem) {
			toast.error(t('selectCategoryForCreate'))
			return
		}

		const actions = allActionableItems.map((item) => {
			const action = actionByTransactionId[item.extracted.id] || 'ignore'
			return {
				extracted_transaction_id: item.extracted.id,
				action,
				linked_transaction_id: action === 'link' ? item.candidates[0]?.id : undefined,
				category_id: action === 'create' ? categoryByTransactionId[item.extracted.id] : undefined,
			}
		})

		const response = await reconcileApply.mutateAsync({
			sessionId,
			request: { actions },
		})

		if (!('success' in response) || !response.success) {
			toast.error(t('failedApply'))
			return
		}

		const failedItems = response.data.failed_items || []
		const nextFailedById: Record<string, { code: string; message: string }> = {}
		failedItems.forEach((item) => {
			nextFailedById[item.extracted_transaction_id] = {
				code: item.code,
				message: item.message,
			}
		})
		setFailedByTransactionId(nextFailedById)

		if (response.data.created > 0) {
			toast.success(t('savedCount', { count: response.data.created }))
		}
		if (response.data.linked > 0) {
			toast.success(t('linkedCount', { count: response.data.linked }))
		}
		if (response.data.ignored > 0) {
			toast.message(t('ignoredCount', { count: response.data.ignored }))
		}
		if (response.data.failed > 0) {
			toast.error(t('failedCount', { count: response.data.failed }))
			if (failedItems.length > 0) {
				const details = failedItems
					.slice(0, 3)
					.map((item) => `${item.extracted_transaction_id} (${item.code}): ${item.message}`)
					.join(' | ')
				toast.error(details)
			}
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='max-w-3xl max-h-[90vh] overflow-y-auto'>
				<DialogHeader>
					<DialogTitle className='flex items-center gap-2'>
						<Link2 className='h-5 w-5 text-primary' />
						{t('title')}
					</DialogTitle>
					<DialogDescription>{t('description')}</DialogDescription>
				</DialogHeader>

				<div className='space-y-4'>
					<div>
						<label className='text-sm font-medium mb-2 block'>{t('account')}</label>
						<Select value={accountId} onValueChange={setAccountId}>
							<SelectTrigger>
								<SelectValue placeholder={t('selectAccount')} />
							</SelectTrigger>
							<SelectContent>
								{accounts.map((account) => (
									<SelectItem key={account.id} value={account.id}>
										{account.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div>
						<label className='text-sm font-medium mb-2 block'>{t('documentType')}</label>
						<Select value={documentType} onValueChange={(value) => setDocumentType(value as DocumentType)}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='statement'>{t('bankStatement')}</SelectItem>
								<SelectItem value='receipt'>{t('receipt')}</SelectItem>
								<SelectItem value='invoice'>{t('invoice')}</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<DocumentUploader onFilesSelected={setFiles} disabled={reconcilePreview.isPending} />

					<div className='flex justify-end gap-2'>
						<Button variant='outline' onClick={() => onOpenChange(false)}>
							{tCommon('cancel')}
						</Button>
						<Button onClick={handlePreview} disabled={reconcilePreview.isPending}>
							{reconcilePreview.isPending ? (
								<>
									<Loader2 className='h-4 w-4 mr-2 animate-spin' />
									{t('previewing')}
								</>
							) : (
								t('preview')
							)}
						</Button>
					</div>

					{result && (
						<div className='rounded-lg border p-4 space-y-4'>
							<div className='grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm'>
								<div className='rounded bg-green-500/10 px-3 py-2 flex items-center gap-2'>
									<CheckCircle2 className='h-4 w-4 text-green-600' />
									{t('exactCount', { count: result.data.exact_matches.length })}
								</div>
								<div className='rounded bg-amber-500/10 px-3 py-2 flex items-center gap-2'>
									<AlertTriangle className='h-4 w-4 text-amber-600' />
									{t('similarCount', { count: result.data.similar_matches.length })}
								</div>
								<div className='rounded bg-slate-500/10 px-3 py-2 flex items-center gap-2'>
									<CircleHelp className='h-4 w-4 text-slate-600' />
									{t('unmatchedCount', { count: result.data.unmatched.length })}
								</div>
							</div>

							{allActionableItems.length > 0 && (
								<div className='space-y-2'>
									{allActionableItems.map((item) => (
										<div
											key={item.extracted.id}
											className={`rounded border p-3 flex items-start gap-3 ${failedByTransactionId[item.extracted.id] ? 'border-red-300 bg-red-50/70' : ''}`}
										>
											<div className='mt-0.5 min-w-28'>
												<Select
													value={actionByTransactionId[item.extracted.id] || 'ignore'}
													onValueChange={(value) => setAction(item.extracted.id, value as ReconcileAction)}
												>
													<SelectTrigger className='h-8'>
														<SelectValue />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value='create'>{t('actionCreate')}</SelectItem>
														{item.candidates.length > 0 && <SelectItem value='link'>{t('actionLink')}</SelectItem>}
														<SelectItem value='ignore'>{t('actionIgnore')}</SelectItem>
													</SelectContent>
												</Select>
											</div>
											<div className='flex-1'>
												<div className='text-sm font-medium'>{item.extracted.name}</div>
												<div className='text-xs text-muted-foreground'>
													{item.extracted.type_transation} - {item.extracted.currency || 'DOP'}{' '}
													{item.extracted.amount.toFixed(2)}
												</div>
												{item.candidates.length > 0 && (
													<div className='text-xs text-muted-foreground mt-1'>
														{t('closestMatch', { name: item.candidates[0].name })}
													</div>
												)}
												{(actionByTransactionId[item.extracted.id] || 'ignore') === 'create' && (
													<div className='mt-2 max-w-xs'>
														<label className='text-xs text-muted-foreground mb-1 block'>{t('category')}</label>
														<Select
															value={categoryByTransactionId[item.extracted.id] || ''}
															onValueChange={(value) => setCategory(item.extracted.id, value)}
														>
															<SelectTrigger className='h-8'>
																<SelectValue placeholder={t('selectCategory')} />
															</SelectTrigger>
															<SelectContent>
																{categories.map((category) => (
																	<SelectItem key={category.id} value={category.id}>
																		{category.name}
																	</SelectItem>
																))}
															</SelectContent>
														</Select>
													</div>
												)}
												{failedByTransactionId[item.extracted.id] && (
													<div className='mt-2 rounded border border-red-300 bg-red-100/70 px-2 py-1 text-xs text-red-700'>
														{failedByTransactionId[item.extracted.id].code}:{' '}
														{failedByTransactionId[item.extracted.id].message}
													</div>
												)}
											</div>
										</div>
									))}

									<div className='flex justify-between items-center'>
										<div className='text-xs text-muted-foreground'>
											{t('actionsSummary', { create: selectedCreateCount, link: selectedLinkCount })}
										</div>
										<Button onClick={handleApplyActions} disabled={reconcileApply.isPending}>
											{reconcileApply.isPending ? t('saving') : t('applyActions')}
										</Button>
									</div>
								</div>
							)}
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	)
}
