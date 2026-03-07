'use client'

import { useState } from 'react'
import { CreditCard, CardBalance } from '@/types/creditcard'
import { formatCurrency, getUtilizationColor } from '@/types/creditcard'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DollarSign, MoreVertical, ArrowLeftRight } from 'lucide-react'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CreditCardAtroposVisual } from '@/components/creditcards/CreditCardAtroposVisual'

interface CreditCardItemProps {
	card: CreditCard
	onEdit: (card: CreditCard) => void
	onDelete: (card: CreditCard) => void
	onPay: (card: CreditCard) => void
	onViewPayments: (card: CreditCard) => void
}

export function CreditCardItem({ card, onEdit, onDelete, onPay, onViewPayments }: CreditCardItemProps) {
	const [isFlipped, setIsFlipped] = useState(false)

	const totalDebtByCurrency = card.balances
		.map((balance) => ({
			currency: balance.currency,
			debt: Math.max(0, -balance.current_balance),
		}))
		.filter((item) => item.debt > 0)

	return (
		<div className='h-full' data-testid={`credit-card-item-${card.id}`}>
			<div className='relative h-[320px]' style={{ perspective: '1200px' }}>
				<div
					className='relative h-full w-full transition-transform duration-500'
					style={{
						transformStyle: 'preserve-3d',
						transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
					}}
				>
					<div
						className={isFlipped ? 'pointer-events-none absolute inset-0' : 'pointer-events-auto absolute inset-0'}
						style={{ backfaceVisibility: 'hidden' }}
					>
						<CreditCardAtroposVisual
							card={card}
							totalDebtByCurrency={totalDebtByCurrency}
							onFlip={() => setIsFlipped(true)}
						/>
					</div>

					<div
						className={isFlipped ? 'pointer-events-auto absolute inset-0' : 'pointer-events-none absolute inset-0'}
						style={{
							backfaceVisibility: 'hidden',
							transform: 'rotateY(180deg)',
						}}
					>
						<div className='relative flex h-full flex-col space-y-3 overflow-hidden rounded-xl border border-border/70 bg-card p-4 text-card-foreground'>
							<div className='pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent' />
							<div className='flex items-center justify-between'>
								<div className='relative'>
									<p className='text-sm font-semibold'>{card.name}</p>
									<p className='text-xs text-muted-foreground'>{card.bank} •••• {card.last_four_digits || '****'}</p>
								</div>
								<div className='relative flex items-center gap-1' onClick={(event) => event.stopPropagation()}>
									<Button
										variant='ghost'
										size='sm'
										onClick={() => setIsFlipped(false)}
										className='gap-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground'
									>
										<ArrowLeftRight className='h-3.5 w-3.5' />
										Back
									</Button>
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button variant='ghost' size='icon' aria-label='Card options' className='text-muted-foreground hover:bg-accent hover:text-accent-foreground'>
												<MoreVertical className='h-4 w-4' />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align='end'>
											<DropdownMenuItem onClick={() => onEdit(card)}>Edit</DropdownMenuItem>
											<DropdownMenuItem onClick={() => onDelete(card)} className='text-destructive'>
												Delete
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</div>
							</div>

							<div className='relative space-y-4 rounded-xl border border-border/60 bg-muted/20 p-3' onClick={(event) => event.stopPropagation()}>
								{card.balances.map((balance) => (
									<BalanceBar key={balance.id} balance={balance} />
								))}
							</div>

							<div className='relative space-y-2 pt-1' onClick={(event) => event.stopPropagation()}>
								<Button variant='secondary' className='w-full' onClick={() => onPay(card)}>
									<DollarSign className='mr-2 h-4 w-4' />
									Pay Card
								</Button>
								<Button
									variant='ghost'
									className='w-full justify-center border border-border/60 text-foreground hover:bg-accent'
									onClick={() => onViewPayments(card)}
								>
									View Payments
								</Button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
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
