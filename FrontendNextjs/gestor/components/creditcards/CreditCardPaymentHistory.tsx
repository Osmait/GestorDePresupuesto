'use client'

import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { creditCardRepository } from '@/lib/repositoryConfig'
import { CardPayment, CreditCard, formatCurrency } from '@/types/creditcard'

interface CreditCardPaymentHistoryProps {
	open: boolean
	onClose: () => void
	card: CreditCard | null
}

export function CreditCardPaymentHistory({ open, onClose, card }: CreditCardPaymentHistoryProps) {
	const [loading, setLoading] = useState(false)
	const [payments, setPayments] = useState<CardPayment[]>([])
	const [currencyFilter, setCurrencyFilter] = useState<string>('all')
	const { data: accounts = [] } = useGetAccounts()

	useEffect(() => {
		if (!open || !card) return
		const cardId = card.id

		let cancelled = false
		async function loadPayments() {
			setLoading(true)
			try {
				const data = await creditCardRepository.getPayments(cardId)
				if (!cancelled) {
					setPayments(data || [])
				}
			} catch {
				if (!cancelled) {
					setPayments([])
				}
			} finally {
				if (!cancelled) {
					setLoading(false)
				}
			}
		}

		void loadPayments()
		return () => {
			cancelled = true
		}
	}, [open, card])

	const paymentCurrencies = useMemo(() => {
		const set = new Set<string>()
		payments.forEach((p) => set.add(p.currency))
		return Array.from(set)
	}, [payments])

	const filteredPayments = useMemo(() => {
		if (currencyFilter === 'all') return payments
		return payments.filter((p) => p.currency === currencyFilter)
	}, [payments, currencyFilter])

	const totalsByCurrency = useMemo(() => {
		const totals: Record<string, number> = {}
		filteredPayments.forEach((p) => {
			totals[p.currency] = (totals[p.currency] || 0) + p.amount
		})
		return totals
	}, [filteredPayments])

	const accountNameById = useMemo(() => {
		const map: Record<string, string> = {}
		accounts.forEach((a) => {
			map[a.id] = a.name
		})
		return map
	}, [accounts])

	return (
		<Dialog open={open} onOpenChange={onClose}>
			<DialogContent className='max-w-5xl'>
				<DialogHeader>
					<DialogTitle>
						Payment History {card ? `- ${card.bank} •••• ${card.last_four_digits || '****'}` : ''}
					</DialogTitle>
				</DialogHeader>

				<div className='flex items-center justify-between gap-4'>
					<Select value={currencyFilter} onValueChange={setCurrencyFilter}>
						<SelectTrigger className='w-40'>
							<SelectValue placeholder='All currencies' />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='all'>All currencies</SelectItem>
							{paymentCurrencies.map((currency) => (
								<SelectItem key={currency} value={currency}>
									{currency}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<div className='flex flex-wrap items-center gap-2'>
						{Object.entries(totalsByCurrency).map(([currency, total]) => (
							<Badge key={currency} variant='secondary'>
								{currency}: {formatCurrency(total, currency)}
							</Badge>
						))}
					</div>
				</div>

				{loading ? (
					<div className='space-y-2'>
						<Skeleton className='h-10 w-full' />
						<Skeleton className='h-10 w-full' />
						<Skeleton className='h-10 w-full' />
					</div>
				) : filteredPayments.length === 0 ? (
					<div className='py-8 text-center text-muted-foreground'>No payments registered yet.</div>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Date</TableHead>
								<TableHead>Card Amount</TableHead>
								<TableHead>From Account</TableHead>
								<TableHead>Account Debit</TableHead>
								<TableHead>Rate</TableHead>
								<TableHead>Interest</TableHead>
								<TableHead>Notes</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{filteredPayments.map((payment) => (
								<TableRow key={payment.id}>
									<TableCell>{new Date(payment.payment_date).toLocaleString()}</TableCell>
									<TableCell>{formatCurrency(payment.amount, payment.currency)}</TableCell>
									<TableCell>{accountNameById[payment.from_account_id] || payment.from_account_id}</TableCell>
									<TableCell>
										{payment.source_amount && payment.source_currency
											? formatCurrency(payment.source_amount, payment.source_currency)
											: formatCurrency(payment.amount, payment.currency)}
									</TableCell>
									<TableCell>{payment.exchange_rate ? payment.exchange_rate.toFixed(4) : '-'}</TableCell>
									<TableCell>
										{payment.includes_interest && payment.interest_amount > 0
											? formatCurrency(payment.interest_amount, payment.currency)
											: '-'}
									</TableCell>
									<TableCell>{payment.notes || '-'}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</DialogContent>
		</Dialog>
	)
}
