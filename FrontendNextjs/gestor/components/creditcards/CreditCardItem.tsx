'use client'

import { CreditCard, CardBalance } from '@/types/creditcard'
import { formatCurrency, getUtilizationColor } from '@/types/creditcard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CreditCard as CardIcon, Calendar, DollarSign, MoreVertical } from 'lucide-react'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface CreditCardItemProps {
	card: CreditCard
	onEdit: (card: CreditCard) => void
	onDelete: (card: CreditCard) => void
	onPay: (card: CreditCard) => void
	onViewPayments: (card: CreditCard) => void
}

export function CreditCardItem({ card, onEdit, onDelete, onPay, onViewPayments }: CreditCardItemProps) {
	const totalDebtByCurrency = card.balances
		.map((balance) => ({
			currency: balance.currency,
			debt: Math.max(0, -balance.current_balance),
		}))
		.filter((item) => item.debt > 0)

	return (
		<Card className="overflow-hidden">
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<div className="p-2 bg-primary/10 rounded-lg">
							<CardIcon className="h-5 w-5 text-primary" />
						</div>
						<div>
							<CardTitle className="text-lg">{card.name}</CardTitle>
							<p className="text-sm text-muted-foreground">
								{card.bank} •••• {card.last_four_digits || '****'}
							</p>
						</div>
					</div>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon">
								<MoreVertical className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={() => onEdit(card)}>Edit</DropdownMenuItem>
							<DropdownMenuItem onClick={() => onPay(card)}>Make Payment</DropdownMenuItem>
							<DropdownMenuItem onClick={() => onViewPayments(card)}>View Payments</DropdownMenuItem>
							<DropdownMenuItem onClick={() => onDelete(card)} className="text-destructive">
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				{card.balances.map((balance) => (
					<BalanceBar key={balance.id} balance={balance} />
				))}

				<div className="grid grid-cols-2 gap-4 pt-2 border-t">
					<div className="flex items-center gap-2">
						<Calendar className="h-4 w-4 text-muted-foreground" />
						<div>
							<p className="text-xs text-muted-foreground">Cut Day</p>
							<p className="text-sm font-medium">{card.cut_day}</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						<DollarSign className="h-4 w-4 text-muted-foreground" />
						<div>
							<p className="text-xs text-muted-foreground">Due Day</p>
							<p className="text-sm font-medium">{card.due_day}</p>
						</div>
					</div>
				</div>

				{card.next_due_date && (
					<div className="pt-2 border-t space-y-1">
						<span className="text-sm text-muted-foreground">Total Debt</span>
						{totalDebtByCurrency.length > 0 ? (
							totalDebtByCurrency.map((item) => (
								<div key={item.currency} className="flex items-center justify-between">
									<span className="text-xs text-muted-foreground">{item.currency}</span>
									<span className="text-base font-bold text-destructive">
										{formatCurrency(item.debt, item.currency)}
									</span>
								</div>
							))
						) : (
							<div className="flex items-center justify-between">
								<span className="text-xs text-muted-foreground">No debt</span>
								<span className="text-base font-bold">0</span>
							</div>
						)}
					</div>
				)}

				<Button className="w-full" onClick={() => onPay(card)}>
					<DollarSign className="h-4 w-4 mr-2" />
					Pay Card
				</Button>
				<Button variant="outline" className="w-full" onClick={() => onViewPayments(card)}>
					View Payments
				</Button>
			</CardContent>
		</Card>
	)
}

function BalanceBar({ balance }: { balance: CardBalance }) {
	const utilization = balance.utilization_percent
	const debt = Math.max(0, -balance.current_balance)

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<Badge variant="outline">{balance.currency}</Badge>
				<span className={`text-sm font-medium ${getUtilizationColor(utilization)}`}>
					{utilization.toFixed(1)}% used
				</span>
			</div>
			<div className="space-y-1">
				<Progress value={utilization} className="h-2" />
			</div>
			<div className="flex items-center justify-between text-sm">
				<span className="text-muted-foreground">Debt: {formatCurrency(debt, balance.currency)}</span>
				<span className="text-muted-foreground">Available: {formatCurrency(balance.available_credit, balance.currency)}</span>
			</div>
		</div>
	)
}
