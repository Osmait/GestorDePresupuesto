'use client'

import { useQueryClient } from '@tanstack/react-query'
import {
	Ban,
	Banknote,
	CircleDollarSign,
	Eye,
	HandCoins,
	Landmark,
	MoreHorizontal,
	Plus,
	TrendingUp,
	Wallet,
} from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { LoanFormDialog } from '@/components/loans/LoanFormDialog'
import { LoanPaymentDialog } from '@/components/loans/LoanPaymentDialog'
import { Amount } from '@/components/shared/Amount'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { ModuleDisabled } from '@/components/shared/ModuleDisabled'
import { PageHeader } from '@/components/shared/PageHeader'
import { PageShell } from '@/components/shared/PageShell'
import { StatCard } from '@/components/shared/StatCard'
import { StatGrid } from '@/components/shared/StatGrid'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import {
	loanDetailsQueryOptions,
	useCancelLoanMutation,
	useCreateLoanMutation,
	useGetLoanDetails,
	useGetLoanSummary,
	useGetLoans,
	useRegisterLoanPaymentMutation,
} from '@/hooks/queries/useLoansQuery'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { formatLocalDate, useAppLocale } from '@/lib/i18n/date-locale'
import {
	CreateLoanDTO,
	Loan,
	LoanInstallmentStatus,
	LoanStatus,
	LoanSummary,
	RegisterLoanPaymentDTO,
} from '@/types/loan'

// The summary totals are in DOP: the API converts USD loans at usd_to_dop_rate.
const SUMMARY_CURRENCY = 'DOP'

/** The non-DOP part of a total (e.g. "US$1,000.00"), listed under the DOP figure. */
function foreignParts(
	summary: LoanSummary | null,
	field: 'total_principal' | 'total_pending' | 'total_collected',
	format: (value: number, currency: string) => string,
): string {
	return Object.entries(summary?.by_currency ?? {})
		.filter(([currency, totals]) => currency !== SUMMARY_CURRENCY && totals[field] > 0)
		.map(([currency, totals]) => format(totals[field], currency))
		.join(' + ')
}

export default function LoansPage() {
	const t = useTranslations('loans')
	const { isEnabled, isLoading: isFeatureFlagsLoading } = useFeatureFlags()

	if (isFeatureFlagsLoading) {
		return <LoansSkeleton />
	}

	if (!isEnabled('module_loans')) {
		return <ModuleDisabled title={t('title')} />
	}

	return <LoansContent />
}

function LoansKpis({ summary, loading = false }: { summary: LoanSummary | null; loading?: boolean }) {
	const t = useTranslations('loans')
	const formatCurrency = useFormatCurrency()
	const rate = summary?.usd_to_dop_rate ? summary.usd_to_dop_rate.toFixed(2) : ''
	const converted = (field: 'total_principal' | 'total_pending' | 'total_collected') => {
		const amounts = foreignParts(summary, field, formatCurrency)
		return amounts ? t('pendingByCurrency', { amounts, rate }) : undefined
	}
	const defaulted = summary?.defaulted_pending ?? 0
	const pendingHint = [
		converted('total_pending'),
		defaulted > 0 ? t('defaultedPending', { amount: formatCurrency(defaulted, SUMMARY_CURRENCY) }) : undefined,
	]
		.filter(Boolean)
		.join(' · ')
	return (
		<StatGrid columns={4}>
			<StatCard
				label={t('totalPrincipal')}
				icon={Landmark}
				loading={loading}
				value={<Amount value={summary?.total_principal || 0} currency={SUMMARY_CURRENCY} />}
				hint={[t('activeLoansCount', { count: summary?.active_loans || 0 }), converted('total_principal')]
					.filter(Boolean)
					.join(' · ')}
			/>
			<StatCard
				label={t('totalPending')}
				icon={Wallet}
				loading={loading}
				value={<Amount value={summary?.total_pending || 0} currency={SUMMARY_CURRENCY} />}
				hint={pendingHint || undefined}
			/>
			<StatCard
				label={t('totalCollected')}
				icon={Banknote}
				loading={loading}
				value={<Amount value={summary?.total_collected || 0} currency={SUMMARY_CURRENCY} />}
				hint={converted('total_collected')}
			/>
			<StatCard
				label={t('totalInterestEarned')}
				icon={TrendingUp}
				loading={loading}
				value={<Amount value={summary?.total_interest_earned || 0} currency={SUMMARY_CURRENCY} tone='auto' />}
			/>
		</StatGrid>
	)
}

