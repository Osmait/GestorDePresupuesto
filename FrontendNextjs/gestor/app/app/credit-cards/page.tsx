'use client'

import { Banknote, CreditCard as CardIcon, DollarSign, Gauge, Plus, Wallet } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { CreditCardFormModal } from '@/components/creditcards/CreditCardFormModal'
import { CreditCardItem } from '@/components/creditcards/CreditCardItem'
import { CreditCardPaymentHistory } from '@/components/creditcards/CreditCardPaymentHistory'
import { PaymentModal } from '@/components/creditcards/PaymentModal'
import { ReconcileCardModal } from '@/components/creditcards/ReconcileCardModal'
import { Amount } from '@/components/shared/Amount'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { ModuleDisabled } from '@/components/shared/ModuleDisabled'
import { PageHeader } from '@/components/shared/PageHeader'
import { PageShell } from '@/components/shared/PageShell'
import { StatCard, type StatTone } from '@/components/shared/StatCard'
import { StatGrid } from '@/components/shared/StatGrid'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
	useCreateCreditCardMutation,
	useCreatePaymentMutation,
	useDeleteCreditCardMutation,
	useGetCreditCardSummary,
	useGetCreditCards,
	useResetCardBalanceMutation,
	useUpdateCreditCardMutation,
} from '@/hooks/queries/useCreditCardsQuery'
import { useExchangeRateQuery } from '@/hooks/queries/useExchangeRateQuery'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useFormatNumber } from '@/hooks/useFormatNumber'
import { useFormatPercent } from '@/hooks/useFormatPercent'
import { cardDebtTotals, usableRate } from '@/lib/valuation'
import { CreateCreditCardDTO, CreatePaymentDTO, CreditCard, UpdateCreditCardInput } from '@/types/creditcard'

/** Header + KPI + card skeletons, shared by the feature-flag and the cards loading states. */
function CreditCardsSkeleton() {
	const t = useTranslations('creditCards')
	return (
		<PageShell aria-busy='true'>
			<PageHeader title={t('title')} description={t('subtitle')} />
			<StatGrid columns={4}>
				<StatCard label={t('kpis.totalDebt')} icon={Wallet} value={null} loading />
				<StatCard label={t('kpis.debtDop')} icon={Banknote} value={null} loading />
				<StatCard label={t('kpis.debtUsd')} icon={DollarSign} value={null} loading />
				<StatCard label={t('creditHealth')} icon={Gauge} value={null} loading />
			</StatGrid>
			<div className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'>
				<Skeleton className='h-[320px] rounded-lg' />
				<Skeleton className='h-[320px] rounded-lg' />
				<Skeleton className='h-[320px] rounded-lg' />
			</div>
		</PageShell>
	)
}

export default function CreditCardsPage() {
	const t = useTranslations('creditCards')
	const { isEnabled, isLoading: isFeatureFlagsLoading } = useFeatureFlags()

	if (isFeatureFlagsLoading) {
		return <CreditCardsSkeleton />
	}

	if (!isEnabled('module_credit_cards')) {
		return <ModuleDisabled title={t('title')} />
	}

	return <CreditCardsContent />
}

