'use client'

import CountUp from 'react-countup'
import { type FormatCurrencyOptions, formatCurrency } from '@/lib/utils'

interface AnimatedCounterProps {
    value: number
    prefix?: string
    suffix?: string
    decimals?: number
    duration?: number
    className?: string
    /**
     * When set, the number is rendered as money through `formatCurrency`
     * (2 decimals, locale grouping, RD$/US$ symbol); `prefix`/`decimals` are ignored.
     */
    currency?: string | null
    /** App locale (`es` | `en`) used with `currency`. */
    locale?: string
    signDisplay?: FormatCurrencyOptions['signDisplay']
}

export function AnimatedCounter({
    value,
    prefix = '',
    suffix = '',
    decimals = 0,
    duration = 1,
    className,
    currency,
    locale,
    signDisplay,
}: AnimatedCounterProps) {
    const safeValue = Number.isFinite(value) ? value : 0

    if (currency) {
        return (
            <span className={className}>
                <CountUp
                    end={safeValue}
                    duration={duration}
                    decimals={2}
                    preserveValue={true}
                    formattingFn={(n) => `${formatCurrency(n, currency, { locale, signDisplay })}${suffix}`}
                />
            </span>
        )
    }

    return (
        <span className={className}>
            <CountUp
                end={safeValue}
                duration={duration}
                separator=","
                decimal="."
                decimals={decimals}
                prefix={prefix}
                suffix={suffix}
                preserveValue={true}
            />
        </span>
    )
}
