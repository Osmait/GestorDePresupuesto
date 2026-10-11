'use client'

import { AlertTriangle, CheckCircle2, CircleHelp, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useId, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { aiRepository } from '@/app/repository/aiRepository'
import { Amount } from '@/components/shared/Amount'
import { FormDialog } from '@/components/shared/FormDialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { useReconciliationApplyMutation, useReconciliationPreviewMutation } from '@/hooks/queries/useAIQuery'
import { useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import { getSignedAmount, getTransactionTypeKey } from '@/lib/transaction-utils'
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
	const tTx = useTranslations('transactions')
	const fieldId = useId()
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

	const hasActionableItems = Boolean(result) && allActionableItems.length > 0

	return (
		<FormDialog
			open={open}
			onOpenChange={onOpenChange}
			title={t('title')}
			description={t('description')}
			size='lg'
			onSubmit={handlePreview}
			submitLabel={t('preview')}
			cancelLabel={tCommon('cancel')}
			loading={reconcilePreview.isPending}
			footer={
				hasActionableItems ? (
					<>
						<Button type='button' variant='outline' className='sm:mr-auto' onClick={() => onOpenChange(false)}>
							{tCommon('cancel')}
						</Button>
						<Button
							type='submit'
							variant='outline'
							disabled={reconcilePreview.isPending}
							aria-busy={reconcilePreview.isPending || undefined}
						>
							{reconcilePreview.isPending ? <Loader2 className='mr-2 h-4 w-4 animate-spin' aria-hidden='true' /> : null}
							{t('preview')}
						</Button>
						<Button
							type='button'
							onClick={handleApplyActions}
							disabled={reconcileApply.isPending}
							aria-busy={reconcileApply.isPending || undefined}
						>
							{reconcileApply.isPending ? <Loader2 className='mr-2 h-4 w-4 animate-spin' aria-hidden='true' /> : null}
							{t('applyActions')}
						</Button>
					</>
				) : undefined
			}
		>
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
										{account.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className='space-y-2'>
						<Label htmlFor={`${fieldId}-type`}>{t('documentType')}</Label>
						<Select value={documentType} onValueChange={(value) => setDocumentType(value as DocumentType)}>
							<SelectTrigger id={`${fieldId}-type`}>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='statement'>{t('bankStatement')}</SelectItem>
								<SelectItem value='receipt'>{t('receipt')}</SelectItem>
								<SelectItem value='invoice'>{t('invoice')}</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				<DocumentUploader onFilesSelected={setFiles} disabled={reconcilePreview.isPending} />

				{result && (
					<section aria-label={t('resultsLabel')} className='space-y-4 rounded-lg border p-3 sm:p-4'>
						<ul className='grid grid-cols-1 gap-2 text-sm sm:grid-cols-3'>
							<li className='flex items-center gap-2 rounded-md bg-success/10 px-3 py-2'>
								<CheckCircle2 className='h-4 w-4 shrink-0 text-success' aria-hidden='true' />
								{t('exactCount', { count: result.data.exact_matches.length })}
							</li>
							<li className='flex items-center gap-2 rounded-md bg-warning/10 px-3 py-2'>
								<AlertTriangle className='h-4 w-4 shrink-0 text-warning' aria-hidden='true' />
								{t('similarCount', { count: result.data.similar_matches.length })}
							</li>
							<li className='flex items-center gap-2 rounded-md bg-muted px-3 py-2'>
								<CircleHelp className='h-4 w-4 shrink-0 text-muted-foreground' aria-hidden='true' />
								{t('unmatchedCount', { count: result.data.unmatched.length })}
							</li>
						</ul>

						{allActionableItems.length > 0 && (
							<div className='space-y-2'>
								<ul className='space-y-2'>
									{allActionableItems.map((item) => {
										const rowId = `${fieldId}-${item.extracted.id}`
										const action = actionByTransactionId[item.extracted.id] || 'ignore'
										const failure = failedByTransactionId[item.extracted.id]
										return (
											<li
												key={item.extracted.id}
												className={`flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-start ${failure ? 'border-destructive/50 bg-destructive/5' : ''}`}
											>
												<div className='min-w-0 flex-1 sm:order-2'>
													<p id={`${rowId}-name`} className='text-sm font-medium'>
														{item.extracted.name}
													</p>
													<p className='flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground'>
														<span>{tTx(getTransactionTypeKey(item.extracted.type_transation))}</span>
														<Amount
															value={getSignedAmount(item.extracted)}
															currency={item.extracted.currency || 'DOP'}
															signed
														/>
													</p>
													{item.candidates.length > 0 && (
														<p className='mt-1 text-xs text-muted-foreground'>
															{t('closestMatch', { name: item.candidates[0].name })}
														</p>
													)}
													{action === 'create' && (
														<div className='mt-2 max-w-xs space-y-1'>
															<Label htmlFor={`${rowId}-category`} className='text-xs text-muted-foreground'>
																{t('category')}
															</Label>
															<Select
																value={categoryByTransactionId[item.extracted.id] || ''}
																onValueChange={(value) => setCategory(item.extracted.id, value)}
															>
																<SelectTrigger id={`${rowId}-category`} className='h-9'>
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
													{failure && (
														<p role='alert' className='mt-2 text-xs text-destructive'>
															{failure.code}: {failure.message}
														</p>
													)}
												</div>
												<div className='sm:order-1 sm:w-32 sm:shrink-0'>
													<Select
														value={action}
														onValueChange={(value) => setAction(item.extracted.id, value as ReconcileAction)}
													>
														<SelectTrigger className='h-9' aria-label={t('actionFor', { name: item.extracted.name })}>
															<SelectValue />
														</SelectTrigger>
														<SelectContent>
															<SelectItem value='create'>{t('actionCreate')}</SelectItem>
															{item.candidates.length > 0 && <SelectItem value='link'>{t('actionLink')}</SelectItem>}
															<SelectItem value='ignore'>{t('actionIgnore')}</SelectItem>
														</SelectContent>
													</Select>
												</div>
											</li>
										)
									})}
								</ul>

								<p className='text-xs text-muted-foreground tabular-nums'>
									{t('actionsSummary', { create: selectedCreateCount, link: selectedLinkCount })}
								</p>
							</div>
						)}
					</section>
				)}
			</div>
		</FormDialog>
	)
}
