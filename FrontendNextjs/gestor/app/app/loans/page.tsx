'use client'

import { useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ACCOUNT_KEYS, useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { TRANSACTION_KEYS } from '@/hooks/queries/useTransactionsQuery'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import { getInsufficientFundsMessage } from '@/lib/api-error'
import { formatLocalDate, useAppLocale } from '@/lib/i18n/date-locale'
import { hasAtMostDecimals } from '@/lib/money-validation'
import { getLoanRepository } from '@/lib/repositoryConfig'
import { formatCurrency } from '@/lib/utils'
import {
	CreateLoanDTO,
	Loan,
	LoanDetails,
	LoanInstallmentStatus,
	LoanPayment,
	LoanStatus,
	LoanSummary,
} from '@/types/loan'

const initialCreateForm: CreateLoanDTO = {
	borrower_name: '',
	borrower_contact: '',
	principal_amount: 0,
	currency: 'DOP',
	interest_mode: 'fixed_total',
	annual_rate: 0,
	term_months: 12,
	start_date: new Date().toISOString().split('T')[0],
	source_account_id: '',
	notes: '',
}

export default function LoansPage() {
	const t = useTranslations('loans')
	const tCommon = useTranslations('common')
	const tForms = useTranslations('forms')
	const locale = useAppLocale()
	const formatMoney = (value: number, currency: string | undefined) => formatCurrency(value, currency, { locale })
	const queryClient = useQueryClient()
	const [loading, setLoading] = useState(true)
	const [loans, setLoans] = useState<Loan[]>([])
	const [summary, setSummary] = useState<LoanSummary | null>(null)
	const [createOpen, setCreateOpen] = useState(false)
	const [detailsOpen, setDetailsOpen] = useState(false)
	const [paymentOpen, setPaymentOpen] = useState(false)
	const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null)
	const [selectedLoanDetails, setSelectedLoanDetails] = useState<LoanDetails | null>(null)
	const [saving, setSaving] = useState(false)
	const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
	const [cancelling, setCancelling] = useState(false)
	const [createForm, setCreateForm] = useState<CreateLoanDTO>(initialCreateForm)
	const [paymentAmount, setPaymentAmount] = useState('')
	const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
	const [paymentDestination, setPaymentDestination] = useState('')
	const [paymentNotes, setPaymentNotes] = useState('')
	// Inline form errors (sub-cent amounts, INSUFFICIENT_FUNDS) shown inside the dialogs.
	const [createError, setCreateError] = useState<string | null>(null)
	const [paymentError, setPaymentError] = useState<string | null>(null)
	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()
	const selectedLoanIdParam = searchParams.get('selected') || ''
	const openParam = searchParams.get('open') || ''
	const lastAutoOpenKeyRef = useRef('')
	const { data: accounts = [] } = useGetAccounts()
	const { isEnabled, isLoading: isFeatureFlagsLoading } = useFeatureFlags()
	const isLoansModuleEnabled = isEnabled('module_loans')

	const accountOptions = useMemo(() => accounts.filter((account) => account.type !== 'credit_card'), [accounts])
	const selectedSourceAccount = accountOptions.find((account) => account.id === createForm.source_account_id)

	const loadData = useCallback(async () => {
		try {
			setLoading(true)
			const [loanData, summaryData] = await Promise.all([
				getLoanRepository().findAll(),
				getLoanRepository().getSummary(),
			])
			setLoans(loanData || [])
			setSummary(summaryData || null)
		} catch (error) {
			console.error('Error loading loans', error)
			toast.error(t('loadError'))
		} finally {
			setLoading(false)
		}
	}, [t])

	const openDetails = useCallback(
		async (loanId: string) => {
			try {
				const details = await getLoanRepository().findById(loanId)
				setSelectedLoanDetails(details)
				setDetailsOpen(true)
			} catch (_error) {
				toast.error(t('loadDetailsError'))
			}
		},
		[t],
	)

	useEffect(() => {
		if (isFeatureFlagsLoading || !isLoansModuleEnabled) {
			return
		}
		void loadData()
	}, [isFeatureFlagsLoading, isLoansModuleEnabled, loadData])

	useEffect(() => {
		const selectedId = selectedLoanIdParam
		const shouldOpenDetails = openParam === 'details'

		if (!shouldOpenDetails || !selectedId) {
			lastAutoOpenKeyRef.current = ''
			return
		}

		const autoOpenKey = `${selectedId}:${openParam}`
		if (lastAutoOpenKeyRef.current === autoOpenKey) {
			return
		}
		lastAutoOpenKeyRef.current = autoOpenKey

		if (!selectedId) return

		const matchedLoan = loans.find((item) => item.id === selectedId)
		if (matchedLoan) {
			const row = document.getElementById(`loan-row-${selectedId}`)
			const card = document.getElementById(`loan-card-${selectedId}`)
			const target = row?.offsetParent ? row : card
			target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
		}

		if (shouldOpenDetails) {
			void openDetails(selectedId)
		}
	}, [selectedLoanIdParam, openParam, loans, openDetails])

	const handleDetailsOpenChange = (open: boolean) => {
		setDetailsOpen(open)
		if (open) return

		const params = new URLSearchParams(searchParams.toString())
		if (params.has('open') || params.has('selected')) {
			params.delete('open')
			params.delete('selected')
			router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false })
		}
	}

	useEffect(() => {
		if (accountOptions.length > 0 && !createForm.source_account_id) {
			setCreateForm((prev) => ({ ...prev, source_account_id: accountOptions[0].id }))
		}
		if (accountOptions.length > 0 && !paymentDestination) {
			setPaymentDestination(accountOptions[0].id)
		}
	}, [accountOptions, createForm.source_account_id, paymentDestination])

	const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setCreateError(null)
		// loans.principal_amount is DECIMAL(15,2): the API rejects sub-cent amounts.
		if (!hasAtMostDecimals(createForm.principal_amount)) {
			setCreateError(tForms('maxTwoDecimals'))
			return
		}
		try {
			setSaving(true)
			await getLoanRepository().create({
				...createForm,
				principal_amount: Number(createForm.principal_amount),
				annual_rate: Number(createForm.annual_rate),
				term_months: Number(createForm.term_months),
			})
			toast.success(t('created'))
			setCreateOpen(false)
			setCreateForm(initialCreateForm)
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: TRANSACTION_KEYS.lists() }),
				queryClient.invalidateQueries({ queryKey: TRANSACTION_KEYS.simple() }),
				queryClient.invalidateQueries({ queryKey: ACCOUNT_KEYS.lists() }),
			])
			await loadData()
		} catch (error: any) {
			// The disbursement would overdraw the source account: say so inside the dialog.
			const insufficientFunds = getInsufficientFundsMessage(error, tForms, locale)
			if (insufficientFunds) {
				setCreateError(insufficientFunds)
				return
			}
			toast.error(error?.message || t('createError'))
		} finally {
			setSaving(false)
		}
	}

	const handleRegisterPayment = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!selectedLoan) return
		const numericPaymentAmount = Number(paymentAmount)
		const pendingAmount = Number(selectedLoan.pending_amount || 0)
		const currency = selectedLoan.currency || 'DOP'
		const formatInlineMoney = (value: number) => formatMoney(value, currency)
		setPaymentError(null)

		if (Number.isNaN(numericPaymentAmount) || numericPaymentAmount <= 0) {
			toast.error(t('invalidPaymentAmount'), {
				description: t('invalidPaymentAmountDetailed'),
				duration: 4000,
			})
			return
		}

		// loan_payments.amount is DECIMAL(15,2): the API rejects sub-cent amounts.
		if (!hasAtMostDecimals(numericPaymentAmount)) {
			setPaymentError(tForms('maxTwoDecimals'))
			return
		}

		if (numericPaymentAmount > pendingAmount) {
			toast.error(t('paymentValidationTitle'), {
				description: t('paymentExceedsPendingDetailed', {
					entered: formatInlineMoney(numericPaymentAmount),
					pending: formatInlineMoney(pendingAmount),
				}),
				duration: 5000,
			})
			return
		}

		try {
			setSaving(true)
			const payment: LoanPayment = await getLoanRepository().registerPayment(selectedLoan.id, {
				destination_account_id: paymentDestination,
				amount: numericPaymentAmount,
				payment_date: paymentDate,
				notes: paymentNotes,
			})
			toast.success(t('paymentRegistered'))
			setPaymentOpen(false)
			setPaymentAmount('')
			setPaymentNotes('')
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: TRANSACTION_KEYS.lists() }),
				queryClient.invalidateQueries({ queryKey: TRANSACTION_KEYS.simple() }),
				queryClient.invalidateQueries({ queryKey: ACCOUNT_KEYS.lists() }),
			])
			await loadData()
			if (selectedLoanDetails) {
				const refreshed = await getLoanRepository().findById(selectedLoan.id)
				setSelectedLoanDetails({
					...refreshed,
					payments: [payment, ...refreshed.payments],
				})
			}
		} catch (error: any) {
			toast.error(error?.message || t('paymentError'))
		} finally {
			setSaving(false)
		}
	}

	const handleCancelLoan = async () => {
		if (!selectedLoan) return
		setCancelling(true)
		try {
			await getLoanRepository().cancelLoan(selectedLoan.id)
			toast.success(t('loanCancelled'))
			setCancelDialogOpen(false)
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: TRANSACTION_KEYS.lists() }),
				queryClient.invalidateQueries({ queryKey: TRANSACTION_KEYS.simple() }),
				queryClient.invalidateQueries({ queryKey: ACCOUNT_KEYS.lists() }),
			])
			await loadData()
		} catch (error: any) {
			toast.error(error?.message || t('cancelLoanError'))
		} finally {
			setCancelling(false)
		}
	}

	const loanStatusLabel = (status: LoanStatus) => t(`statuses.${status}`)
	const installmentStatusLabel = (status: LoanInstallmentStatus) => t(`installmentStatuses.${status}`)

	const getStatusVariant = (status: Loan['status']) => {
		if (status === 'paid') return 'default'
		if (status === 'active') return 'secondary'
		if (status === 'defaulted') return 'destructive'
		return 'outline'
	}

	const renderLoanActions = (loan: Loan) => (
		<>
			<Button variant='outline' size='sm' onClick={() => openDetails(loan.id)}>
				{t('details')}
			</Button>
			<Button
				size='sm'
				disabled={loan.status !== 'active'}
				onClick={() => {
					setSelectedLoan(loan)
					setPaymentOpen(true)
				}}
			>
				{t('registerPayment')}
			</Button>
			<Button
				variant='destructive'
				size='sm'
				disabled={loan.status !== 'active'}
				aria-label={t('cancelLoanFor', { name: loan.borrower_name })}
				onClick={() => {
					setSelectedLoan(loan)
					setCancelDialogOpen(true)
				}}
			>
				{t('cancelLoan')}
			</Button>
		</>
	)

	if (isFeatureFlagsLoading) {
		return <div className='container mx-auto px-4 py-8'>{t('loading')}</div>
	}

	if (!isLoansModuleEnabled) {
		return (
			<div className='container mx-auto space-y-4 px-4 py-8'>
				<h1 className='text-2xl font-semibold'>{t('title')}</h1>
				<p className='text-muted-foreground'>{tCommon('moduleDisabled.message')}</p>
				<Button variant='outline' onClick={() => router.push('/app')}>
					{tCommon('moduleDisabled.goToDashboard')}
				</Button>
			</div>
		)
	}

	if (loading) {
		return <div className='container mx-auto px-4 py-8'>{t('loading')}</div>
	}

	return (
		<div className='container mx-auto space-y-6 px-4 py-8'>
			<div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
				<div>
					<h1 className='text-3xl font-bold'>{t('title')}</h1>
					<p className='text-muted-foreground'>{t('subtitle')}</p>
				</div>
				<Button className='w-full sm:w-auto' onClick={() => setCreateOpen(true)}>
					<Plus className='mr-2 h-4 w-4' />
					{t('newLoan')}
				</Button>
			</div>

			<div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5'>
				<Card>
					<CardHeader className='pb-2'>
						<CardTitle className='text-sm text-muted-foreground'>{t('totalPrincipal')}</CardTitle>
					</CardHeader>
					<CardContent className='text-xl font-semibold'>
						{formatMoney(summary?.total_principal || 0, 'DOP')}
					</CardContent>
				</Card>
				<Card>
					<CardHeader className='pb-2'>
						<CardTitle className='text-sm text-muted-foreground'>{t('totalPending')}</CardTitle>
					</CardHeader>
					<CardContent className='text-xl font-semibold'>{formatMoney(summary?.total_pending || 0, 'DOP')}</CardContent>
				</Card>
				<Card>
					<CardHeader className='pb-2'>
						<CardTitle className='text-sm text-muted-foreground'>{t('totalCollected')}</CardTitle>
					</CardHeader>
					<CardContent className='text-xl font-semibold'>
						{formatMoney(summary?.total_collected || 0, 'DOP')}
					</CardContent>
				</Card>
				<Card>
					<CardHeader className='pb-2'>
						<CardTitle className='text-sm text-muted-foreground'>{t('totalInterestEarned')}</CardTitle>
					</CardHeader>
					<CardContent className='text-xl font-semibold text-emerald-600'>
						{formatMoney(summary?.total_interest_earned || 0, 'DOP')}
					</CardContent>
				</Card>
				<Card>
					<CardHeader className='pb-2'>
						<CardTitle className='text-sm text-muted-foreground'>{t('activeLoans')}</CardTitle>
					</CardHeader>
					<CardContent className='text-xl font-semibold'>{summary?.active_loans || 0}</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>{t('loanPortfolio')}</CardTitle>
				</CardHeader>
				<CardContent>
					{loans.length === 0 ? (
						<p className='text-sm text-muted-foreground'>{t('empty')}</p>
					) : (
						<>
							<ul className='space-y-3 md:hidden' aria-label={t('loanPortfolio')}>
								{loans.map((loan) => (
									<li
										id={`loan-card-${loan.id}`}
										key={loan.id}
										className={`rounded-lg border p-4 ${selectedLoanIdParam === loan.id ? 'bg-primary/5 ring-1 ring-primary/40' : ''}`}
									>
										<div className='flex items-start justify-between gap-3'>
											<div className='min-w-0'>
												<div className='truncate font-medium'>{loan.borrower_name}</div>
												<div className='truncate text-xs text-muted-foreground'>{loan.borrower_contact || '-'}</div>
											</div>
											<Badge variant={getStatusVariant(loan.status)}>{loanStatusLabel(loan.status)}</Badge>
										</div>
										<dl className='mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm'>
											<div>
												<dt className='text-xs text-muted-foreground'>{t('principal')}</dt>
												<dd className='font-medium'>{formatMoney(loan.principal_amount, loan.currency)}</dd>
											</div>
											<div>
												<dt className='text-xs text-muted-foreground'>{t('pending')}</dt>
												<dd className='font-medium'>{formatMoney(loan.pending_amount, loan.currency)}</dd>
											</div>
											<div className='col-span-2'>
												<dt className='text-xs text-muted-foreground'>{t('interestEarned')}</dt>
												<dd>
													<span className='font-medium text-emerald-600'>
														{formatMoney(loan.paid_interest, loan.currency)}
													</span>{' '}
													<span className='text-xs text-muted-foreground'>
														{t('ofTotalInterest', { total: formatMoney(loan.total_interest, loan.currency) })}
													</span>
												</dd>
											</div>
										</dl>
										<div className='mt-3 grid grid-cols-1 gap-2'>{renderLoanActions(loan)}</div>
									</li>
								))}
							</ul>
							<Table className='hidden md:table'>
								<TableHeader>
									<TableRow>
										<TableHead>{t('borrower')}</TableHead>
										<TableHead>{t('principal')}</TableHead>
										<TableHead>{t('interestEarned')}</TableHead>
										<TableHead>{t('pending')}</TableHead>
										<TableHead>{t('status')}</TableHead>
										<TableHead>{t('actions')}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{loans.map((loan) => (
										<TableRow
											id={`loan-row-${loan.id}`}
											key={loan.id}
											className={selectedLoanIdParam === loan.id ? 'bg-primary/5 ring-1 ring-primary/40' : ''}
										>
											<TableCell>
												<div className='font-medium'>{loan.borrower_name}</div>
												<div className='text-xs text-muted-foreground'>{loan.borrower_contact || '-'}</div>
											</TableCell>
											<TableCell>{formatMoney(loan.principal_amount, loan.currency)}</TableCell>
											<TableCell>
												<div className='font-medium text-emerald-600'>
													{formatMoney(loan.paid_interest, loan.currency)}
												</div>
												<div className='text-xs text-muted-foreground'>
													{t('ofTotalInterest', { total: formatMoney(loan.total_interest, loan.currency) })}
												</div>
											</TableCell>
											<TableCell>{formatMoney(loan.pending_amount, loan.currency)}</TableCell>
											<TableCell>
												<Badge variant={getStatusVariant(loan.status)}>{loanStatusLabel(loan.status)}</Badge>
											</TableCell>
											<TableCell>
												<div className='flex flex-wrap gap-2'>{renderLoanActions(loan)}</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</>
					)}
				</CardContent>
			</Card>

			<Dialog
				open={createOpen}
				onOpenChange={(open) => {
					setCreateOpen(open)
					if (!open) setCreateError(null)
				}}
			>
				<DialogContent className='max-h-[90vh] overflow-y-auto'>
					<DialogHeader>
						<DialogTitle>{t('newLoan')}</DialogTitle>
						<DialogDescription>{t('newLoanDescription')}</DialogDescription>
					</DialogHeader>
					<form className='space-y-3' onSubmit={handleCreate}>
						<div className='space-y-2'>
							<Label>{t('borrower')}</Label>
							<Input
								value={createForm.borrower_name}
								onChange={(event) => setCreateForm((prev) => ({ ...prev, borrower_name: event.target.value }))}
								required
							/>
						</div>
						<div className='space-y-2'>
							<Label>{t('contact')}</Label>
							<Input
								value={createForm.borrower_contact}
								onChange={(event) => setCreateForm((prev) => ({ ...prev, borrower_contact: event.target.value }))}
							/>
						</div>
						<div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
							<div className='space-y-2'>
								<Label>{t('principal')}</Label>
								<Input
									type='number'
									min={0}
									step='0.01'
									value={createForm.principal_amount}
									onChange={(event) =>
										setCreateForm((prev) => ({ ...prev, principal_amount: Number(event.target.value) }))
									}
									required
								/>
							</div>
							<div className='space-y-2'>
								<Label>{t('annualRate')}</Label>
								<Input
									type='number'
									min={0}
									step='0.01'
									value={createForm.annual_rate}
									onChange={(event) => setCreateForm((prev) => ({ ...prev, annual_rate: Number(event.target.value) }))}
									required={createForm.interest_mode === 'fixed_total'}
								/>
							</div>
						</div>
						<div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
							<div className='space-y-2'>
								<Label>{t('termMonths')}</Label>
								<Input
									type='number'
									min={1}
									max={120}
									value={createForm.term_months}
									onChange={(event) => setCreateForm((prev) => ({ ...prev, term_months: Number(event.target.value) }))}
									required
								/>
							</div>
							<div className='space-y-2'>
								<Label>{t('startDate')}</Label>
								<Input
									type='date'
									value={createForm.start_date}
									onChange={(event) => setCreateForm((prev) => ({ ...prev, start_date: event.target.value }))}
									required
								/>
							</div>
						</div>
						<div className='space-y-2'>
							<Label>{t('sourceAccount')}</Label>
							<select
								className='w-full rounded-md border bg-background px-3 py-2 text-sm'
								value={createForm.source_account_id}
								onChange={(event) => setCreateForm((prev) => ({ ...prev, source_account_id: event.target.value }))}
							>
								{accountOptions.map((account) => (
									<option key={account.id} value={account.id}>
										{account.name}
									</option>
								))}
							</select>
							{selectedSourceAccount?.current_balance !== undefined && (
								<p className='text-xs text-muted-foreground'>
									{tForms('availableBalance', {
										amount: formatMoney(selectedSourceAccount.current_balance, selectedSourceAccount.currency),
									})}
								</p>
							)}
						</div>
						<div className='space-y-2'>
							<Label>{t('notes')}</Label>
							<Input
								value={createForm.notes}
								onChange={(event) => setCreateForm((prev) => ({ ...prev, notes: event.target.value }))}
							/>
						</div>
						{createError && (
							<p role='alert' className='text-sm text-destructive'>
								{createError}
							</p>
						)}
						<DialogFooter>
							<Button type='button' variant='outline' onClick={() => setCreateOpen(false)}>
								{t('cancel')}
							</Button>
							<Button type='submit' disabled={saving}>
								{saving ? t('saving') : t('create')}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<Dialog
				open={paymentOpen}
				onOpenChange={(open) => {
					setPaymentOpen(open)
					if (!open) setPaymentError(null)
				}}
			>
				<DialogContent className='max-h-[90vh] overflow-y-auto'>
					<DialogHeader>
						<DialogTitle>{t('registerPayment')}</DialogTitle>
						<DialogDescription>{selectedLoan?.borrower_name}</DialogDescription>
					</DialogHeader>
					<form className='space-y-3' onSubmit={handleRegisterPayment}>
						<div className='space-y-2'>
							<Label>{t('destinationAccount')}</Label>
							<select
								className='w-full rounded-md border bg-background px-3 py-2 text-sm'
								value={paymentDestination}
								onChange={(event) => setPaymentDestination(event.target.value)}
							>
								{accountOptions.map((account) => (
									<option key={account.id} value={account.id}>
										{account.name}
									</option>
								))}
							</select>
						</div>
						<div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
							<div className='space-y-2'>
								<Label>{t('amount')}</Label>
								<Input
									type='number'
									min={0.01}
									step='0.01'
									value={paymentAmount}
									onChange={(event) => setPaymentAmount(event.target.value)}
									required
								/>
								<p className='text-xs text-muted-foreground'>
									{t('pendingAmountLabel', {
										amount: formatMoney(selectedLoan?.pending_amount || 0, selectedLoan?.currency || 'DOP'),
									})}
								</p>
							</div>
							<div className='space-y-2'>
								<Label>{t('paymentDate')}</Label>
								<Input
									type='date'
									value={paymentDate}
									onChange={(event) => setPaymentDate(event.target.value)}
									required
								/>
							</div>
						</div>
						<div className='space-y-2'>
							<Label>{t('notes')}</Label>
							<Input value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} />
						</div>
						{paymentError && (
							<p role='alert' className='text-sm text-destructive'>
								{paymentError}
							</p>
						)}
						<DialogFooter>
							<Button type='button' variant='outline' onClick={() => setPaymentOpen(false)}>
								{t('cancel')}
							</Button>
							<Button type='submit' disabled={saving}>
								{saving ? t('saving') : t('confirmPayment')}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t('cancelLoanTitle')}</DialogTitle>
						<DialogDescription>{t('cancelLoanConfirm', { name: selectedLoan?.borrower_name ?? '' })}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant='outline' onClick={() => setCancelDialogOpen(false)} disabled={cancelling}>
							{t('cancel')}
						</Button>
						<Button variant='destructive' onClick={handleCancelLoan} disabled={cancelling}>
							{cancelling ? t('cancelling') : t('confirmCancel')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={detailsOpen} onOpenChange={handleDetailsOpenChange}>
				<DialogContent className='w-[95vw] max-w-5xl max-h-[88vh] overflow-hidden p-0'>
					<DialogHeader className='border-b border-border/60 px-4 py-4 sm:px-6'>
						<DialogTitle>{t('loanDetails')}</DialogTitle>
						<DialogDescription>{selectedLoanDetails?.loan.borrower_name}</DialogDescription>
					</DialogHeader>
					{selectedLoanDetails && (
						<div className='space-y-5 overflow-y-auto px-4 py-4 sm:px-6 max-h-[calc(88vh-90px)]'>
							<div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
								<Card>
									<CardHeader className='pb-1'>
										<CardTitle className='text-xs text-muted-foreground'>{t('principal')}</CardTitle>
									</CardHeader>
									<CardContent>
										{formatMoney(selectedLoanDetails.loan.principal_amount, selectedLoanDetails.loan.currency)}
									</CardContent>
								</Card>
								<Card>
									<CardHeader className='pb-1'>
										<CardTitle className='text-xs text-muted-foreground'>{t('interest')}</CardTitle>
									</CardHeader>
									<CardContent>
										{formatMoney(selectedLoanDetails.loan.total_interest, selectedLoanDetails.loan.currency)}
									</CardContent>
								</Card>
								<Card>
									<CardHeader className='pb-1'>
										<CardTitle className='text-xs text-muted-foreground'>{t('pending')}</CardTitle>
									</CardHeader>
									<CardContent>
										{formatMoney(selectedLoanDetails.loan.pending_amount, selectedLoanDetails.loan.currency)}
									</CardContent>
								</Card>
							</div>

							<h3 className='text-sm font-semibold'>{t('installments')}</h3>
							<div className='rounded-md border border-border/60 max-h-[32vh] overflow-auto'>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead aria-label={t('installmentNumber')}>#</TableHead>
											<TableHead>{t('dueDate')}</TableHead>
											<TableHead>{t('amount')}</TableHead>
											<TableHead>{t('paid')}</TableHead>
											<TableHead>{t('status')}</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{selectedLoanDetails.installments.map((item) => (
											<TableRow key={item.id}>
												<TableCell>{item.installment_number}</TableCell>
												<TableCell className='whitespace-nowrap'>{formatLocalDate(item.due_date, locale)}</TableCell>
												<TableCell>{formatMoney(item.expected_amount, selectedLoanDetails.loan.currency)}</TableCell>
												<TableCell>{formatMoney(item.paid_amount, selectedLoanDetails.loan.currency)}</TableCell>
												<TableCell>
													<Badge variant='outline'>{installmentStatusLabel(item.status)}</Badge>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>

							<h3 className='text-sm font-semibold'>{t('payments')}</h3>
							<div className='rounded-md border border-border/60 max-h-[24vh] overflow-auto'>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>{t('paymentDate')}</TableHead>
											<TableHead>{t('amount')}</TableHead>
											<TableHead>{t('principalComponent')}</TableHead>
											<TableHead>{t('interestComponent')}</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{selectedLoanDetails.payments.map((payment) => (
											<TableRow key={payment.id}>
												<TableCell className='whitespace-nowrap'>
													{formatLocalDate(payment.payment_date, locale)}
												</TableCell>
												<TableCell>{formatMoney(payment.amount, selectedLoanDetails.loan.currency)}</TableCell>
												<TableCell>
													{formatMoney(payment.principal_component, selectedLoanDetails.loan.currency)}
												</TableCell>
												<TableCell>
													{formatMoney(payment.interest_component, selectedLoanDetails.loan.currency)}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</div>
	)
}
