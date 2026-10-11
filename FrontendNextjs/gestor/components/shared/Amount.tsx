'use client'

import { useReducedMotion } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { AnimatedCounter } from '@/components/ui/animated-counter'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useAppLocale } from '@/lib/i18n/date-locale'
import { cn, DEFAULT_CURRENCY } from '@/lib/utils'

export type AmountTone = 'auto' | 'positive' | 'negative' | 'warning' | 'neutral'

const TONE_CLASS: Record<Exclude<AmountTone, 'auto'>, string> = {
	positive: 'text-success',
	negative: 'text-destructive',
	warning: 'text-warning',
	// Inherits the surrounding ink (e.g. a StatCard's tone).
	neutral: '',
}

/** Resolves `auto` from the sign: > 0 positive, < 0 negative, 0 neutral. */
export function resolveAmountTone(value: number, tone: AmountTone): Exclude<AmountTone, 'auto'> {
	if (tone !== 'auto') return tone
	const cents = Number.isFinite(value) ? Math.round(value * 100) : 0
	if (cents > 0) return 'positive'
	if (cents < 0) return 'negative'
	return 'neutral'
}

export interface AmountProps {
	/** Signed amount: income/inflow positive, expense/outflow negative. */
	value: number
	/** ISO code; empty/unknown falls back to DOP. */
	currency?: string | null
	/**
	 * Color. `neutral` (default) inherits the text color; `auto` follows the
	 * sign (green income / red expense); `positive`/`negative`/`warning` force it.
	 */
	tone?: AmountTone
	/** Always print the sign ("+RD$100.00" / "-RD$100.00"); zero stays unsigned. */
	signed?: boolean
	/** Adds an up/down arrow before the amount (hidden from screen readers; the sign is the text cue). */
	icon?: boolean
	/** Counts up to the value on mount/changes. Skipped when the user prefers reduced motion. */
	animate?: boolean
	className?: string
}

/**
 * Renders a money amount with the app's formatting (useFormatCurrency),
 * tabular figures and semantic color. The only sanctioned way to color money:
 * never use raw green/red classes for income/expense.
 *
 * @example
 * <Amount value={tx.type === 'bill' ? -tx.amount : tx.amount} currency={account.currency} tone='auto' signed icon />
 * <Amount value={account.balance} currency={account.currency} />
 */
export function Amount({
	value,
	currency,
	tone = 'neutral',
	signed = false,
	icon = false,
	animate = false,
	className,
}: AmountProps) {
	const formatCurrency = useFormatCurrency()
	const locale = useAppLocale()
	const reduceMotion = useReducedMotion()
	// Work in cents so a tiny negative (-0.004) prints and colors as a plain zero, never "-RD$0.00".
	const cents = Number.isFinite(value) ? Math.round(value * 100) : 0
	const shown = cents === 0 ? 0 : value
	const resolved = resolveAmountTone(shown, tone)
	const signDisplay = signed ? 'exceptZero' : 'auto'
	const direction = cents
	const Arrow = direction > 0 ? ArrowUpRight : direction < 0 ? ArrowDownRight : null

	return (
		<span
			data-tone={resolved}
			className={cn('inline-flex items-center gap-1 whitespace-nowrap tabular-nums', TONE_CLASS[resolved], className)}
		>
			{icon && Arrow ? <Arrow className='h-[1em] w-[1em] shrink-0' aria-hidden='true' /> : null}
			{animate && !reduceMotion ? (
				<AnimatedCounter
					value={shown}
					currency={currency || DEFAULT_CURRENCY}
					locale={locale}
					signDisplay={signDisplay}
				/>
			) : (
				formatCurrency(shown, currency, { signDisplay })
			)}
		</span>
	)
}