/** The page once the module is on (queries only run from here). */
function CreditCardsContent() {
	const [formOpen, setFormOpen] = useState(false)
	const [paymentOpen, setPaymentOpen] = useState(false)
	const [historyOpen, setHistoryOpen] = useState(false)
	const [selectedCard, setSelectedCard] = useState<CreditCard | null>(null)
	const [cardToDelete, setCardToDelete] = useState<CreditCard | null>(null)
	const [cardToReset, setCardToReset] = useState<CreditCard | null>(null)
	const [cardToReconcile, setCardToReconcile] = useState<CreditCard | null>(null)
	const t = useTranslations('creditCards')
	const formatCurrency = useFormatCurrency()
	const formatPercent = useFormatPercent()
	const formatNumber = useFormatNumber()

	const { data: exchangeRateData } = useExchangeRateQuery()
	const { data: cards = [], isLoading, isError, refetch } = useGetCreditCards()
	const { data: summary } = useGetCreditCardSummary()

	const createMutation = useCreateCreditCardMutation()
	const updateMutation = useUpdateCreditCardMutation()
	const deleteMutation = useDeleteCreditCardMutation()
	const paymentMutation = useCreatePaymentMutation()
	const resetBalanceMutation = useResetCardBalanceMutation()

	// Failures propagate to the form/payment dialogs, which keep the input and show the reason inline.
	const handleCreateCard = async (data: CreateCreditCardDTO) => {
		await createMutation.mutateAsync(data)
		toast.success(t('toasts.created'))
	}

	const handleUpdateCard = async (data: UpdateCreditCardInput) => {
		if (!selectedCard) return
		await updateMutation.mutateAsync({ id: selectedCard.id, data })
		toast.success(t('toasts.updated'))
	}

	const handleConfirmDelete = async () => {
		if (!cardToDelete) return
		try {
			await deleteMutation.mutateAsync(cardToDelete.id)
			toast.success(t('toasts.deleted'))
		} catch (error) {
			toast.error(t('toasts.deleteError'))
			throw error
		}
	}

	const handlePayment = async (data: CreatePaymentDTO) => {
		if (!selectedCard) return
		await paymentMutation.mutateAsync({ cardId: selectedCard.id, data })
		toast.success(t('toasts.paymentProcessed'))
	}

	const handleEdit = (card: CreditCard) => {
		setSelectedCard(card)
		setFormOpen(true)
	}

	const handleCreate = () => {
		setSelectedCard(null)
		setFormOpen(true)
	}

	const handlePay = (card: CreditCard) => {
		setSelectedCard(card)
		setPaymentOpen(true)
	}

	const handleViewPayments = (card: CreditCard) => {
		setSelectedCard(card)
		setHistoryOpen(true)
	}

	const handleConfirmReset = async () => {
		if (!cardToReset) return
		const balances = cardToReset.balances || []
		if (balances.length === 0) {
			toast.error(t('toasts.noBalancesToReset'))
			return
		}
		try {
			await Promise.all(
				balances.map((balance) =>
					resetBalanceMutation.mutateAsync({
						cardId: cardToReset.id,
						balanceId: balance.id,
					}),
				),
			)
			toast.success(t('toasts.resetSuccess'))
		} catch (error) {
			toast.error(t('toasts.resetError'))
			throw error
		}
	}

	const handleFormClose = () => {
		setFormOpen(false)
		setSelectedCard(null)
	}

	const handlePaymentClose = () => {
		setPaymentOpen(false)
		setSelectedCard(null)
	}

	const handleHistoryClose = () => {
		setHistoryOpen(false)
		setSelectedCard(null)
	}

	const cardsList = cards || []
	// null when the rate is missing: USD amounts are then shown apart, never as 0.
	const usdToDopRate = usableRate(exchangeRateData?.usd_to_dop)
	const summaryDebtDOP = summary?.total_debt?.DOP || 0
	const summaryDebtUSD = summary?.total_debt?.USD || 0
	const summaryLimitDOP = summary?.total_credit_limit?.DOP || 0
	const summaryLimitUSD = summary?.total_credit_limit?.USD || 0

	const localTotalDebtDOP = cardsList.reduce(
		(sum, card) =>
			sum +
			(card.balances || [])
				.filter((b) => b.currency === 'DOP')
				.reduce((s, b) => s + Math.max(0, -b.current_balance), 0),
		0,
	)
	const localTotalDebtUSD = cardsList.reduce(
		(sum, card) =>
			sum +
			(card.balances || [])
				.filter((b) => b.currency === 'USD')
				.reduce((s, b) => s + Math.max(0, -b.current_balance), 0),
		0,
	)
	const totalDebtDOP = summary ? summaryDebtDOP : localTotalDebtDOP
	const totalDebtUSD = summary ? summaryDebtUSD : localTotalDebtUSD

	const localTotalLimitDOP = cardsList.reduce(
		(sum, card) =>
			sum + (card.balances || []).filter((b) => b.currency === 'DOP').reduce((s, b) => s + b.credit_limit, 0),
		0,
	)
	const localTotalLimitUSD = cardsList.reduce(
		(sum, card) =>
			sum + (card.balances || []).filter((b) => b.currency === 'USD').reduce((s, b) => s + b.credit_limit, 0),
		0,
	)
	const totalLimitDOP = summary ? summaryLimitDOP : localTotalLimitDOP
	const totalLimitUSD = summary ? summaryLimitUSD : localTotalLimitUSD
	const { totalDebt, usdIncluded, utilization } = cardDebtTotals({
		debtDop: totalDebtDOP,
		debtUsd: totalDebtUSD,
		limitDop: totalLimitDOP,
		limitUsd: totalLimitUSD,
		rate: usdToDopRate,
	})
	const avgUtilization = utilization ?? 0
	const utilizationStatus =
		avgUtilization > 60
			? t('utilizationStatus.highRisk')
			: avgUtilization > 30
				? t('utilizationStatus.watch')
				: t('utilizationStatus.healthy')
	const utilizationTone: StatTone = avgUtilization > 60 ? 'negative' : avgUtilization > 30 ? 'warning' : 'positive'

	if (isLoading) {
		return <CreditCardsSkeleton />
	}

	const header = (
		<PageHeader
			title={t('title')}
			description={t('subtitle')}
			actions={
				<Button onClick={handleCreate}>
					<Plus className='mr-2 h-4 w-4' aria-hidden='true' />
					{t('addCard')}
				</Button>
			}
		/>
	)

	if (isError) {
		return (
			<PageShell>
				{header}
				<ErrorState title={t('loadErrorTitle')} onRetry={() => void refetch()} />
			</PageShell>
		)
	}

	return (
		<PageShell>
			{header}

			<StatGrid columns={4}>
				<StatCard
					label={t('kpis.totalDebt')}
					icon={Wallet}
					tone={usdIncluded ? undefined : 'warning'}
					value={<Amount value={totalDebt} currency='DOP' />}
					hint={usdIncluded ? t('activeCards', { count: cardsList.length }) : t('kpis.rateUnavailable')}
				/>
				<StatCard label={t('kpis.debtDop')} icon={Banknote} value={<Amount value={totalDebtDOP} currency='DOP' />} />
				<StatCard
					label={t('kpis.debtUsd')}
					icon={DollarSign}
					value={<Amount value={totalDebtUSD} currency='USD' />}
					hint={
						usdToDopRate !== null
							? t('kpis.usdInDop', {
									amount: formatCurrency(totalDebtUSD * usdToDopRate, 'DOP'),
									rate: formatNumber(usdToDopRate, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
								})
							: totalDebtUSD > 0
								? t('kpis.rateUnavailable')
								: undefined
					}
				/>
				<StatCard
					label={t('creditHealth')}
					icon={Gauge}
					tone={utilization === null ? undefined : utilizationTone}
					value={utilization === null ? '—' : formatPercent(avgUtilization)}
					hint={
						utilization === null && !usdIncluded
							? t('kpis.rateUnavailable')
							: t('kpis.utilizationHint', { status: utilizationStatus })
					}
				/>
			</StatGrid>

			{cardsList.length === 0 ? (
				<EmptyState
					icon={CardIcon}
					title={t('emptyTitle')}
					description={t('emptyDescription')}
					action={
						<Button onClick={handleCreate}>
							<Plus className='mr-2 h-4 w-4' aria-hidden='true' />
							{t('addCreditCard')}
						</Button>
					}
				/>
			) : (
				<div className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'>
					{cardsList.map((card) => (
						<CreditCardItem
							key={card.id}
							card={card}
							onEdit={handleEdit}
							onDelete={setCardToDelete}
							onPay={handlePay}
							onViewPayments={handleViewPayments}
							onReset={setCardToReset}
							onReconcile={setCardToReconcile}
						/>
					))}
				</div>
			)}

			<CreditCardFormModal
				open={formOpen}
				onClose={handleFormClose}
				onSubmit={handleCreateCard}
				onUpdate={handleUpdateCard}
				card={selectedCard}
			/>

			<PaymentModal open={paymentOpen} onClose={handlePaymentClose} onSubmit={handlePayment} card={selectedCard} />

			<ReconcileCardModal
				open={Boolean(cardToReconcile)}
				setOpen={(open) => !open && setCardToReconcile(null)}
				card={cardToReconcile}
			/>

			<CreditCardPaymentHistory open={historyOpen} onClose={handleHistoryClose} card={selectedCard} />

			<ConfirmDialog
				open={cardToReset !== null}
				onOpenChange={(open) => !open && setCardToReset(null)}
				title={t('resetDialog.title', { name: cardToReset?.name ?? '' })}
				description={t('resetDialog.description', { name: cardToReset?.name ?? '' })}
				confirmLabel={t('resetDialog.confirm')}
				onConfirm={handleConfirmReset}
			/>

			<ConfirmDialog
				open={cardToDelete !== null}
				onOpenChange={(open) => !open && setCardToDelete(null)}
				title={t('deleteDialog.title', { name: cardToDelete?.name ?? '' })}
				description={t('deleteDialog.description')}
				confirmLabel={t('deleteDialog.confirm')}
				destructive
				onConfirm={handleConfirmDelete}
			/>
		</PageShell>
	)
}
