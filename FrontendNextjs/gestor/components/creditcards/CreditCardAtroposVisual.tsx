'use client'

import { useEffect, useState } from 'react'
import Atropos from 'atropos/react'
import 'atropos/css'
import { CreditCard } from '@/types/creditcard'
import { formatCurrency } from '@/types/creditcard'
import { Button } from '@/components/ui/button'
import { ArrowLeftRight, CreditCard as CardIcon } from 'lucide-react'

interface CreditCardAtroposVisualProps {
	card: CreditCard
	totalDebtByCurrency: Array<{ currency: string; debt: number }>
	onFlip: () => void
}

export function CreditCardAtroposVisual({ card, totalDebtByCurrency, onFlip }: CreditCardAtroposVisualProps) {
	const [motionEnabled, setMotionEnabled] = useState(false)

	useEffect(() => {
		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
		const hoverCapable = window.matchMedia('(hover: hover)').matches
		const desktopScreen = window.matchMedia('(min-width: 1024px)').matches
		setMotionEnabled(!reducedMotion && hoverCapable && desktopScreen)
	}, [])

	const visualContent = (
		<div className='relative cursor-pointer overflow-hidden rounded-xl border border-border/70 bg-card p-4 text-card-foreground' onClick={onFlip}>
			<div className='pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent' />
			<div className='relative space-y-4'>
				<div className='flex items-center justify-between'>
					<div className='flex items-center gap-2'>
						<div className='rounded-md border border-border/60 bg-muted/30 p-1.5'>
							<CardIcon className='h-3.5 w-3.5 text-muted-foreground' />
						</div>
						{card.balances.map((balance) => (
							<span key={balance.id} className='rounded-full border border-border/60 bg-muted/20 px-2 py-0.5 text-[10px] font-medium text-muted-foreground'>
								{balance.currency}
							</span>
						))}
					</div>
					<Button
						variant='ghost'
						size='sm'
						type='button'
						onPointerDown={(event) => event.stopPropagation()}
						onClick={(event) => {
							event.stopPropagation()
							onFlip()
						}}
						className='h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:bg-accent hover:text-accent-foreground'
					>
						<ArrowLeftRight className='h-3 w-3' />
						View details
					</Button>
				</div>

				<div className='flex items-start justify-between'>
					<div data-atropos-offset='2'>
						<p className='text-[11px] uppercase tracking-[0.18em] text-muted-foreground'>
							{card.bank}
						</p>
						<p className='text-base font-semibold leading-tight text-card-foreground'>
							{card.name}
						</p>
					</div>
					<p className='rounded-md border border-border/60 bg-muted/25 px-2 py-1 text-xs font-medium text-muted-foreground' data-atropos-offset='4'>
						•••• {card.last_four_digits || '****'}
					</p>
				</div>

				<div className='space-y-1.5' data-atropos-offset='6'>
					<p className='text-[11px] text-muted-foreground'>Outstanding</p>
					{totalDebtByCurrency.length > 0 ? (
						totalDebtByCurrency.map((item) => (
							<div key={item.currency} className='flex items-center justify-between'>
								<span className='text-xs text-muted-foreground'>{item.currency}</span>
								<span className='text-sm font-semibold text-card-foreground'>{formatCurrency(item.debt, item.currency)}</span>
							</div>
						))
					) : (
						<div className='flex items-center justify-between'>
							<span className='text-xs text-muted-foreground'>Status</span>
							<span className='text-sm font-semibold text-success'>No debt</span>
						</div>
					)}
				</div>

				<div className='grid grid-cols-2 gap-3 rounded-lg border border-border/60 bg-muted/20 p-2 text-xs' data-atropos-offset='4'>
					<div>
						<p className='text-muted-foreground'>Cut Day</p>
						<p className='font-semibold text-card-foreground'>{card.cut_day}</p>
					</div>
					<div>
						<p className='text-muted-foreground'>Due Day</p>
						<p className='font-semibold text-card-foreground'>{card.due_day}</p>
					</div>
				</div>
			</div>
		</div>
	)

	if (!motionEnabled) {
		return <div className='w-full'>{visualContent}</div>
	}

	return (
		<Atropos
			onClick={onFlip}
			activeOffset={16}
			shadowScale={0.98}
			rotateXMax={5}
			rotateYMax={6}
			duration={220}
			highlight={false}
			className='w-full'
		>
			{visualContent}
		</Atropos>
	)
}
