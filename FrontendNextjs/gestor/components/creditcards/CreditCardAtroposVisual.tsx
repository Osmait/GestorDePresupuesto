'use client'

import { ArrowLeftRight, CreditCard as CardIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { lazy, type Ref, Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { CreditCard } from '@/types/creditcard'

// Atropos (JS + CSS) is only fetched where the tilt runs.
const CreditCardTilt = lazy(() => import('./CreditCardTilt'))

/** Desktop pointers that hover, on a large screen, without reduced motion. */
const TILT_QUERY =
	'(hover: hover) and (pointer: fine) and (min-width: 1024px) and (prefers-reduced-motion: no-preference)'

interface CreditCardAtroposVisualProps {
	card: CreditCard
	totalDebtByCurrency: Array<{ currency: string; debt: number }>
	onFlip: () => void
	flipButtonRef?: Ref<HTMLButtonElement>
}

export function CreditCardAtroposVisual({
	card,
	totalDebtByCurrency,
	onFlip,
	flipButtonRef,
}: CreditCardAtroposVisualProps) {
	const t = useTranslations('creditCards.item')
	const formatCurrency = useFormatCurrency()
	const motionEnabled = useMediaQuery(TILT_QUERY)

	const visualContent = (
		<div className='relative h-full cursor-pointer overflow-hidden rounded-lg border bg-card p-4 text-card-foreground shadow-sm'>
			<div className='flex h-full flex-col gap-4'>
				<div className='flex items-center justify-between'>
					<div className='flex min-w-0 flex-wrap items-center gap-2'>
						<div className='rounded-md border border-border/60 bg-muted/30 p-1.5'>
							<CardIcon className='h-3.5 w-3.5 text-muted-foreground' aria-hidden='true' />
						</div>
						{card.balances.map((balance) => (
							<span
								key={balance.id}
								className='rounded-full border border-border/60 bg-muted/20 px-2 py-0.5 text-xs font-medium text-muted-foreground'
							>
								{balance.currency}
							</span>
						))}
					</div>
					<Button
						variant='ghost'
						size='sm'
						type='button'
						ref={flipButtonRef}
						onPointerDown={(event) => event.stopPropagation()}
						onClick={(event) => {
							event.stopPropagation()
							onFlip()
						}}
						// The pseudo-element stretches the button's hit area over the whole card,
						// so a click anywhere flips it while keyboard users get a real button.
						className='h-8 gap-1 px-2 text-xs text-muted-foreground after:absolute after:inset-0 hover:bg-accent hover:text-accent-foreground'
					>
						<ArrowLeftRight className='h-3 w-3' aria-hidden='true' />
						{t('viewDetails')}
					</Button>
				</div>

				<div className='flex items-start justify-between'>
					<div data-atropos-offset='2'>
						<p className='text-xs uppercase tracking-wider text-muted-foreground'>{card.bank}</p>
						<p className='text-base font-semibold leading-tight text-card-foreground'>{card.name}</p>
					</div>
					<p
						className='rounded-md border border-border/60 bg-muted/25 px-2 py-1 text-xs font-medium text-muted-foreground'
						data-atropos-offset='4'
					>
						•••• {card.last_four_digits || '****'}
					</p>
				</div>

				<div className='space-y-1.5' data-atropos-offset='6'>
					<p className='text-xs text-muted-foreground'>{t('outstanding')}</p>
					{totalDebtByCurrency.length > 0 ? (
						totalDebtByCurrency.map((item) => (
							<div key={item.currency} className='flex items-center justify-between'>
								<span className='text-xs text-muted-foreground'>{item.currency}</span>
								<span className='text-sm font-semibold tabular-nums text-card-foreground'>
									{formatCurrency(item.debt, item.currency)}
								</span>
							</div>
						))
					) : (
						<div className='flex items-center justify-between'>
							<span className='text-xs text-muted-foreground'>{t('status')}</span>
							<span className='text-sm font-semibold text-success'>{t('noDebt')}</span>
						</div>
					)}
				</div>

				<div
					className='mt-auto grid grid-cols-2 gap-3 rounded-lg border border-border/60 bg-muted/20 p-2 text-xs'
					data-atropos-offset='4'
				>
					<div>
						<p className='text-muted-foreground'>{t('cutDay')}</p>
						<p className='font-semibold text-card-foreground'>{card.cut_day}</p>
					</div>
					<div>
						<p className='text-muted-foreground'>{t('dueDay')}</p>
						<p className='font-semibold text-card-foreground'>{card.due_day}</p>
					</div>
				</div>
			</div>
		</div>
	)

	const plain = <div className='h-full w-full'>{visualContent}</div>

	if (!motionEnabled) {
		return plain
	}

	return (
		<Suspense fallback={plain}>
			<CreditCardTilt onClick={onFlip}>{visualContent}</CreditCardTilt>
		</Suspense>
	)
}
