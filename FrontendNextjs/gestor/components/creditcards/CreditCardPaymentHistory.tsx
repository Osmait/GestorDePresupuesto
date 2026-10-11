'use client'

import { Receipt } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { Amount } from '@/components/shared/Amount'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { formatLocalDate, useAppLocale } from '@/lib/i18n/date-locale'
import { getCreditCardRepository } from '@/lib/repositoryConfig'
import { CardPayment, CreditCard } from '@/types/creditcard'

interface CreditCardPaymentHistoryProps {
	open: boolean
	onClose: () => void
	card: CreditCard | null
}

export function CreditCardPaymentHistory({ open, onClose, card }: CreditCardPaymentHistoryProps) {
	const t = useTranslations('creditCards.history')
	const locale = useAppLocale()
	const formatCurrency = useFormatCurrency()
	const [loading, setLoading] = useState(false)
	const [payments, setPayments] = useState<CardPayment[]>([])
	const [loadFailed, setLoadFailed] = useState(false)
	const [reloadKey, setReloadKey] = useState(0)
	const [currencyFilter, setCurrencyFilter] = useState<string>('all')
	const { data: accounts = [] } = useGetAccounts()

	// biome-ignore lint/correctness/useExhaustiveDependencies: `reloadKey` re-runs the load when the user retries.
	useEffect(() => {
		if (!open || !card) return
		const cardId = card.id

		let cancelled = false
		async function loadPayments() {
			setLoading(true)
			setLoadFailed(false)
			try {
				const data = await getCreditCardRepository().getPayments(cardId)
				if (!cancelled) {
					setPayments(data || [])
				}
			} catch {
				if (!cancelled) {
					setPayments([])
					setLoadFailed(true)
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
	}, [open, card, reloadKey])

	const paymentCurrencies = useMemo(() => {
		const set = new Set<string>()
		for (const p of payments) set.add(p.currency)
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

	const formatPaymentDate = (value: string) =>
		formatLocalDate(value, locale, {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		})
	const accountName = (payment: CardPayment) => accountNameById[payment.from_account_id] || payment.from_account_id
	const accountDebit = (payment: CardPayment) =>
		payment.source_amount && payment.source_currency
			? formatCurrency(payment.source_amount, payment.source_currency)
			: formatCurrency(payment.amount, payment.currency)
	const rate = (payment: CardPayment) => (payment.exchange_rate ? payment.exchange_rate.toFixed(4) : '-')
	const interest = (payment: CardPayment) =>
		payment.includes_interest && payment.interest_amount > 0
			? formatCurrency(payment.interest_amount, payment.currency)
			: '-'

	return (
		<Dialog open={open} onOpenChange={onClose}>
			<DialogContent className='max-h-[90vh] w-[95vw] max-w-5xl overflow-y-auto'>
				<DialogHeader>
					<DialogTitle>
						{t('title')} {card ? `- ${card.bank} •••• ${card.last_four_digits || '****'}` : ''}
					</DialogTitle>
				</DialogHeader>

				<div className='flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4'>
					<Select value={currencyFilter} onValueChange={setCurrencyFilter}>
						<SelectTrigger className='w-full sm:w-40'>
							<SelectValue placeholder={t('allCurrencies')} />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value='all'>{t('allCurrencies')}</SelectItem>
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
				) : loadFailed ? (
					<ErrorState compact onRetry={() => setReloadKey((key) => key + 1)} />
				) : filteredPayments.length === 0 ? (
					<EmptyState compact icon={Receipt} title={t('empty')} />
				) : (
					<>
						<ul className='space-y-3 md:hidden'>
							{filteredPayments.map((payment) => (
								<li key={payment.id} className='space-y-2 rounded-lg border p-3 text-sm'>
									<div className='flex items-start justify-between gap-3'>
										<span className='text-muted-foreground'>{formatPaymentDate(payment.payment_date)}</span>
										<Amount value={payment.amount} currency={payment.currency} className='font-semibold' />
									</div>
									<dl className='grid grid-cols-2 gap-x-3 gap-y-1 text-xs'>
										<dt className='text-muted-foreground'>{t('fromAccount')}</dt>
										<dd className='truncate text-right'>{accountName(payment)}</dd>
										<dt className='text-muted-foreground'>{t('accountDebit')}</dt>
										<dd className='text-right'>{accountDebit(payment)}</dd>
										<dt className='text-muted-foreground'>{t('rate')}</dt>
										<dd className='text-right'>{rate(payment)}</dd>
										<dt className='text-muted-foreground'>{t('interest')}</dt>
										<dd className='text-right'>{interest(payment)}</dd>
									</dl>
									{payment.notes ? <p className='text-xs text-muted-foreground'>{payment.notes}</p> : null}
								</li>
							))}
						</ul>
						<div className='hidden md:block'>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t('date')}</TableHead>
										<TableHead>{t('cardAmount')}</TableHead>
										<TableHead>{t('fromAccount')}</TableHead>
										<TableHead>{t('accountDebit')}</TableHead>
										<TableHead>{t('rate')}</TableHead>
										<TableHead>{t('interest')}</TableHead>
										<TableHead>{t('notes')}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filteredPayments.map((payment) => (
										<TableRow key={payment.id}>
											<TableCell className='whitespace-nowrap'>{formatPaymentDate(payment.payment_date)}</TableCell>
											<TableCell>
												<Amount value={payment.amount} currency={payment.currency} />
											</TableCell>
											<TableCell>{accountName(payment)}</TableCell>
											<TableCell>{accountDebit(payment)}</TableCell>
											<TableCell>{rate(payment)}</TableCell>
											<TableCell>{interest(payment)}</TableCell>
											<TableCell>{payment.notes || '-'}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	)
}
