'use client'

import { useState } from 'react'
import { CreditCard, CreateCreditCardDTO, CreateBalanceDTO } from '@/types/creditcard'
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
import { Plus, Trash2 } from 'lucide-react'

interface CreditCardFormModalProps {
	open: boolean
	onClose: () => void
	onSubmit: (data: CreateCreditCardDTO) => Promise<void>
	card?: CreditCard | null
}

const CURRENCIES = ['DOP', 'USD', 'EUR']

export function CreditCardFormModal({ open, onClose, onSubmit, card }: CreditCardFormModalProps) {
	const [loading, setLoading] = useState(false)
	const [name, setName] = useState(card?.name || '')
	const [bank, setBank] = useState(card?.bank || '')
	const [lastFourDigits, setLastFourDigits] = useState(card?.last_four_digits || '')
	const [cutDay, setCutDay] = useState(card?.cut_day?.toString() || '20')
	const [dueDay, setDueDay] = useState(card?.due_day?.toString() || '10')
	const [balances, setBalances] = useState<CreateBalanceDTO[]>(
		card?.balances?.map((b) => ({
			currency: b.currency,
			credit_limit: b.credit_limit,
			initial_debt: Math.abs(b.current_balance),
		})) || [{ currency: 'DOP', credit_limit: 100000, initial_debt: 0 }]
	)

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setLoading(true)
		try {
			await onSubmit({
				name,
				bank,
				last_four_digits: lastFourDigits || undefined,
				cut_day: parseInt(cutDay),
				due_day: parseInt(dueDay),
				balances,
			})
			onClose()
		} catch (error) {
			console.error('Error saving card:', error)
		} finally {
			setLoading(false)
		}
	}

	const addBalance = () => {
		setBalances([...balances, { currency: 'DOP', credit_limit: 100000, initial_debt: 0 }])
	}

	const removeBalance = (index: number) => {
		setBalances(balances.filter((_, i) => i !== index))
	}

	const updateBalance = (index: number, field: keyof CreateBalanceDTO, value: string | number) => {
		const newBalances = [...balances]
		newBalances[index] = { ...newBalances[index], [field]: value }
		setBalances(newBalances)
	}

	return (
		<Dialog open={open} onOpenChange={onClose}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>{card ? 'Edit Credit Card' : 'Add Credit Card'}</DialogTitle>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="name">Card Name</Label>
						<Input
							id="name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="My Credit Card"
							required
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="bank">Bank</Label>
							<Input
								id="bank"
								value={bank}
								onChange={(e) => setBank(e.target.value)}
								placeholder="Banco Popular"
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="lastFourDigits">Last 4 Digits</Label>
							<Input
								id="lastFourDigits"
								value={lastFourDigits}
								onChange={(e) => setLastFourDigits(e.target.value.replace(/\D/g, '').slice(0, 4))}
								placeholder="1234"
								maxLength={4}
							/>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-2">
							<Label htmlFor="cutDay">Cut Day (1-28)</Label>
							<Input
								id="cutDay"
								type="number"
								min={1}
								max={28}
								value={cutDay}
								onChange={(e) => setCutDay(e.target.value)}
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="dueDay">Due Day (1-28)</Label>
							<Input
								id="dueDay"
								type="number"
								min={1}
								max={28}
								value={dueDay}
								onChange={(e) => setDueDay(e.target.value)}
								required
							/>
						</div>
					</div>

					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<Label>Balances</Label>
							<Button type="button" variant="outline" size="sm" onClick={addBalance}>
								<Plus className="h-4 w-4 mr-1" />
								Add Currency
							</Button>
						</div>
						{balances.map((balance, index) => (
							<div key={index} className="p-3 border rounded-lg space-y-2">
								<div className="flex items-center justify-between">
									<Select
										value={balance.currency}
										onValueChange={(v) => updateBalance(index, 'currency', v)}
									>
										<SelectTrigger className="w-24">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{CURRENCIES.map((c) => (
												<SelectItem key={c} value={c}>
													{c}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									{balances.length > 1 && (
										<Button
											type="button"
											variant="ghost"
											size="icon"
											onClick={() => removeBalance(index)}
										>
											<Trash2 className="h-4 w-4 text-destructive" />
										</Button>
									)}
								</div>
								<div className="grid grid-cols-2 gap-2">
									<div>
										<Label className="text-xs">Credit Limit</Label>
										<Input
											type="number"
											value={balance.credit_limit}
											onChange={(e) => updateBalance(index, 'credit_limit', parseFloat(e.target.value))}
											required
										/>
									</div>
									<div>
										<Label className="text-xs">Initial Debt</Label>
										<Input
											type="number"
											value={balance.initial_debt}
											onChange={(e) => updateBalance(index, 'initial_debt', parseFloat(e.target.value))}
										/>
									</div>
								</div>
							</div>
						))}
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={onClose}>
							Cancel
						</Button>
						<Button type="submit" disabled={loading}>
							{loading ? 'Saving...' : card ? 'Update' : 'Create'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
