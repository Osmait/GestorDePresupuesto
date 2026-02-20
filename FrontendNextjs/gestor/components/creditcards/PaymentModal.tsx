'use client'

import { useState, useEffect } from 'react'
import { CreditCard, CreatePaymentDTO } from '@/types/creditcard'
import { Account } from '@/types/account'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { accountRepository } from '@/lib/repositoryConfig'

interface PaymentModalProps {
	open: boolean
	onClose: () => void
	onSubmit: (data: CreatePaymentDTO) => Promise<void>
	card: CreditCard | null
}

export function PaymentModal({ open, onClose, onSubmit, card }: PaymentModalProps) {
	const [loading, setLoading] = useState(false)
	const [accounts, setAccounts] = useState<Account[]>([])
	const [fromAccountId, setFromAccountId] = useState('')
	const [currency, setCurrency] = useState(card?.balances[0]?.currency || 'DOP')
	const [amount, setAmount] = useState('')
	const [includesInterest, setIncludesInterest] = useState(false)
	const [interestAmount, setInterestAmount] = useState('')
	const [notes, setNotes] = useState('')

	useEffect(() => {
		if (open) {
			loadAccounts()
			if (card?.balances[0]) {
				setCurrency(card.balances[0].currency)
				setAmount(Math.abs(card.balances[0].current_balance).toString())
			}
		}
	}, [open, card])

	const loadAccounts = async () => {
		try {
			const data = await accountRepository.findAll()
			setAccounts(data.filter((a: Account) => a.type === 'bank'))
		} catch (error) {
			console.error('Error loading accounts:', error)
		}
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (!card) return

		setLoading(true)
		try {
			await onSubmit({
				from_account_id: fromAccountId,
				currency,
				amount: parseFloat(amount),
				includes_interest: includesInterest,
				interest_amount: includesInterest ? parseFloat(interestAmount) || 0 : 0,
				notes: notes || undefined,
			})
			onClose()
			resetForm()
		} catch (error) {
			console.error('Error making payment:', error)
		} finally {
			setLoading(false)
		}
	}

	const resetForm = () => {
		setFromAccountId('')
		setAmount('')
		setIncludesInterest(false)
		setInterestAmount('')
		setNotes('')
	}

	const selectedBalance = card?.balances.find((b) => b.currency === currency)
	const currentDebt = selectedBalance ? Math.abs(selectedBalance.current_balance) : 0

	return (
		<Dialog open={open} onOpenChange={onClose}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Pay Credit Card</DialogTitle>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label>Pay From Account</Label>
						<Select value={fromAccountId} onValueChange={setFromAccountId} required>
							<SelectTrigger>
								<SelectValue placeholder="Select account" />
							</SelectTrigger>
							<SelectContent>
								{accounts.map((account) => (
									<SelectItem key={account.id} value={account.id}>
										{account.name} ({account.bank})
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label>Currency</Label>
						<Select value={currency} onValueChange={setCurrency}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{card?.balances.map((b) => (
									<SelectItem key={b.currency} value={b.currency}>
										{b.currency} (Debt: {Math.abs(b.current_balance).toLocaleString()})
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-2">
						<Label htmlFor="amount">Amount to Pay</Label>
						<Input
							id="amount"
							type="number"
							step="0.01"
							value={amount}
							onChange={(e) => setAmount(e.target.value)}
							placeholder={currentDebt.toString()}
							required
						/>
						<p className="text-xs text-muted-foreground">
							Current debt: {currentDebt.toLocaleString()} {currency}
						</p>
					</div>

					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<Label htmlFor="interest">Includes Interest</Label>
							<Switch
								id="interest"
								checked={includesInterest}
								onCheckedChange={setIncludesInterest}
							/>
						</div>
						{includesInterest && (
							<Input
								type="number"
								step="0.01"
								value={interestAmount}
								onChange={(e) => setInterestAmount(e.target.value)}
								placeholder="Interest amount"
							/>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="notes">Notes (Optional)</Label>
						<Input
							id="notes"
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							placeholder="Payment notes"
						/>
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={onClose}>
							Cancel
						</Button>
						<Button type="submit" disabled={loading || !fromAccountId}>
							{loading ? 'Processing...' : 'Make Payment'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
