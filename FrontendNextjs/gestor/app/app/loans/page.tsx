'use client'

import { useEffect, useMemo, useState } from 'react'
import { loanRepository } from '@/lib/repositoryConfig'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { ACCOUNT_KEYS } from '@/hooks/queries/useAccountsQuery'
import { TRANSACTION_KEYS } from '@/hooks/queries/useTransactionsQuery'
import { CreateLoanDTO, Loan, LoanDetails, LoanPayment, LoanSummary } from '@/types/loan'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'

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
	const [createForm, setCreateForm] = useState<CreateLoanDTO>(initialCreateForm)
	const [paymentAmount, setPaymentAmount] = useState('')
	const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
	const [paymentDestination, setPaymentDestination] = useState('')
	const [paymentNotes, setPaymentNotes] = useState('')
	const { data: accounts = [] } = useGetAccounts()

	const accountOptions = useMemo(() => accounts.filter((account) => account.type !== 'credit_card'), [accounts])

	useEffect(() => {
		void loadData()
	}, [])

	useEffect(() => {
		if (accountOptions.length > 0 && !createForm.source_account_id) {
			setCreateForm((prev) => ({ ...prev, source_account_id: accountOptions[0].id }))
		}
		if (accountOptions.length > 0 && !paymentDestination) {
			setPaymentDestination(accountOptions[0].id)
		}
	}, [accountOptions, createForm.source_account_id, paymentDestination])

	const loadData = async () => {
		try {
			setLoading(true)
			const [loanData, summaryData] = await Promise.all([
				loanRepository.findAll(),
				loanRepository.getSummary(),
			])
			setLoans(loanData || [])
			setSummary(summaryData || null)
		} catch (error) {
			console.error('Error loading loans', error)
			toast.error(t('loadError'))
		} finally {
			setLoading(false)
		}
	}

	const openDetails = async (loanId: string) => {
		try {
			const details = await loanRepository.findById(loanId)
			setSelectedLoanDetails(details)
			setDetailsOpen(true)
		} catch (error) {
			toast.error(t('loadDetailsError'))
		}
	}

	const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		try {
			setSaving(true)
			await loanRepository.create({
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
		const formatInlineMoney = (value: number) => new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'es-DO', {
			style: 'currency',
			currency,
			maximumFractionDigits: 2,
		}).format(value)

		if (Number.isNaN(numericPaymentAmount) || numericPaymentAmount <= 0) {
			toast.error(t('invalidPaymentAmount'), {
				description: t('invalidPaymentAmountDetailed'),
				duration: 4000,
			})
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
			const payment: LoanPayment = await loanRepository.registerPayment(selectedLoan.id, {
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
				const refreshed = await loanRepository.findById(selectedLoan.id)
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

	const formatMoney = (value: number, currency: string) => new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'es-DO', {
		style: 'currency',
		currency,
		maximumFractionDigits: 2,
	}).format(value)

	const getStatusVariant = (status: Loan['status']) => {
		if (status === 'paid') return 'default'
		if (status === 'active') return 'secondary'
		if (status === 'defaulted') return 'destructive'
		return 'outline'
	}

	if (loading) {
		return <div className='container mx-auto p-6'>{t('loading')}</div>
	}

	return (
		<div className='container mx-auto space-y-6 p-6'>
			<div className='flex items-center justify-between'>
				<div>
					<h1 className='text-3xl font-bold'>{t('title')}</h1>
					<p className='text-muted-foreground'>{t('subtitle')}</p>
				</div>
				<Button onClick={() => setCreateOpen(true)}>
					<Plus className='mr-2 h-4 w-4' />
					{t('newLoan')}
				</Button>
			</div>

			<div className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5'>
				<Card>
					<CardHeader className='pb-2'>
						<CardTitle className='text-sm text-muted-foreground'>{t('totalPrincipal')}</CardTitle>
					</CardHeader>
					<CardContent className='text-xl font-semibold'>{formatMoney(summary?.total_principal || 0, 'DOP')}</CardContent>
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
					<CardContent className='text-xl font-semibold'>{formatMoney(summary?.total_collected || 0, 'DOP')}</CardContent>
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
						<Table>
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
									<TableRow key={loan.id}>
										<TableCell>
											<div className='font-medium'>{loan.borrower_name}</div>
											<div className='text-xs text-muted-foreground'>{loan.borrower_contact || '-'}</div>
										</TableCell>
										<TableCell>{formatMoney(loan.principal_amount, loan.currency)}</TableCell>
										<TableCell>
											<div className='font-medium text-emerald-600'>{formatMoney(loan.paid_interest, loan.currency)}</div>
											<div className='text-xs text-muted-foreground'>
												{t('ofTotalInterest', { total: formatMoney(loan.total_interest, loan.currency) })}
											</div>
										</TableCell>
										<TableCell>{formatMoney(loan.pending_amount, loan.currency)}</TableCell>
										<TableCell>
											<Badge variant={getStatusVariant(loan.status)}>{loan.status}</Badge>
										</TableCell>
										<TableCell>
											<div className='flex gap-2'>
												<Button variant='outline' size='sm' onClick={() => openDetails(loan.id)}>{t('details')}</Button>
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
											</div>
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					)}
				</CardContent>
			</Card>

			<Dialog open={createOpen} onOpenChange={setCreateOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t('newLoan')}</DialogTitle>
						<DialogDescription>{t('newLoanDescription')}</DialogDescription>
					</DialogHeader>
					<form className='space-y-3' onSubmit={handleCreate}>
						<div className='space-y-2'>
							<Label>{t('borrower')}</Label>
							<Input value={createForm.borrower_name} onChange={(event) => setCreateForm((prev) => ({ ...prev, borrower_name: event.target.value }))} required />
						</div>
						<div className='space-y-2'>
							<Label>{t('contact')}</Label>
							<Input value={createForm.borrower_contact} onChange={(event) => setCreateForm((prev) => ({ ...prev, borrower_contact: event.target.value }))} />
						</div>
						<div className='grid grid-cols-2 gap-3'>
							<div className='space-y-2'>
								<Label>{t('principal')}</Label>
								<Input type='number' min={0} step='0.01' value={createForm.principal_amount} onChange={(event) => setCreateForm((prev) => ({ ...prev, principal_amount: Number(event.target.value) }))} required />
							</div>
							<div className='space-y-2'>
								<Label>{t('annualRate')}</Label>
								<Input type='number' min={0} step='0.01' value={createForm.annual_rate} onChange={(event) => setCreateForm((prev) => ({ ...prev, annual_rate: Number(event.target.value) }))} required={createForm.interest_mode === 'fixed_total'} />
							</div>
						</div>
						<div className='grid grid-cols-2 gap-3'>
							<div className='space-y-2'>
								<Label>{t('termMonths')}</Label>
								<Input type='number' min={1} max={120} value={createForm.term_months} onChange={(event) => setCreateForm((prev) => ({ ...prev, term_months: Number(event.target.value) }))} required />
							</div>
							<div className='space-y-2'>
								<Label>{t('startDate')}</Label>
								<Input type='date' value={createForm.start_date} onChange={(event) => setCreateForm((prev) => ({ ...prev, start_date: event.target.value }))} required />
							</div>
						</div>
						<div className='space-y-2'>
							<Label>{t('sourceAccount')}</Label>
							<select className='w-full rounded-md border bg-background px-3 py-2 text-sm' value={createForm.source_account_id} onChange={(event) => setCreateForm((prev) => ({ ...prev, source_account_id: event.target.value }))}>
								{accountOptions.map((account) => (
									<option key={account.id} value={account.id}>{account.name}</option>
								))}
							</select>
						</div>
						<div className='space-y-2'>
							<Label>{t('notes')}</Label>
							<Input value={createForm.notes} onChange={(event) => setCreateForm((prev) => ({ ...prev, notes: event.target.value }))} />
						</div>
						<DialogFooter>
							<Button type='button' variant='outline' onClick={() => setCreateOpen(false)}>{t('cancel')}</Button>
							<Button type='submit' disabled={saving}>{saving ? t('saving') : t('create')}</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t('registerPayment')}</DialogTitle>
						<DialogDescription>{selectedLoan?.borrower_name}</DialogDescription>
					</DialogHeader>
					<form className='space-y-3' onSubmit={handleRegisterPayment}>
						<div className='space-y-2'>
							<Label>{t('destinationAccount')}</Label>
							<select className='w-full rounded-md border bg-background px-3 py-2 text-sm' value={paymentDestination} onChange={(event) => setPaymentDestination(event.target.value)}>
								{accountOptions.map((account) => (
									<option key={account.id} value={account.id}>{account.name}</option>
								))}
							</select>
						</div>
						<div className='grid grid-cols-2 gap-3'>
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
									{t('pendingAmountLabel', { amount: formatMoney(selectedLoan?.pending_amount || 0, selectedLoan?.currency || 'DOP') })}
								</p>
							</div>
							<div className='space-y-2'>
								<Label>{t('paymentDate')}</Label>
								<Input type='date' value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} required />
							</div>
						</div>
						<div className='space-y-2'>
							<Label>{t('notes')}</Label>
							<Input value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} />
						</div>
						<DialogFooter>
							<Button type='button' variant='outline' onClick={() => setPaymentOpen(false)}>{t('cancel')}</Button>
							<Button type='submit' disabled={saving}>{saving ? t('saving') : t('confirmPayment')}</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
				<DialogContent className='w-[95vw] max-w-5xl max-h-[88vh] overflow-hidden p-0'>
					<DialogHeader className='border-b border-border/60 px-6 py-4'>
						<DialogTitle>{t('loanDetails')}</DialogTitle>
						<DialogDescription>{selectedLoanDetails?.loan.borrower_name}</DialogDescription>
					</DialogHeader>
					{selectedLoanDetails && (
						<div className='space-y-5 overflow-y-auto px-6 py-4 max-h-[calc(88vh-90px)]'>
							<div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
								<Card>
									<CardHeader className='pb-1'><CardTitle className='text-xs text-muted-foreground'>{t('principal')}</CardTitle></CardHeader>
									<CardContent>{formatMoney(selectedLoanDetails.loan.principal_amount, selectedLoanDetails.loan.currency)}</CardContent>
								</Card>
								<Card>
									<CardHeader className='pb-1'><CardTitle className='text-xs text-muted-foreground'>{t('interest')}</CardTitle></CardHeader>
									<CardContent>{formatMoney(selectedLoanDetails.loan.total_interest, selectedLoanDetails.loan.currency)}</CardContent>
								</Card>
								<Card>
									<CardHeader className='pb-1'><CardTitle className='text-xs text-muted-foreground'>{t('pending')}</CardTitle></CardHeader>
									<CardContent>{formatMoney(selectedLoanDetails.loan.pending_amount, selectedLoanDetails.loan.currency)}</CardContent>
								</Card>
							</div>

							<h3 className='text-sm font-semibold'>{t('installments')}</h3>
							<div className='rounded-md border border-border/60 max-h-[32vh] overflow-auto'>
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>#</TableHead>
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
												<TableCell>{new Date(item.due_date).toLocaleDateString()}</TableCell>
												<TableCell>{formatMoney(item.expected_amount, selectedLoanDetails.loan.currency)}</TableCell>
												<TableCell>{formatMoney(item.paid_amount, selectedLoanDetails.loan.currency)}</TableCell>
												<TableCell><Badge variant='outline'>{item.status}</Badge></TableCell>
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
												<TableCell>{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
												<TableCell>{formatMoney(payment.amount, selectedLoanDetails.loan.currency)}</TableCell>
												<TableCell>{formatMoney(payment.principal_component, selectedLoanDetails.loan.currency)}</TableCell>
												<TableCell>{formatMoney(payment.interest_component, selectedLoanDetails.loan.currency)}</TableCell>
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
