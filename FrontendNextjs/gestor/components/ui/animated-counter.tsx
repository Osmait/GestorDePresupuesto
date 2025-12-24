'use client'

import CountUp from 'react-countup'

interface AnimatedCounterProps {
    value: number
    prefix?: string
    suffix?: string
    decimals?: number
    duration?: number
    className?: string
}

export function AnimatedCounter({
    value,
    prefix = '',
    suffix = '',
    decimals = 0,
    duration = 1,
    className
}: AnimatedCounterProps) {
    return (
        <span className={className}>
            <CountUp
                end={value}
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