function LoansSkeleton() {
	const t = useTranslations('loans')
	return (
		<PageShell aria-busy='true'>
			<PageHeader title={t('title')} description={t('subtitle')} />
			<LoansKpis summary={null} loading />
			<Card>
				<CardHeader>
					<Skeleton className='h-6 w-40' />
				</CardHeader>
				<CardContent className='space-y-3'>
					<Skeleton className='h-10 w-full' />
					<Skeleton className='h-10 w-full' />
					<Skeleton className='h-10 w-full' />
				</CardContent>
			</Card>
		</PageShell>
	)
}

/** The page once the module is on (data only loads from here). */
function LoansContent() {
	const t = useTranslations('loans')
	const tCommon = useTranslations('common')
	const locale = useAppLocale()
	const formatCurrency = useFormatCurrency()
	const queryClient = useQueryClient()
	const [createOpen, setCreateOpen] = useState(false)
	const [detailsOpen, setDetailsOpen] = useState(false)
	const [paymentOpen, setPaymentOpen] = useState(false)
	const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null)
	const [detailsLoanId, setDetailsLoanId] = useState('')
	const [loanToCancel, setLoanToCancel] = useState<Loan | null>(null)
	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()
	const selectedLoanIdParam = searchParams.get('selected') || ''
	const openParam = searchParams.get('open') || ''
	const lastAutoOpenKeyRef = useRef('')
	const { data: accounts = [] } = useGetAccounts()

	const accountOptions = useMemo(() => accounts.filter((account) => account.type !== 'credit_card'), [accounts])

	const loansQuery = useGetLoans()
	const summaryQuery = useGetLoanSummary()
	const loans = useMemo(() => loansQuery.data ?? [], [loansQuery.data])
	const summary = summaryQuery.data ?? null
	// Details refetch with every loan write (the mutations invalidate ['loans']).
	const { data: details } = useGetLoanDetails(detailsLoanId)
	const createLoan = useCreateLoanMutation()
	const registerPayment = useRegisterLoanPaymentMutation()
	const cancelLoan = useCancelLoanMutation()

	const reloadLoans = () => {
		void loansQuery.refetch()
		void summaryQuery.refetch()
	}

	// The dialog opens once the details are in, so a failure is a toast instead of an empty dialog.
	const openDetails = useCallback(
		async (loanId: string) => {
			try {
				await queryClient.fetchQuery(loanDetailsQueryOptions(loanId))
				setDetailsLoanId(loanId)
				setDetailsOpen(true)
			} catch (_error) {
				toast.error(t('loadDetailsError'))
			}
		},
		[queryClient, t],
	)

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

	// Errors propagate to LoanFormDialog, which shows them inline and keeps the input.
	const handleCreate = async (data: CreateLoanDTO) => {
		await createLoan.mutateAsync(data)
		toast.success(t('created'))
		setCreateOpen(false)
	}

	// Errors propagate to LoanPaymentDialog, which shows them inline and keeps the input.
	const handleRegisterPayment = async (data: RegisterLoanPaymentDTO) => {
		if (!selectedLoan) return
		await registerPayment.mutateAsync({ loanId: selectedLoan.id, data })
		toast.success(t('paymentRegistered'))
		setPaymentOpen(false)
	}

	const handleCancelLoan = async () => {
		if (!loanToCancel) return
		try {
			await cancelLoan.mutateAsync(loanToCancel.id)
		} catch (error) {
			toast.error(t('cancelLoanError'))
			throw error
		}
		toast.success(t('loanCancelled'))
	}

	const loanStatusLabel = (status: LoanStatus) => t(`statuses.${status}`)
	const installmentStatusLabel = (status: LoanInstallmentStatus) => t(`installmentStatuses.${status}`)

	const getStatusVariant = (status: Loan['status']) => {
		if (status === 'paid') return 'default'
		if (status === 'active') return 'secondary'
		if (status === 'defaulted') return 'destructive'
		return 'outline'
	}

	// Row actions follow the app pattern: the primary action (register a payment) stays visible as a
	// button while the loan is active; everything else lives in the MoreHorizontal row menu.
	const renderLoanActions = (loan: Loan) => {
		const isActive = loan.status === 'active'
		return (
			<>
				{isActive ? (
					<Button
						size='sm'
						className='flex-1 md:flex-none'
						onClick={() => {
							setSelectedLoan(loan)
							setPaymentOpen(true)
						}}
					>
						{t('registerPayment')}
					</Button>
				) : null}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant='ghost'
							size='icon'
							className='shrink-0'
							aria-label={tCommon('actions.rowMenu', { name: loan.borrower_name })}
						>
							<MoreHorizontal className='h-4 w-4' aria-hidden='true' />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align='end'>
						<DropdownMenuItem onSelect={() => void openDetails(loan.id)}>
							<Eye className='mr-2 h-4 w-4' aria-hidden='true' />
							{t('details')}
						</DropdownMenuItem>
						{isActive ? (
							<>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									className='text-destructive focus:text-destructive'
									onSelect={() => setLoanToCancel(loan)}
								>
									<Ban className='mr-2 h-4 w-4' aria-hidden='true' />
									{t('cancelLoanAction')}
								</DropdownMenuItem>
							</>
						) : null}
					</DropdownMenuContent>
				</DropdownMenu>
			</>
		)
	}

	const header = (
		<PageHeader
			title={t('title')}
			description={t('subtitle')}
			actions={
				<Button onClick={() => setCreateOpen(true)}>
					<Plus className='mr-2 h-4 w-4' aria-hidden='true' />
					{t('newLoan')}
				</Button>
			}
		/>
	)

	if (loansQuery.isPending || summaryQuery.isPending) {
		return <LoansSkeleton />
	}

	if (loansQuery.isError || summaryQuery.isError) {
		return (
			<PageShell>
				{header}
				<ErrorState title={t('loadError')} onRetry={reloadLoans} />
			</PageShell>
		)
	}

	const detailsCurrency = details?.loan.currency

	return (
		<PageShell>
			{header}

			<LoansKpis summary={summary} />

			{loans.length === 0 ? (
				<EmptyState
					icon={HandCoins}
					title={t('emptyTitle')}
					description={t('emptyDescription')}
					action={
						<Button onClick={() => setCreateOpen(true)}>
							<Plus className='mr-2 h-4 w-4' aria-hidden='true' />
							{t('newLoan')}
						</Button>
					}
				/>
			) : (
				<Card>
					<CardHeader>
						<CardTitle className='text-xl'>{t('loanPortfolio')}</CardTitle>
					</CardHeader>
					<CardContent>
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
											<dd className='font-medium'>
												<Amount value={loan.principal_amount} currency={loan.currency} />
											</dd>
										</div>
										<div>
											<dt className='text-xs text-muted-foreground'>{t('pending')}</dt>
											<dd className='font-medium'>
												<Amount value={loan.pending_amount} currency={loan.currency} />
											</dd>
										</div>
										<div className='col-span-2'>
											<dt className='text-xs text-muted-foreground'>{t('interestEarned')}</dt>
											<dd className='flex flex-wrap items-baseline gap-x-1'>
												<Amount
													value={loan.paid_interest}
													currency={loan.currency}
													tone='auto'
													className='font-medium'
												/>
												<span className='text-xs text-muted-foreground tabular-nums'>
													{t('ofTotalInterest', { total: formatCurrency(loan.total_interest, loan.currency) })}
												</span>
											</dd>
										</div>
									</dl>
									<div className='mt-3 flex items-center justify-end gap-2'>{renderLoanActions(loan)}</div>
								</li>
							))}
						</ul>
						<Table className='hidden md:table'>
							<TableHeader>
								<TableRow>
									<TableHead>{t('borrower')}</TableHead>
									<TableHead className='text-right'>{t('principal')}</TableHead>
									<TableHead className='text-right'>{t('interestEarned')}</TableHead>
									<TableHead className='text-right'>{t('pending')}</TableHead>
									<TableHead>{t('status')}</TableHead>
									<TableHead className='text-right'>{t('actions')}</TableHead>
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
										<TableCell className='text-right'>
											<Amount value={loan.principal_amount} currency={loan.currency} />
										</TableCell>
										<TableCell className='text-right'>
											<Amount value={loan.paid_interest} currency={loan.currency} tone='auto' className='font-medium' />
											<div className='text-xs text-muted-foreground tabular-nums'>
												{t('ofTotalInterest', { total: formatCurrency(loan.total_interest, loan.currency) })}
											</div>
										</TableCell>
										<TableCell className='text-right'>
											<Amount value={loan.pending_amount} currency={loan.currency} />
										</TableCell>
										<TableCell>
											<Badge variant={getStatusVariant(loan.status)}>{loanStatusLabel(loan.status)}</Badge>
										</TableCell>
										<TableCell>
											<div className='flex items-center justify-end gap-2'>{renderLoanActions(loan)}</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}

			<LoanFormDialog
				open={createOpen}
				onOpenChange={setCreateOpen}
				accounts={accountOptions}
				onSubmit={handleCreate}
			/>

			<LoanPaymentDialog
				open={paymentOpen}
				onOpenChange={setPaymentOpen}
				loan={selectedLoan}
				accounts={accountOptions}
				onSubmit={handleRegisterPayment}
			/>

			<ConfirmDialog
				open={loanToCancel !== null}
				onOpenChange={(open) => !open && setLoanToCancel(null)}
				title={t('cancelLoanTitle')}
				description={t('cancelLoanConfirm', { name: loanToCancel?.borrower_name ?? '' })}
				confirmLabel={t('confirmCancel')}
				cancelLabel={t('keepLoan')}
				destructive
				onConfirm={handleCancelLoan}
			/>

			<Dialog open={detailsOpen} onOpenChange={handleDetailsOpenChange}>
				<DialogContent className='max-h-[88vh] w-[95vw] max-w-5xl overflow-hidden p-0'>
					<DialogHeader className='border-b px-4 py-4 sm:px-6'>
						<DialogTitle>{t('loanDetails')}</DialogTitle>
						<DialogDescription>{details?.loan.borrower_name}</DialogDescription>
					</DialogHeader>
					{details && (
						<div className='max-h-[calc(88vh-90px)] space-y-5 overflow-y-auto px-4 py-4 sm:px-6'>
							<StatGrid columns={3}>
								<StatCard
									label={t('principal')}
									icon={CircleDollarSign}
									value={<Amount value={details.loan.principal_amount} currency={detailsCurrency} />}
								/>
								<StatCard
									label={t('interest')}
									icon={TrendingUp}
									value={<Amount value={details.loan.total_interest} currency={detailsCurrency} />}
								/>
								<StatCard
									label={t('pending')}
									icon={Wallet}
									value={<Amount value={details.loan.pending_amount} currency={detailsCurrency} />}
								/>
							</StatGrid>

							<h3 className='text-sm font-semibold'>{t('installments')}</h3>
							<div className='max-h-[32vh] overflow-auto rounded-md border'>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead aria-label={t('installmentNumber')}>#</TableHead>
											<TableHead>{t('dueDate')}</TableHead>
											<TableHead className='text-right'>{t('amount')}</TableHead>
											<TableHead className='text-right'>{t('paid')}</TableHead>
											<TableHead>{t('status')}</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{details.installments.map((item) => (
											<TableRow key={item.id}>
												<TableCell className='tabular-nums'>{item.installment_number}</TableCell>
												<TableCell className='whitespace-nowrap'>{formatLocalDate(item.due_date, locale)}</TableCell>
												<TableCell className='text-right'>
													<Amount value={item.expected_amount} currency={detailsCurrency} />
												</TableCell>
												<TableCell className='text-right'>
													<Amount value={item.paid_amount} currency={detailsCurrency} />
												</TableCell>
												<TableCell>
													<Badge variant='outline'>{installmentStatusLabel(item.status)}</Badge>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>

							<h3 className='text-sm font-semibold'>{t('payments')}</h3>
							{details.payments.length === 0 ? (
								<EmptyState compact icon={Banknote} title={t('noPayments')} className='rounded-md border' />
							) : (
								<div className='max-h-[24vh] overflow-auto rounded-md border'>
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>{t('paymentDate')}</TableHead>
												<TableHead className='text-right'>{t('amount')}</TableHead>
												<TableHead className='text-right'>{t('principalComponent')}</TableHead>
												<TableHead className='text-right'>{t('interestComponent')}</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{details.payments.map((payment) => (
												<TableRow key={payment.id}>
													<TableCell className='whitespace-nowrap'>
														{formatLocalDate(payment.payment_date, locale)}
													</TableCell>
													<TableCell className='text-right'>
														<Amount value={payment.amount} currency={detailsCurrency} />
													</TableCell>
													<TableCell className='text-right'>
														<Amount value={payment.principal_component} currency={detailsCurrency} />
													</TableCell>
													<TableCell className='text-right'>
														<Amount value={payment.interest_component} currency={detailsCurrency} />
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								</div>
							)}
						</div>
					)}
				</DialogContent>
			</Dialog>
		</PageShell>
	)
}
