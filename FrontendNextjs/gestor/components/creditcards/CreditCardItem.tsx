'use client'

import { ArrowLeftRight, DollarSign, MoreHorizontal, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { CreditCardAtroposVisual } from '@/components/creditcards/CreditCardAtroposVisual'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getProgressTone, Progress, type ProgressTone } from '@/components/ui/progress'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useFormatPercent } from '@/hooks/useFormatPercent'
import { cn } from '@/lib/utils'
import { CardBalance, CreditCard } from '@/types/creditcard'

/** Same thresholds as the page's credit-health KPI: watch above 30%, high risk above 60%. */
const UTILIZATION_THRESHOLDS = { warningAt: 30, dangerAt: 60 }

const UTILIZATION_TEXT_CLASS: Record<ProgressTone, string> = {
	default: 'text-muted-foreground',
	success: 'text-success',
	warning: 'text-warning',
	destructive: 'text-destructive',
	info: 'text-info',
}

interface CreditCardItemProps {
	card: CreditCard
	onEdit: (card: CreditCard) => void
	onDelete: (card: CreditCard) => void
	onPay: (card: CreditCard) => void
	onViewPayments: (card: CreditCard) => void
	onReset: (card: CreditCard) => void
}

export function CreditCardItem({ card, onEdit, onDelete, onPay, onViewPayments, onReset }: CreditCardItemProps) {
	const t = useTranslations('creditCards.item')
	const tCommon = useTranslations('common')
	const [isFlipped, setIsFlipped] = useState(false)
	const flipButtonRef = useRef<HTMLButtonElement>(null)
	const backButtonRef = useRef<HTMLButtonElement>(null)
	// Only move focus after a user-initiated flip, never on mount.
	const moveFocusRef = useRef(false)

	useEffect(() => {
		if (!moveFocusRef.current) return
		moveFocusRef.current = false
		// The face that was just hidden becomes inert, so hand focus to the matching control on the other side.
		;(isFlipped ? backButtonRef : flipButtonRef).current?.focus({ preventScroll: true })
	}, [isFlipped])

	const flip = (next: boolean) => {
		if (next === isFlipped) return
		moveFocusRef.current = true
		setIsFlipped(next)
	}

	const totalDebtByCurrency = card.balances
		.map((balance) => ({
			currency: balance.currency,
			debt: Math.max(0, -balance.current_balance),
		}))
		.filter((item) => item.debt > 0)

	return (
		<div className='h-full' data-testid={`credit-card-item-${card.id}`}>
			{/* Both faces share one grid cell, so the taller face sets the height instead of a fixed box. */}
			<div className='h-full' style={{ perspective: '1200px' }}>
				<div
					className='grid h-full transition-transform duration-500 motion-reduce:transition-none'
					data-flipped={isFlipped}
					style={{
						transformStyle: 'preserve-3d',
						transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
					}}
				>
					<div
						className={cn('[grid-area:1/1]', isFlipped ? 'pointer-events-none' : 'pointer-events-auto')}
						style={{ backfaceVisibility: 'hidden' }}
						inert={isFlipped}
						data-face='front'
					>
						<CreditCardAtroposVisual
							card={card}
							totalDebtByCurrency={totalDebtByCurrency}
							onFlip={() => flip(true)}
							flipButtonRef={flipButtonRef}
						/>
					</div>

					<div
						className={cn('[grid-area:1/1]', isFlipped ? 'pointer-events-auto' : 'pointer-events-none')}
						style={{
							backfaceVisibility: 'hidden',
							transform: 'rotateY(180deg)',
						}}
						inert={!isFlipped}
						data-face='back'
					>
						<div className='relative flex h-full flex-col gap-3 rounded-lg border bg-card p-4 text-card-foreground shadow-sm'>
							<div className='flex items-center justify-between'>
								<div className='relative min-w-0'>
									<p className='truncate text-sm font-semibold'>{card.name}</p>
									<p className='text-xs text-muted-foreground'>
										{card.bank} •••• {card.last_four_digits || '****'}
									</p>
								</div>
								<div className='relative flex items-center gap-1'>
									<Button
										variant='ghost'
										size='sm'
										ref={backButtonRef}
										onClick={() => flip(false)}
										className='gap-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground'
									>
										<ArrowLeftRight className='h-3.5 w-3.5' aria-hidden='true' />
										{t('back')}
									</Button>
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												variant='ghost'
												size='icon'
												aria-label={tCommon('actions.rowMenu', { name: card.name })}
												className='text-muted-foreground hover:bg-accent hover:text-accent-foreground'
											>
												<MoreHorizontal className='h-4 w-4' aria-hidden='true' />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align='end'>
											<DropdownMenuItem onSelect={() => onEdit(card)}>
												<Pencil className='mr-2 h-4 w-4' aria-hidden='true' />
												{t('edit')}
											</DropdownMenuItem>
											<DropdownMenuItem onSelect={() => onReset(card)}>
												<RotateCcw className='mr-2 h-4 w-4' aria-hidden='true' />
												{t('resetBalance')}
											</DropdownMenuItem>
											<DropdownMenuSeparator />
											<DropdownMenuItem
												onSelect={() => onDelete(card)}
												className='text-destructive focus:text-destructive'
											>
												<Trash2 className='mr-2 h-4 w-4' aria-hidden='true' />
												{t('delete')}
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</div>
							</div>

							<div className='relative space-y-4 rounded-md bg-muted/40 p-3'>
								{card.balances.map((balance) => (
									<BalanceBar key={balance.id} balance={balance} />
								))}
							</div>

							<div className='relative mt-auto grid grid-cols-2 gap-2'>
								<Button variant='secondary' className='w-full' onClick={() => onPay(card)}>
									<DollarSign className='mr-2 h-4 w-4' aria-hidden='true' />
									{t('payCard')}
								</Button>
								<Button variant='outline' className='w-full' onClick={() => onViewPayments(card)}>
									{t('viewPayments')}
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
	const t = useTranslations('creditCards.item')
	const formatCurrency = useFormatCurrency()
	const formatPercent = useFormatPercent()
	const utilization = balance.utilization_percent
	const debt = Math.max(0, -balance.current_balance)
	const tone = getProgressTone(utilization, UTILIZATION_THRESHOLDS)

	return (
		<div className='space-y-2'>
			<div className='flex items-center justify-between'>
				<Badge variant='outline'>{balance.currency}</Badge>
				<span className={cn('text-sm font-medium tabular-nums', UTILIZATION_TEXT_CLASS[tone])}>
					{t('used', { percent: formatPercent(utilization) })}
				</span>
			</div>
			<Progress value={utilization} tone={tone} aria-label={t('utilizationLabel', { currency: balance.currency })} />
			<div className='flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm text-muted-foreground tabular-nums'>
				<span>{t('debt', { amount: formatCurrency(debt, balance.currency) })}</span>
				<span>{t('available', { amount: formatCurrency(balance.available_credit, balance.currency) })}</span>
			</div>
		</div>
	)
}
