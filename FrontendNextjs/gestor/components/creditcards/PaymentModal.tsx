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
import { useExchangeRateQuery } from '@/hooks/queries/useExchangeRateQuery'

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
	const [exchangeRate, setExchangeRate] = useState('')
	const { data: rateData } = useExchangeRateQuery()

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
		const paymentAmount = parseFloat(amount)
		if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
			return
		}
		if (paymentAmount > currentDebt) {
			return
		}
		const parsedRate = parseFloat(exchangeRate)

		setLoading(true)
		try {
			await onSubmit({
				from_account_id: fromAccountId,
				currency,
				amount: paymentAmount,
				exchange_rate: needsExchangeRate ? parsedRate : undefined,
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
		setExchangeRate('')
	}

	const selectedBalance = card?.balances.find((b) => b.currency === currency)
	const currentDebt = selectedBalance ? Math.max(0, -selectedBalance.current_balance) : 0
	const selectedAccount = accounts.find((a) => a.id === fromAccountId)
	const sourceCurrency = selectedAccount?.currency || 'DOP'
	const needsExchangeRate = sourceCurrency !== currency
	const recommendedRate = needsExchangeRate && currency === 'USD' && sourceCurrency === 'DOP' ? rateData?.usd_to_dop : undefined

	useEffect(() => {
		if (!needsExchangeRate) {
			setExchangeRate('')
			return
		}
		if (recommendedRate && !exchangeRate) {
			setExchangeRate(recommendedRate.toFixed(4))
		}
	}, [needsExchangeRate, recommendedRate, exchangeRate])

	const parsedRate = parseFloat(exchangeRate)
	const exchangeRateValid = !needsExchangeRate || (Number.isFinite(parsedRate) && parsedRate > 0)
	const debitPreview = (() => {
		const paymentAmount = parseFloat(amount)
		if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) return 0
		if (!needsExchangeRate) return paymentAmount
		if (!exchangeRateValid) return 0
		if (currency === 'USD' && sourceCurrency === 'DOP') return paymentAmount * parsedRate
		if (currency === 'DOP' && sourceCurrency === 'USD') return paymentAmount / parsedRate
		return 0
	})()

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
										{account.name} ({account.bank}) - {account.currency || 'DOP'}
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
										{b.currency} (Debt: {Math.max(0, -b.current_balance).toLocaleString()})
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
							max={currentDebt > 0 ? currentDebt : undefined}
							value={amount}
							onChange={(e) => setAmount(e.target.value)}
							placeholder={currentDebt.toString()}
							required
						/>
						<p className="text-xs text-muted-foreground">
							Current debt: {currentDebt.toLocaleString()} {currency}
						</p>
						{parseFloat(amount) > currentDebt && currentDebt > 0 ? (
							<p className="text-xs text-destructive">
								Payment amount cannot exceed current debt.
							</p>
						) : null}
					</div>

					{needsExchangeRate && (
						<div className="space-y-2 rounded-md border p-3">
							<Label htmlFor="exchangeRate">Exchange Rate ({currency} to {sourceCurrency})</Label>
							<Input
								id="exchangeRate"
								type="number"
								step="0.0001"
								value={exchangeRate}
								onChange={(e) => setExchangeRate(e.target.value)}
								placeholder={recommendedRate ? recommendedRate.toFixed(4) : 'Enter rate'}
								required
							/>
							{recommendedRate ? (
								<p className="text-xs text-muted-foreground">
									Recommended rate from API: {recommendedRate.toFixed(4)}
								</p>
							) : (
								<p className="text-xs text-muted-foreground">
									Could not fetch recommended rate. Enter custom rate.
								</p>
							)}
							<p className="text-xs text-muted-foreground">
								Estimated debit from account: {debitPreview.toLocaleString(undefined, { maximumFractionDigits: 2 })} {sourceCurrency}
							</p>
						</div>
					)}

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
						<Button type="submit" disabled={loading || !fromAccountId || !exchangeRateValid || parseFloat(amount) > currentDebt}>
							{loading ? 'Processing...' : 'Make Payment'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
