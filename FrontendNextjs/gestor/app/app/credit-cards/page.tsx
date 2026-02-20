'use client'

import { useState, useEffect } from 'react'
import { CreditCard, CreateCreditCardDTO, CreatePaymentDTO } from '@/types/creditcard'
import { creditCardRepository } from '@/lib/repositoryConfig'
import { CreditCardItem } from '@/components/creditcards/CreditCardItem'
import { CreditCardFormModal } from '@/components/creditcards/CreditCardFormModal'
import { PaymentModal } from '@/components/creditcards/PaymentModal'
import { CreditCardPaymentHistory } from '@/components/creditcards/CreditCardPaymentHistory'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, CreditCard as CardIcon, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'

export default function CreditCardsPage() {
	const [cards, setCards] = useState<CreditCard[]>([])
	const [loading, setLoading] = useState(true)
	const [formOpen, setFormOpen] = useState(false)
	const [paymentOpen, setPaymentOpen] = useState(false)
	const [historyOpen, setHistoryOpen] = useState(false)
	const [selectedCard, setSelectedCard] = useState<CreditCard | null>(null)
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

	useEffect(() => {
		loadCards()
	}, [])

	const loadCards = async () => {
		try {
			setLoading(true)
			const data = await creditCardRepository.findAll()
			setCards(data || [])
		} catch (error) {
			console.error('Error loading cards:', error)
			toast.error('Failed to load credit cards')
			setCards([])
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
	const totalDebt = cardsList.reduce(
		(sum, card) => sum + (card.balances || []).reduce((s, b) => s + Math.max(0, -b.current_balance), 0),
		0
	)
	const totalLimit = cardsList.reduce(
		(sum, card) => sum + (card.balances || []).reduce((s, b) => s + b.credit_limit, 0),
		0
	)
	const avgUtilization = totalLimit > 0 ? (totalDebt / totalLimit) * 100 : 0

	if (loading) {
		return (
			<div className="container mx-auto p-6 space-y-6">
				<Skeleton className="h-8 w-48" />
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<Skeleton className="h-24" />
					<Skeleton className="h-24" />
					<Skeleton className="h-24" />
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

			<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">Total Cards</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-2">
							<CardIcon className="h-5 w-5 text-primary" />
							<span className="text-2xl font-bold">{cardsList.length}</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">Total Debt</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-2">
							<span className="text-2xl font-bold text-destructive">
								{totalDebt.toLocaleString('es-DO', { style: 'currency', currency: 'DOP' })}
							</span>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">Avg Utilization</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-2">
							<span className="text-2xl font-bold">{avgUtilization.toFixed(1)}%</span>
							{avgUtilization > 60 && <AlertCircle className="h-5 w-5 text-orange-500" />}
						</div>
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
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
