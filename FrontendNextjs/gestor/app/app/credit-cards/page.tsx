'use client'

import { CreditCard as CardIcon, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { CreditCardFormModal } from '@/components/creditcards/CreditCardFormModal'
import { CreditCardItem } from '@/components/creditcards/CreditCardItem'
import { CreditCardPaymentHistory } from '@/components/creditcards/CreditCardPaymentHistory'
import { PaymentModal } from '@/components/creditcards/PaymentModal'
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
import { useAppLocale } from '@/lib/i18n/date-locale'
import { formatCurrency } from '@/lib/utils'
import { CreateCreditCardDTO, CreatePaymentDTO, CreditCard } from '@/types/creditcard'

export default function CreditCardsPage() {
	const [formOpen, setFormOpen] = useState(false)
	const [paymentOpen, setPaymentOpen] = useState(false)
	const [historyOpen, setHistoryOpen] = useState(false)
	const [selectedCard, setSelectedCard] = useState<CreditCard | null>(null)
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const [resetDialogOpen, setResetDialogOpen] = useState(false)
	const router = useRouter()
	const t = useTranslations('creditCards')
	const tCommon = useTranslations('common')
	const locale = useAppLocale()

	const { data: exchangeRateData } = useExchangeRateQuery()
	const { isEnabled, isLoading: isFeatureFlagsLoading } = useFeatureFlags()
	const isCreditCardsModuleEnabled = isEnabled('module_credit_cards')

	const { data: cards = [], isLoading } = useGetCreditCards()
	const { data: summary } = useGetCreditCardSummary()

	const createMutation = useCreateCreditCardMutation()
	const updateMutation = useUpdateCreditCardMutation()
	const deleteMutation = useDeleteCreditCardMutation()
	const paymentMutation = useCreatePaymentMutation()
	const resetBalanceMutation = useResetCardBalanceMutation()

	const handleCreateCard = async (data: CreateCreditCardDTO) => {
		await createMutation.mutateAsync(data)
		toast.success(t('toasts.created'))
	}

	const handleUpdateCard = async (data: CreateCreditCardDTO) => {
		if (!selectedCard) return
		await updateMutation.mutateAsync({ id: selectedCard.id, data })
		toast.success(t('toasts.updated'))
	}

	const handleDeleteCard = async () => {
		if (!selectedCard) return
		try {
			await deleteMutation.mutateAsync(selectedCard.id)
			toast.success(t('toasts.deleted'))
		} catch {
			toast.error(t('toasts.deleteError'))
		} finally {
			setDeleteDialogOpen(false)
			setSelectedCard(null)
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

	const handleDelete = (card: CreditCard) => {
		setSelectedCard(card)
		setDeleteDialogOpen(true)
	}

	const handlePay = (card: CreditCard) => {
		setSelectedCard(card)
		setPaymentOpen(true)
	}

	const handleViewPayments = (card: CreditCard) => {
		setSelectedCard(card)
		setHistoryOpen(true)
	}

	const handleReset = (card: CreditCard) => {
		setSelectedCard(card)
		setResetDialogOpen(true)
	}

	const handleConfirmReset = async () => {
		if (!selectedCard) return
		try {
			const balances = selectedCard.balances || []
			if (balances.length === 0) {
				toast.error(t('toasts.noBalancesToReset'))
				return
			}
			await Promise.all(
				balances.map((balance) =>
					resetBalanceMutation.mutateAsync({
						cardId: selectedCard.id,
						balanceId: balance.id,
					}),
				),
			)
			toast.success(t('toasts.resetSuccess'))
		} catch {
			toast.error(t('toasts.resetError'))
		} finally {
			setResetDialogOpen(false)
			setSelectedCard(null)
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
	const usdToDopRate = exchangeRateData?.usd_to_dop || 0
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
	const totalDebtUSDInDOP = totalDebtUSD * usdToDopRate
	const totalDebt = totalDebtDOP + totalDebtUSDInDOP

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
	const totalLimit = totalLimitDOP + totalLimitUSD * usdToDopRate
	const avgUtilization = totalLimit > 0 ? (totalDebt / totalLimit) * 100 : 0
	const utilizationStatus =
		avgUtilization > 60
			? t('utilizationStatus.highRisk')
			: avgUtilization > 30
				? t('utilizationStatus.watch')
				: t('utilizationStatus.healthy')
	const utilizationStatusClass =
		avgUtilization > 60 ? 'text-destructive' : avgUtilization > 30 ? 'text-warning' : 'text-success'

	if (isFeatureFlagsLoading) {
		return (
			<div className='container mx-auto px-4 py-8 space-y-6'>
				<Skeleton className='h-8 w-48' />
				<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
					<Skeleton className='h-36 md:col-span-2' />
					<Skeleton className='h-36' />
				</div>
			</div>
		)
	}

	if (!isCreditCardsModuleEnabled) {
		return (
			<div className='container mx-auto px-4 py-8 space-y-4'>
				<h1 className='text-2xl font-semibold'>{t('title')}</h1>
				<p className='text-muted-foreground'>{tCommon('moduleDisabled.message')}</p>
				<Button variant='outline' onClick={() => router.push('/app')}>
					{tCommon('moduleDisabled.goToDashboard')}
				</Button>
			</div>
		)
	}

	if (isLoading) {
		return (
			<div className='container mx-auto px-4 py-8 space-y-6'>
				<Skeleton className='h-8 w-48' />
				<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
					<Skeleton className='h-36 md:col-span-2' />
					<Skeleton className='h-36' />
				</div>
				<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
					<Skeleton className='h-64' />
					<Skeleton className='h-64' />
					<Skeleton className='h-64' />
				</div>
			</div>
		)
	}

	return (
		<div className='container mx-auto px-4 py-8 space-y-6'>
			<div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
				<div>
					<h1 className='text-3xl font-bold'>{t('title')}</h1>
					<p className='text-muted-foreground'>{t('subtitle')}</p>
				</div>
				<Button onClick={() => setFormOpen(true)} className='w-full sm:w-auto'>
					<Plus className='h-4 w-4 mr-2' />
					{t('addCard')}
				</Button>
			</div>

			<div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
				<Card className='border-border/60 bg-card/60 md:col-span-2'>
					<CardHeader className='pb-1'>
						<CardTitle className='text-sm font-medium text-muted-foreground'>{t('generalSummary')}</CardTitle>
					</CardHeader>
					<CardContent className='space-y-3 pt-0'>
						<div className='flex items-center gap-2'>
							<CardIcon className='h-5 w-5 text-primary' />
							<span className='break-all text-2xl font-semibold text-foreground sm:text-3xl'>
								{formatCurrency(totalDebt, 'DOP', { locale })}
							</span>
						</div>

						<div className='grid grid-cols-1 gap-1 text-[12px] text-muted-foreground sm:grid-cols-2'>
							<p>DOP: {formatCurrency(totalDebtDOP, 'DOP', { locale })}</p>
							<p>USD: {formatCurrency(totalDebtUSD, 'USD', { locale })}</p>
							<p>USD→DOP: {formatCurrency(totalDebtUSDInDOP, 'DOP', { locale })}</p>
							<p>{t('activeCards', { count: cardsList.length })}</p>
						</div>

						{usdToDopRate > 0 && (
							<p className='text-[11px] text-muted-foreground'>
								{t('exchangeRate', { rate: usdToDopRate.toFixed(2) })}
							</p>
						)}
					</CardContent>
				</Card>

				<Card className='border-border/60 bg-card/60'>
					<CardHeader className='pb-1'>
						<CardTitle className='text-sm font-medium text-muted-foreground'>{t('creditHealth')}</CardTitle>
					</CardHeader>
					<CardContent className='space-y-3 pt-0'>
						<p className='text-3xl font-semibold text-foreground'>{avgUtilization.toFixed(1)}%</p>
						<p className={`text-sm font-medium ${utilizationStatusClass}`}>{utilizationStatus}</p>
						<p className='text-[12px] text-muted-foreground'>{t('utilizationTarget')}</p>
					</CardContent>
				</Card>
			</div>

			{cardsList.length === 0 ? (
				<Card className='p-6 sm:p-12'>
					<div className='flex flex-col items-center justify-center text-center'>
						<CardIcon className='h-12 w-12 text-muted-foreground mb-4' />
						<h3 className='text-lg font-medium'>{t('emptyTitle')}</h3>
						<p className='text-muted-foreground mb-4'>{t('emptyDescription')}</p>
						<Button onClick={() => setFormOpen(true)}>
							<Plus className='h-4 w-4 mr-2' />
							{t('addCreditCard')}
						</Button>
					</div>
				</Card>
			) : (
				<div className='grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3'>
					{cardsList.map((card) => (
						<CreditCardItem
							key={card.id}
							card={card}
							onEdit={handleEdit}
							onDelete={handleDelete}
							onPay={handlePay}
							onViewPayments={handleViewPayments}
							onReset={handleReset}
						/>
					))}
				</div>
			)}

			<CreditCardFormModal
				open={formOpen}
				onClose={handleFormClose}
				onSubmit={selectedCard ? handleUpdateCard : handleCreateCard}
				card={selectedCard}
			/>

			<PaymentModal open={paymentOpen} onClose={handlePaymentClose} onSubmit={handlePayment} card={selectedCard} />

			<CreditCardPaymentHistory open={historyOpen} onClose={handleHistoryClose} card={selectedCard} />

			<Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t('resetDialog.title')}</DialogTitle>
						<DialogDescription>{t('resetDialog.description', { name: selectedCard?.name ?? '' })}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant='outline' onClick={() => setResetDialogOpen(false)}>
							{t('cancel')}
						</Button>
						<Button onClick={handleConfirmReset} disabled={resetBalanceMutation.isPending}>
							{resetBalanceMutation.isPending ? t('resetDialog.resetting') : t('resetDialog.confirm')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t('deleteDialog.title')}</DialogTitle>
						<DialogDescription>{t('deleteDialog.description', { name: selectedCard?.name ?? '' })}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant='outline' onClick={() => setDeleteDialogOpen(false)}>
							{t('cancel')}
						</Button>
						<Button variant='destructive' onClick={handleDeleteCard} disabled={deleteMutation.isPending}>
							{deleteMutation.isPending ? t('deleteDialog.deleting') : t('deleteDialog.confirm')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}
