'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard, CreditCardSummary, CreateCreditCardDTO, CreatePaymentDTO } from '@/types/creditcard'
import { creditCardRepository } from '@/lib/repositoryConfig'
import { CreditCardItem } from '@/components/creditcards/CreditCardItem'
import { CreditCardFormModal } from '@/components/creditcards/CreditCardFormModal'
import { PaymentModal } from '@/components/creditcards/PaymentModal'
import { CreditCardPaymentHistory } from '@/components/creditcards/CreditCardPaymentHistory'
import { useExchangeRateQuery } from '@/hooks/queries/useExchangeRateQuery'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, CreditCard as CardIcon } from 'lucide-react'
import { toast } from 'sonner'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'

export default function CreditCardsPage() {
	const [cards, setCards] = useState<CreditCard[]>([])
	const [summary, setSummary] = useState<CreditCardSummary | null>(null)
	const [loading, setLoading] = useState(true)
	const [formOpen, setFormOpen] = useState(false)
	const [paymentOpen, setPaymentOpen] = useState(false)
	const [historyOpen, setHistoryOpen] = useState(false)
	const [selectedCard, setSelectedCard] = useState<CreditCard | null>(null)
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
	const router = useRouter()
	const { data: exchangeRateData } = useExchangeRateQuery()
	const { isEnabled, isLoading: isFeatureFlagsLoading } = useFeatureFlags()
	const isCreditCardsModuleEnabled = isEnabled('module_credit_cards')

	useEffect(() => {
		if (isFeatureFlagsLoading || !isCreditCardsModuleEnabled) {
			return
		}
		loadCards()
	}, [isFeatureFlagsLoading, isCreditCardsModuleEnabled])

	const loadCards = async () => {
		try {
			setLoading(true)
			const [data, summaryData] = await Promise.all([
				creditCardRepository.findAll(),
				creditCardRepository.getSummary(),
			])
			setCards(data || [])
			setSummary(summaryData || null)
		} catch (error) {
			console.error('Error loading cards:', error)
			toast.error('Failed to load credit cards')
			setCards([])
			setSummary(null)
		} finally {
			setLoading(false)
		}
	}

	const handleCreateCard = async (data: CreateCreditCardDTO) => {
		try {
			await creditCardRepository.create(data)
			await loadCards()
			toast.success('Credit card created successfully')
		} catch (error) {
			console.error('Error creating card:', error)
			throw error
		}
	}

	const handleUpdateCard = async (data: CreateCreditCardDTO) => {
		if (!selectedCard) return
		try {
			await creditCardRepository.update(selectedCard.id, data)
			await loadCards()
			toast.success('Credit card updated successfully')
		} catch (error) {
			console.error('Error updating card:', error)
			throw error
		}
	}

	const handleDeleteCard = async () => {
		if (!selectedCard) return
		try {
			await creditCardRepository.delete(selectedCard.id)
			await loadCards()
			toast.success('Credit card deleted successfully')
		} catch (error) {
			console.error('Error deleting card:', error)
			toast.error('Failed to delete credit card')
		} finally {
			setDeleteDialogOpen(false)
			setSelectedCard(null)
		}
	}

	const handlePayment = async (data: CreatePaymentDTO) => {
		if (!selectedCard) return
		try {
			await creditCardRepository.createPayment(selectedCard.id, data)
			await loadCards()
			toast.success('Payment processed successfully')
		} catch (error) {
			console.error('Error processing payment:', error)
			throw error
		}
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
		(sum, card) => sum + (card.balances || [])
			.filter((b) => b.currency === 'DOP')
			.reduce((s, b) => s + Math.max(0, -b.current_balance), 0),
		0
	)
	const localTotalDebtUSD = cardsList.reduce(
		(sum, card) => sum + (card.balances || [])
			.filter((b) => b.currency === 'USD')
			.reduce((s, b) => s + Math.max(0, -b.current_balance), 0),
		0
	)
	const totalDebtDOP = summary ? summaryDebtDOP : localTotalDebtDOP
	const totalDebtUSD = summary ? summaryDebtUSD : localTotalDebtUSD
	const totalDebtUSDInDOP = totalDebtUSD * usdToDopRate
	const totalDebt = totalDebtDOP + totalDebtUSDInDOP

	const localTotalLimitDOP = cardsList.reduce(
		(sum, card) => sum + (card.balances || [])
			.filter((b) => b.currency === 'DOP')
			.reduce((s, b) => s + b.credit_limit, 0),
		0
	)
	const localTotalLimitUSD = cardsList.reduce(
		(sum, card) => sum + (card.balances || [])
			.filter((b) => b.currency === 'USD')
			.reduce((s, b) => s + b.credit_limit, 0),
		0
	)
	const totalLimitDOP = summary ? summaryLimitDOP : localTotalLimitDOP
	const totalLimitUSD = summary ? summaryLimitUSD : localTotalLimitUSD
	const totalLimit = totalLimitDOP + (totalLimitUSD * usdToDopRate)
	const avgUtilization = totalLimit > 0 ? (totalDebt / totalLimit) * 100 : 0
	const utilizationStatus = avgUtilization > 60 ? 'High Risk' : avgUtilization > 30 ? 'Watch' : 'Healthy'
	const utilizationStatusClass = avgUtilization > 60
		? 'text-destructive'
		: avgUtilization > 30
			? 'text-warning'
			: 'text-success'

	if (isFeatureFlagsLoading) {
		return (
			<div className="container mx-auto p-6 space-y-6">
				<Skeleton className="h-8 w-48" />
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<Skeleton className="h-36 md:col-span-2" />
					<Skeleton className="h-36" />
				</div>
			</div>
		)
	}

	if (!isCreditCardsModuleEnabled) {
		return (
			<div className="container mx-auto p-6 space-y-4">
				<h1 className="text-2xl font-semibold">Credit Cards</h1>
				<p className="text-muted-foreground">This module is currently disabled for your account.</p>
				<Button variant="outline" onClick={() => router.push('/app')}>Go to dashboard</Button>
			</div>
		)
	}

	if (loading) {
		return (
			<div className="container mx-auto p-6 space-y-6">
				<Skeleton className="h-8 w-48" />
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<Skeleton className="h-36 md:col-span-2" />
					<Skeleton className="h-36" />
				</div>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					<Skeleton className="h-64" />
					<Skeleton className="h-64" />
					<Skeleton className="h-64" />
				</div>
			</div>
		)
	}

	return (
		<div className="container mx-auto p-6 space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold">Credit Cards</h1>
					<p className="text-muted-foreground">Manage your credit cards and payments</p>
				</div>
				<Button onClick={() => setFormOpen(true)}>
					<Plus className="h-4 w-4 mr-2" />
					Add Card
				</Button>
			</div>

			<div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
				<Card className='border-border/60 bg-card/60 md:col-span-2'>
					<CardHeader className='pb-1'>
						<CardTitle className='text-sm font-medium text-muted-foreground'>General Summary</CardTitle>
					</CardHeader>
					<CardContent className='space-y-3 pt-0'>
						<div className='flex items-center gap-2'>
							<CardIcon className='h-5 w-5 text-primary' />
							<span className='text-3xl font-semibold text-foreground'>
								{totalDebt.toLocaleString('es-DO', { style: 'currency', currency: 'DOP' })}
							</span>
						</div>

						<div className='grid grid-cols-1 gap-1 text-[12px] text-muted-foreground sm:grid-cols-2'>
							<p>DOP: {totalDebtDOP.toLocaleString('es-DO', { style: 'currency', currency: 'DOP' })}</p>
							<p>USD: {totalDebtUSD.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
							<p>USD→DOP: {totalDebtUSDInDOP.toLocaleString('es-DO', { style: 'currency', currency: 'DOP' })}</p>
							<p>{cardsList.length} active cards</p>
						</div>

						{usdToDopRate > 0 && (
							<p className='text-[11px] text-muted-foreground'>Rate: 1 USD = {usdToDopRate.toFixed(2)} DOP</p>
						)}
					</CardContent>
				</Card>

				<Card className='border-border/60 bg-card/60'>
					<CardHeader className='pb-1'>
						<CardTitle className='text-sm font-medium text-muted-foreground'>Credit Health</CardTitle>
					</CardHeader>
					<CardContent className='space-y-3 pt-0'>
						<p className='text-3xl font-semibold text-foreground'>{avgUtilization.toFixed(1)}%</p>
						<p className={`text-sm font-medium ${utilizationStatusClass}`}>{utilizationStatus}</p>
						<p className='text-[12px] text-muted-foreground'>Target: below 30%</p>
					</CardContent>
				</Card>
			</div>

			{cardsList.length === 0 ? (
				<Card className="p-12">
					<div className="flex flex-col items-center justify-center text-center">
						<CardIcon className="h-12 w-12 text-muted-foreground mb-4" />
						<h3 className="text-lg font-medium">No credit cards yet</h3>
						<p className="text-muted-foreground mb-4">
							Add your first credit card to start tracking your debt
						</p>
						<Button onClick={() => setFormOpen(true)}>
							<Plus className="h-4 w-4 mr-2" />
							Add Credit Card
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

			<PaymentModal
				open={paymentOpen}
				onClose={handlePaymentClose}
				onSubmit={handlePayment}
				card={selectedCard}
			/>

			<CreditCardPaymentHistory
				open={historyOpen}
				onClose={handleHistoryClose}
				card={selectedCard}
			/>

			<Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Credit Card</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete {selectedCard?.name}? This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={handleDeleteCard}>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	)
}
