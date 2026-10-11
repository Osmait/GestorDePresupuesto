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
import { ACCOUNT_KEYS, useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { TRANSACTION_KEYS } from '@/hooks/queries/useTransactionsQuery'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { formatLocalDate, useAppLocale } from '@/lib/i18n/date-locale'
import { getLoanRepository } from '@/lib/repositoryConfig'
import {
	CreateLoanDTO,
	Loan,
	LoanDetails,
	LoanInstallmentStatus,
	LoanPayment,
	LoanStatus,
	LoanSummary,
	RegisterLoanPaymentDTO,
} from '@/types/loan'

// The summary endpoint aggregates without a currency; amounts are reported in DOP.
const SUMMARY_CURRENCY = 'DOP'

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
	return (
		<StatGrid columns={4}>
			<StatCard
				label={t('totalPrincipal')}
				icon={Landmark}
				loading={loading}
				value={<Amount value={summary?.total_principal || 0} currency={SUMMARY_CURRENCY} />}
				hint={t('activeLoansCount', { count: summary?.active_loans || 0 })}
			/>
			<StatCard
				label={t('totalPending')}
				icon={Wallet}
				loading={loading}
				value={<Amount value={summary?.total_pending || 0} currency={SUMMARY_CURRENCY} />}
			/>
			<StatCard
				label={t('totalCollected')}
				icon={Banknote}
				loading={loading}
				value={<Amount value={summary?.total_collected || 0} currency={SUMMARY_CURRENCY} />}
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
	const [hasLoaded, setHasLoaded] = useState(false)
	const [loadFailed, setLoadFailed] = useState(false)
	const [loans, setLoans] = useState<Loan[]>([])
	const [summary, setSummary] = useState<LoanSummary | null>(null)
	const [createOpen, setCreateOpen] = useState(false)
	const [detailsOpen, setDetailsOpen] = useState(false)
	const [paymentOpen, setPaymentOpen] = useState(false)
	const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null)
	const [selectedLoanDetails, setSelectedLoanDetails] = useState<LoanDetails | null>(null)
	const [loanToCancel, setLoanToCancel] = useState<Loan | null>(null)
	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()
	const selectedLoanIdParam = searchParams.get('selected') || ''
	const openParam = searchParams.get('open') || ''
	const lastAutoOpenKeyRef = useRef('')
	const { data: accounts = [] } = useGetAccounts()

	const accountOptions = useMemo(() => accounts.filter((account) => account.type !== 'credit_card'), [accounts])

	const loadData = useCallback(async () => {
		try {
			setLoadFailed(false)
			const [loanData, summaryData] = await Promise.all([
				getLoanRepository().findAll(),
				getLoanRepository().getSummary(),
			])
			setLoans(loanData || [])
			setSummary(summaryData || null)
		} catch (error) {
			console.error('Error loading loans', error)
			setLoadFailed(true)
		} finally {
			setHasLoaded(true)
		}
	}, [])

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
		void loadData()
	}, [loadData])

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

	const refreshAfterMoneyMovement = async () => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: TRANSACTION_KEYS.lists() }),
			queryClient.invalidateQueries({ queryKey: TRANSACTION_KEYS.simple() }),
			queryClient.invalidateQueries({ queryKey: ACCOUNT_KEYS.lists() }),
		])
		await loadData()
	}

	// Errors propagate to LoanFormDialog, which shows them inline and keeps the input.
	const handleCreate = async (data: CreateLoanDTO) => {
		await getLoanRepository().create(data)
		toast.success(t('created'))
		setCreateOpen(false)
		await refreshAfterMoneyMovement()
	}

	// Errors propagate to LoanPaymentDialog, which shows them inline and keeps the input.
	const handleRegisterPayment = async (data: RegisterLoanPaymentDTO) => {
		if (!selectedLoan) return
		const payment: LoanPayment = await getLoanRepository().registerPayment(selectedLoan.id, data)
		toast.success(t('paymentRegistered'))
		setPaymentOpen(false)
		await refreshAfterMoneyMovement()
		if (selectedLoanDetails) {
			const refreshed = await getLoanRepository().findById(selectedLoan.id)
			setSelectedLoanDetails({
				...refreshed,
				payments: [payment, ...refreshed.payments],
			})
		}
	}

	const handleCancelLoan = async () => {
		if (!loanToCancel) return
		try {
			await getLoanRepository().cancelLoan(loanToCancel.id)
		} catch (error) {
			toast.error(t('cancelLoanError'))
			throw error
		}
		toast.success(t('loanCancelled'))
		await refreshAfterMoneyMovement()
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

	if (!hasLoaded) {
		return <LoansSkeleton />
	}

	if (loadFailed) {
		return (
			<PageShell>
				{header}
				<ErrorState title={t('loadError')} onRetry={() => void loadData()} />
			</PageShell>
		)
	}

	const details = selectedLoanDetails
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
