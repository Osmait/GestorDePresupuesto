'use client'
import { CreditCard as CreditCardIcon } from 'lucide-react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { getProgressTone, Progress } from '@/components/ui/progress'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useFormatPercent } from '@/hooks/useFormatPercent'
import { cn } from '@/lib/utils'
import { CardBalance } from '@/types/creditcard'

/** Same thresholds as the credit card page: watch above 30%, high risk above 60%. */
const UTILIZATION_THRESHOLDS = { warningAt: 30, dangerAt: 60 }

interface CardDebtCardProps {
	name: string
	bank: string
	/** One row per card currency; `current_balance` is negative while the card owes money. */
	balances: Pick<CardBalance, 'currency' | 'current_balance' | 'credit_limit'>[]
}

/**
 * A credit card as debt ("You owe RD$X", share of the limit), not as a
 * negative account balance. Read-only; links to the credit card page.
 */
export function CardDebtCard({ name, bank, balances }: CardDebtCardProps) {
	const t = useTranslations('creditCards.item')
	const formatCurrency = useFormatCurrency()
	const formatPercent = useFormatPercent()

	return (
		<Card className='relative transition-colors hover:bg-muted/40 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring has-[a:focus-visible]:ring-offset-2 has-[a:focus-visible]:ring-offset-background'>
			<CardContent className='space-y-4 p-5'>
				<div className='flex min-w-0 items-center gap-3'>
					<span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted'>
						<CreditCardIcon className='h-5 w-5 text-muted-foreground' aria-hidden='true' />
					</span>
					<div className='min-w-0'>
						<Link
							href='/app/credit-cards'
							className='block truncate text-base font-semibold text-foreground focus-visible:outline-none after:absolute after:inset-0'
						>
							{name}
						</Link>
						<p className='truncate text-sm text-muted-foreground'>{bank}</p>
					</div>
				</div>
				<ul className='space-y-3'>
					{balances.map((b) => {
						const debt = -b.current_balance
						const usedPercent = b.credit_limit > 0 ? (Math.max(debt, 0) / b.credit_limit) * 100 : 0
						const tone = getProgressTone(usedPercent, UTILIZATION_THRESHOLDS)
						return (
							<li key={b.currency} className='space-y-1.5'>
								<p
									className={cn(
										'text-xl font-semibold tracking-tight tabular-nums',
										debt > 0 ? 'text-destructive' : 'text-success',
									)}
								>
									{debt > 0
										? t('owes', { amount: formatCurrency(debt, b.currency) })
										: debt < 0
											? t('inFavor', { amount: formatCurrency(-debt, b.currency) })
											: t('noDebt')}
								</p>
								{b.credit_limit > 0 ? (
									<>
										<Progress value={Math.min(usedPercent, 100)} tone={tone} className='h-1.5' />
										<p className='text-xs text-muted-foreground'>
											{t('limitUsed', {
												percent: formatPercent(usedPercent),
												limit: formatCurrency(b.credit_limit, b.currency),
											})}
										</p>
									</>
								) : null}
							</li>
						)
					})}
				</ul>
			</CardContent>
		</Card>
	)
}
