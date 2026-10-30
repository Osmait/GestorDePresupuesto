'use client'
import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarIcon, HistoryIcon } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import * as z from 'zod'
import { DEFAULT_CATEGORY_COLOR } from '@/components/shared/ColorSwatchPicker'
import { FormDialog } from '@/components/shared/FormDialog'
import { MoneyInput } from '@/components/shared/MoneyInput'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { useSuggestCategoryMutation } from '@/hooks/queries/useAIQuery'
import { useGetBudgets } from '@/hooks/queries/useBudgetsQuery'
import { useCreateCategoryMutation, useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import { onSessionExpired } from '@/lib/client-session'
import { formatLocalDate, useAppLocale } from '@/lib/i18n/date-locale'
import { moneyInputToNumber, moneyMessages, moneySchema } from '@/lib/money-input'
import { getCreditCardRepository } from '@/lib/repositoryConfig'
import { cn } from '@/lib/utils'
import { AICategorySuggestion } from '@/types/ai'
import { TypeTransaction } from '@/types/transaction'
import { useTransactionContext } from './TransactionContext'

function createTransactionSchema(t: (key: string, values?: Record<string, string | number>) => string) {
	return z.object({
		name: z.string().min(2, t('nameRequired')),
		description: z.string().optional(),
		amount: moneySchema(moneyMessages(t, { required: t('amountRequired') })).pipe(
			z.number().min(0.01, t('amountRequired')),
		),
		type_transaction: z.enum(TypeTransaction, { error: () => t('selectType') }),
		account_id: z.string().min(1, t('accountRequired')),
		category_id: z.string().min(1, t('categoryRequired')),
		budget_id: z.string().optional(),
		currency: z.string().length(3, t('select')),
		created_at: z.date(),
	})
}
type TransactionFormValues = z.infer<ReturnType<typeof createTransactionSchema>>
type TransactionFormInput = z.input<ReturnType<typeof createTransactionSchema>>

/**
 * Unsent form input is kept in sessionStorage when the session expires mid-edit
 * (the user is redirected to /login), and restored the next time the modal is
 * opened. Keyed by user and form (new transaction / edited transaction id).
 */
export function transactionDraftKey(userId: string, transactionId?: string | null): string {
	return `gestor:draft:transaction-form:${userId}:${transactionId || 'new'}`
}

export function saveTransactionDraft(key: string, values: Partial<TransactionFormInput>): boolean {
	try {
		const createdAt = values.created_at instanceof Date ? values.created_at.toISOString() : undefined
		window.sessionStorage.setItem(key, JSON.stringify({ ...values, created_at: createdAt }))
		return true
	} catch {
		return false
	}
}

export function loadTransactionDraft(key: string): Partial<TransactionFormInput> | null {
	try {
		const raw = window.sessionStorage.getItem(key)
		if (!raw) return null
		const parsed = JSON.parse(raw) as Partial<Record<keyof TransactionFormInput, unknown>>
		if (!parsed || typeof parsed !== 'object') return null
		const createdAt = typeof parsed.created_at === 'string' ? new Date(parsed.created_at) : undefined
		return {
			...(parsed as Partial<TransactionFormInput>),
			created_at: createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt : new Date(),
		}
	} catch {
		return null
	}
}

export function clearTransactionDraft(key: string) {
	try {
		window.sessionStorage.removeItem(key)
	} catch {
		// storage unavailable: nothing to clear
	}
}

type TransactionFormModalProps = {
	open: boolean
	setOpen: (_v: boolean) => void
	createTransaction: (
		_name: string,
		_description: string,
		_amount: number,
		_type_transaction: TypeTransaction,
		_account_id: string,
		_category_id: string,
		_budget_id?: string,
		_currency?: string,
		_created_at?: Date,
	) => Promise<void>
}

function ensureUniqueCategoryName(baseName: string, existingNames: string[]): string {
	const normalized = new Set(existingNames.map((name) => name.trim().toLowerCase()))
	const cleanBase = baseName.trim() || 'Nueva categoría'

	if (!normalized.has(cleanBase.toLowerCase())) {
		return cleanBase
	}

	let candidate = `${cleanBase} - IA`
	let index = 2
	while (normalized.has(candidate.toLowerCase())) {
		candidate = `${cleanBase} - IA ${index}`
		index++
	}

	return candidate
}

function isSameSuggestion(a: AICategorySuggestion | null, b: AICategorySuggestion | null) {
	if (!a || !b) {
		return false
	}

	return (
		a.category_id === b.category_id &&
		a.category_name === b.category_name &&
		a.new_category_name === b.new_category_name &&
		a.confidence === b.confidence &&
		Math.abs(a.score - b.score) < 0.0001 &&
		a.reason === b.reason
	)
}

const CURRENCIES = ['DOP', 'USD', 'EUR'] as const

/** Maps an API error to a message the user can act on (never the raw error). */
function getSubmitErrorKey(error: unknown): 'currencyMustMatchAccount' | 'cardCurrencyUnavailable' | null {
	const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
	if (message.includes('currency must match account currency')) return 'currencyMustMatchAccount'
	if (message.includes('card does not have a balance in currency')) return 'cardCurrencyUnavailable'
	return null
}

export default function TransactionFormModal({ open, setOpen, createTransaction }: TransactionFormModalProps) {
	const t = useTranslations('forms')
	const tTx = useTranslations('transactions')
	const tSession = useTranslations('auth.session')
	const locale = useAppLocale()
	const transactionSchema = useMemo(() => createTransactionSchema(t), [t])
	const { data: session } = useSession()
	const userId = session?.user?.id
	const { data: accounts = [] } = useGetAccounts()
	const { data: categories = [], refetch: refetchCategories } = useGetCategories()
	useGetBudgets() // Keep hook for cache but don't use data directly
	const { editingTransaction, updateTransaction } = useTransactionContext()
	const suggestCategoryMutation = useSuggestCategoryMutation()
	const createCategoryMutation = useCreateCategoryMutation()
	const { isEnabled, isLoading: isFeatureFlagsLoading } = useFeatureFlags()
	const suggestionRequestRef = useRef(0)
	const suggestCategoryFnRef = useRef(suggestCategoryMutation.mutateAsync)
	const lastSuggestionInputRef = useRef('')

	useEffect(() => {
		suggestCategoryFnRef.current = suggestCategoryMutation.mutateAsync
	}, [suggestCategoryMutation.mutateAsync])

	const isEditing = !!editingTransaction
	const [cardCurrencies, setCardCurrencies] = useState<string[]>([])
	const [cardCurrenciesLoaded, setCardCurrenciesLoaded] = useState(false)
	const [categorySuggestion, setCategorySuggestion] = useState<AICategorySuggestion | null>(null)
	const [draftRestored, setDraftRestored] = useState(false)
	const [submitError, setSubmitError] = useState<string | null>(null)
	const draftKey = userId ? transactionDraftKey(userId, editingTransaction?.id) : null

	const form = useForm<TransactionFormInput, unknown, TransactionFormValues>({
		resolver: zodResolver(transactionSchema),
		defaultValues: {
			name: '',
			description: '',
			amount: 0,
			type_transaction: TypeTransaction.BILL,
			account_id: '',
			category_id: '',
			budget_id: undefined,
			currency: 'DOP',
			created_at: new Date(),
		},
	})

	const selectedAccountId = form.watch('account_id')
	const typedName = form.watch('name')
	const typedDescription = form.watch('description')
	const typedAmount = moneyInputToNumber(form.watch('amount'))
	const typedType = form.watch('type_transaction')
	const selectedCategoryId = form.watch('category_id')
	const isCategorySuggestionsEnabled = isEnabled('ai_category_suggestions')
	const selectedAccount = accounts.find((acc) => acc.id === selectedAccountId)
	const selectedAccountType = selectedAccount?.type || 'bank'
	const selectedAccountCurrency = selectedAccount?.currency || 'DOP'

	useEffect(() => {
		let cancelled = false

		async function loadCardCurrencies() {
			if (!selectedAccountId || selectedAccountType !== 'credit_card') {
				setCardCurrencies([])
				setCardCurrenciesLoaded(false)
				return
			}

			setCardCurrenciesLoaded(false)
			try {
				const repo = await getCreditCardRepository()
				const card = await repo.findById(selectedAccountId)
				const currencies = (card?.balances || []).map((b) => b.currency)

				if (cancelled) return

				setCardCurrencies(currencies)
				setCardCurrenciesLoaded(true)

				if (currencies.length > 0 && !currencies.includes(form.getValues('currency'))) {
					form.setValue('currency', currencies[0])
				}
			} catch {
				if (cancelled) return
				setCardCurrencies([])
				setCardCurrenciesLoaded(false)
			}
		}

		void loadCardCurrencies()
		return () => {
			cancelled = true
		}
	}, [selectedAccountId, selectedAccountType, form])

	// Effect to populate form when editing
	useEffect(() => {
		if (editingTransaction) {
			form.reset({
				name: editingTransaction.name,
				description: editingTransaction.description,
				amount: editingTransaction.amount,
				type_transaction:
					editingTransaction.type_transation === 'income' ? TypeTransaction.INCOME : TypeTransaction.BILL,
				account_id: editingTransaction.account_id,
				category_id: editingTransaction.category_id,
				budget_id: editingTransaction.budget_id || undefined,
				currency: editingTransaction.currency || 'DOP',
				created_at: new Date(editingTransaction.created_at || new Date()),
			})
		} else {
			form.reset({
				name: '',
				description: '',
				amount: 0,
				type_transaction: TypeTransaction.BILL,
				account_id: '',
				category_id: '',
				budget_id: undefined,
				currency: 'DOP',
				created_at: new Date(),
			})
		}
	}, [editingTransaction, form])

	// Restore a draft saved when the session expired (runs after the reset above).
	useEffect(() => {
		if (!open || !draftKey) return
		const draft = loadTransactionDraft(draftKey)
		if (!draft) return
		// keepDefaultValues: the draft fills the fields but never becomes the
		// form's reset target, so the reset after a successful submit goes back
		// to a clean form instead of resurrecting the (already sent) draft.
		form.reset({ ...form.getValues(), ...draft }, { keepDefaultValues: true })
		setDraftRestored(true)
	}, [open, draftKey, form])

	// While the modal is open, keep the user's input if the session expires
	// (e.g. a submit answered 401) before they are sent to /login.
	useEffect(() => {
		if (!open || !draftKey) return
		return onSessionExpired(() => {
			const saved = saveTransactionDraft(draftKey, form.getValues())
			toast.error(tSession('expired'), {
				description: saved ? tSession('draftSaved') : undefined,
			})
			return true
		})
	}, [open, draftKey, form, tSession])

	const discardDraft = () => {
		if (draftKey) clearTransactionDraft(draftKey)
		setDraftRestored(false)
		form.reset({
			name: '',
			description: '',
			amount: 0,
			type_transaction: TypeTransaction.BILL,
			account_id: '',
			category_id: '',
			budget_id: undefined,
			currency: 'DOP',
			created_at: new Date(),
		})
	}

	useEffect(() => {
		if (isEditing) {
			lastSuggestionInputRef.current = ''
			setCategorySuggestion(null)
			return
		}

		if (!isCategorySuggestionsEnabled) {
			lastSuggestionInputRef.current = ''
			setCategorySuggestion(null)
			return
		}

		if (isFeatureFlagsLoading) {
			return
		}

		if (!typedName || typedName.trim().length < 3 || !selectedAccountId || !(typedAmount > 0) || selectedCategoryId) {
			lastSuggestionInputRef.current = ''
			setCategorySuggestion(null)
			return
		}

		const timeout = setTimeout(async () => {
			const normalizedName = typedName.trim().toLowerCase()
			const normalizedDescription = (typedDescription || '').trim().toLowerCase()
			const numericAmount = typedAmount
			if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
				lastSuggestionInputRef.current = ''
				setCategorySuggestion(null)
				return
			}

			const currentInputSignature = [
				normalizedName,
				normalizedDescription,
				numericAmount.toFixed(2),
				typedType,
				selectedAccountId,
				(form.getValues('currency') || 'DOP').toUpperCase(),
			].join('|')

			if (currentInputSignature === lastSuggestionInputRef.current) {
				return
			}
			lastSuggestionInputRef.current = currentInputSignature

			const currentRequest = suggestionRequestRef.current + 1
			suggestionRequestRef.current = currentRequest

			const suggestionType = typedType === TypeTransaction.INCOME ? 'income' : 'bill'
			try {
				const result = await suggestCategoryFnRef.current({
					name: typedName,
					description: typedDescription || '',
					amount: numericAmount,
					type_transation: suggestionType,
					account_id: selectedAccountId,
					currency: form.getValues('currency') || 'DOP',
				})

				if (currentRequest !== suggestionRequestRef.current) {
					return
				}

				if ('success' in result && result.success && result.data) {
					const nextSuggestion = result.data
					setCategorySuggestion((prev) => (isSameSuggestion(prev, nextSuggestion) ? prev : nextSuggestion))
					return
				}

				lastSuggestionInputRef.current = ''
				setCategorySuggestion(null)
			} catch {
				if (currentRequest === suggestionRequestRef.current) {
					lastSuggestionInputRef.current = ''
					setCategorySuggestion(null)
				}
			}
		}, 450)

		return () => clearTimeout(timeout)
	}, [
		typedName,
		typedDescription,
		typedAmount,
		typedType,
		selectedAccountId,
		selectedCategoryId,
		isEditing,
		isFeatureFlagsLoading,
		isCategorySuggestionsEnabled,
		form,
	])

	async function onSubmit(values: TransactionFormValues) {
		setSubmitError(null)
		try {
			if (isEditing) {
				await updateTransaction(
					editingTransaction.id,
					values.name,
					values.description,
					values.amount,
					values.type_transaction,
					values.account_id,
					values.category_id,
					values.budget_id,
					values.currency,
					values.created_at,
				)
			} else {
				await createTransaction(
					values.name,
					values.description || '',
					values.amount,
					values.type_transaction,
					values.account_id,
					values.category_id,
					values.budget_id,
					values.currency,
					values.created_at,
				)
			}
			if (draftKey) clearTransactionDraft(draftKey)
			setDraftRestored(false)
			form.reset()
			setOpen(false)
		} catch (error) {
			// Shown inline above the footer (a 401 also triggers the
			// session-expired listener above, which saves the draft).
			const key = getSubmitErrorKey(error)
			setSubmitError(key ? t(key) : tTx('saveError'))
		}
	}

	function handleOpenChange(next: boolean) {
		if (!next) setSubmitError(null)
		setOpen(next)
	}

	const applyCategorySuggestion = () => {
		if (!categorySuggestion) {
			return
		}
		form.setValue('category_id', categorySuggestion.category_id, { shouldValidate: true, shouldDirty: true })
		setCategorySuggestion(null)
	}

	const createCategoryFromSuggestion = async () => {
		if (!categorySuggestion) {
			return
		}

		const suggestedName = ensureUniqueCategoryName(
			categorySuggestion.new_category_name || categorySuggestion.category_name,
			categories.map((category) => category.name),
		)
		if (!suggestedName) {
			return
		}

		try {
			await createCategoryMutation.mutateAsync({
				name: suggestedName,
				icon: '📦',
				color: DEFAULT_CATEGORY_COLOR,
			})

			const refreshed = await refetchCategories()
			const createdCategory = (refreshed.data || []).find(
				(category) => category.name.toLowerCase() === suggestedName.toLowerCase(),
			)

			if (createdCategory) {
				form.setValue('category_id', createdCategory.id, { shouldValidate: true, shouldDirty: true })
			}

			setCategorySuggestion(null)
			toast.success(t('categoryCreated', { name: suggestedName }))
		} catch {
			toast.error(t('failedToCreateCategory'))
		}
	}

	async function handleAccountChange(accountId: string, onChange: (_value: string) => void) {
		onChange(accountId)
		const selected = accounts.find((acc) => acc.id === accountId)
		if (!selected || isEditing) {
			return
		}

		if ((selected.type || 'bank') === 'bank') {
			form.setValue('currency', selected.currency || 'DOP')
			return
		}
	}

	const availableCurrencies =
		selectedAccountType === 'credit_card' && cardCurrencies.length > 0
			? CURRENCIES.filter((code) => cardCurrencies.includes(code))
			: CURRENCIES

	return (
		<FormDialog
			open={open}
			onOpenChange={handleOpenChange}
			title={isEditing ? t('editTransaction') : t('newTransaction')}
			size='lg'
			submitLabel={isEditing ? t('saveChanges') : t('createTransaction')}
			loading={form.formState.isSubmitting}
			error={submitError}
			onSubmit={form.handleSubmit(onSubmit)}
		>
			<Form {...form}>
				<div className='space-y-4'>
					{draftRestored && (
						<Alert role='status'>
							<HistoryIcon className='h-4 w-4' aria-hidden='true' />
							<AlertDescription className='flex flex-wrap items-center justify-between gap-2'>
								<span>{tSession('draftRestored')}</span>
								<Button type='button' variant='outline' size='sm' onClick={discardDraft}>
									{tSession('discardDraft')}
								</Button>
							</AlertDescription>
						</Alert>
					)}

					<FormField
						control={form.control}
						name='name'
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('name')}</FormLabel>
								<FormControl>
									<Input {...field} placeholder={t('namePlaceholder')} autoFocus />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>

					<div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
						<FormField
							control={form.control}
							name='amount'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('amount')}</FormLabel>
									<FormControl>
										<MoneyInput {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name='currency'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('currency')}</FormLabel>
									<Select value={field.value} onValueChange={field.onChange} disabled={selectedAccountType === 'bank'}>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder='DOP' />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{availableCurrencies.map((code) => (
												<SelectItem key={code} value={code}>
													{code}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									{selectedAccountType === 'bank' && selectedAccountId ? (
										<p className='text-xs text-muted-foreground'>
											{t('bankCurrencyFixed', { currency: selectedAccountCurrency })}
										</p>
									) : null}
									{selectedAccountType === 'credit_card' &&
									selectedAccountId &&
									cardCurrenciesLoaded &&
									cardCurrencies.length === 0 ? (
										<p className='text-xs text-destructive'>{t('cardWithoutBalances')}</p>
									) : null}
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name='type_transaction'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('type')}</FormLabel>
									<Select value={field.value} onValueChange={field.onChange}>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder={t('select')} />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											<SelectItem value={TypeTransaction.INCOME}>{tTx('income')}</SelectItem>
											<SelectItem value={TypeTransaction.BILL}>{tTx('expense')}</SelectItem>
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>

					<div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
						<FormField
							control={form.control}
							name='account_id'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('account')}</FormLabel>
									<Select
										value={field.value}
										onValueChange={(value) => {
											void handleAccountChange(value, field.onChange)
										}}
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder={t('select')} />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{accounts.map((acc) => (
												<SelectItem key={acc.id} value={acc.id}>
													{acc.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name='category_id'
							render={({ field }) => (
								<FormItem>
									<FormLabel>{t('category')}</FormLabel>
									<Select value={field.value} onValueChange={field.onChange}>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder={t('select')} />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{categories.map((cat) => (
												<SelectItem key={cat.id} value={cat.id}>
													<span className='flex items-center gap-2'>
														<span aria-hidden='true'>{cat.icon}</span> {cat.name}
													</span>
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FormMessage />
									{categorySuggestion && (
										<div className='flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-2 py-1.5 text-xs'>
											<span className='min-w-0 flex-1'>
												{t('aiSuggestionLabel', {
													name: categorySuggestion.category_name,
													confidence: t(`confidence.${categorySuggestion.confidence}`),
												})}
											</span>
											<Button type='button' variant='ghost' size='sm' onClick={applyCategorySuggestion}>
												{t('apply')}
											</Button>
											<Button
												type='button'
												variant='outline'
												size='sm'
												onClick={createCategoryFromSuggestion}
												disabled={createCategoryMutation.isPending}
												title={ensureUniqueCategoryName(
													categorySuggestion.new_category_name || categorySuggestion.category_name,
													categories.map((category) => category.name),
												)}
											>
												{t('createSuggestedCategory')}
											</Button>
										</div>
									)}
								</FormItem>
							)}
						/>
					</div>

					<FormField
						control={form.control}
						name='created_at'
						render={({ field }) => (
							<FormItem className='flex flex-col'>
								<FormLabel>{t('date')}</FormLabel>
								<Popover>
									<PopoverTrigger asChild>
										<FormControl>
											<Button
												variant='outline'
												className={cn(
													'w-full pl-3 text-left font-normal sm:w-1/2',
													!field.value && 'text-muted-foreground',
												)}
											>
												{field.value ? (
													formatLocalDate(field.value, locale, { dateStyle: 'long' })
												) : (
													<span>{t('selectDate')}</span>
												)}
												<CalendarIcon className='ml-auto h-4 w-4 opacity-50' aria-hidden='true' />
											</Button>
										</FormControl>
									</PopoverTrigger>
									<PopoverContent className='w-auto p-0' align='start'>
										<Calendar
											mode='single'
											selected={field.value}
											onSelect={field.onChange}
											disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
											autoFocus
										/>
									</PopoverContent>
								</Popover>
								<FormMessage />
							</FormItem>
						)}
					/>

					<FormField
						control={form.control}
						name='description'
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('description')}</FormLabel>
								<FormControl>
									<Input {...field} placeholder={t('descriptionPlaceholder')} />
								</FormControl>
								<FormMessage />
							</FormItem>
						)}
					/>
				</div>
			</Form>
		</FormDialog>
	)
}
