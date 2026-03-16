'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
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
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'

interface CreditCardFormModalProps {
	open: boolean
	onClose: () => void
	onSubmit: (data: CreateCreditCardDTO) => Promise<void>
	card?: CreditCard | null
}

const CURRENCIES = ['DOP', 'USD', 'EUR']

const creditCardSchema = z.object({
	name: z.string().min(1, 'Card name is required'),
	bank: z.string().min(1, 'Bank is required'),
	lastFourDigits: z.string().max(4).regex(/^\d{0,4}$/, 'Only digits allowed').optional().default(''),
	cutDay: z.coerce.number().min(1, 'Min 1').max(28, 'Max 28'),
	dueDay: z.coerce.number().min(1, 'Min 1').max(28, 'Max 28'),
})

type CreditCardFormValues = z.infer<typeof creditCardSchema>

export function CreditCardFormModal({ open, onClose, onSubmit, card }: CreditCardFormModalProps) {
	const [loading, setLoading] = useState(false)
	const [balances, setBalances] = useState<CreateBalanceDTO[]>(
		card?.balances?.map((b) => ({
			currency: b.currency,
			credit_limit: b.credit_limit,
			initial_debt: Math.abs(b.current_balance),
		})) || [{ currency: 'DOP', credit_limit: 100000, initial_debt: 0 }]
	)

	const form = useForm<CreditCardFormValues>({
		resolver: zodResolver(creditCardSchema),
		defaultValues: {
			name: card?.name || '',
			bank: card?.bank || '',
			lastFourDigits: card?.last_four_digits || '',
			cutDay: card?.cut_day || 20,
			dueDay: card?.due_day || 10,
		},
	})

	const handleFormSubmit = async (values: CreditCardFormValues) => {
		setLoading(true)
		try {
			await onSubmit({
				name: values.name,
				bank: values.bank,
				last_four_digits: values.lastFourDigits || undefined,
				cut_day: values.cutDay,
				due_day: values.dueDay,
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
				<Form {...form}>
					<form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Card Name</FormLabel>
									<FormControl>
										<Input {...field} placeholder="My Credit Card" />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<div className="grid grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="bank"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Bank</FormLabel>
										<FormControl>
											<Input {...field} placeholder="Banco Popular" />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="lastFourDigits"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Last 4 Digits</FormLabel>
										<FormControl>
											<Input
												{...field}
												onChange={(e) => field.onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
												placeholder="1234"
												maxLength={4}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<FormField
								control={form.control}
								name="cutDay"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Cut Day (1-28)</FormLabel>
										<FormControl>
											<Input type="number" min={1} max={28} {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="dueDay"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Due Day (1-28)</FormLabel>
										<FormControl>
											<Input type="number" min={1} max={28} {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
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
								{loading ? 'Saving…' : card ? 'Update' : 'Create'}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	)
}
