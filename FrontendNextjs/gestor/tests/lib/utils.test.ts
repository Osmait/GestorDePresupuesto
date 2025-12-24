import { cn, formatCurrency } from '@/lib/utils'
import { describe, it, expect } from 'vitest'

describe('lib/utils', () => {
    describe('cn (class name merger)', () => {
        it('merges class names', () => {
            expect(cn('foo', 'bar')).toBe('foo bar')
        })

        it('handles conditional classes', () => {
            expect(cn('foo', true && 'bar', false && 'baz')).toBe('foo bar')
        })

        it('handles arrays', () => {
            expect(cn(['foo', 'bar'])).toBe('foo bar')
        })

        it('resolves Tailwind conflicts (last wins)', () => {
            // tailwind-merge resolves conflicts
            expect(cn('p-2', 'p-4')).toBe('p-4')
            expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
        })

        it('handles empty inputs', () => {
            expect(cn()).toBe('')
            expect(cn('')).toBe('')
            expect(cn(null, undefined)).toBe('')
        })
    })

    describe('formatCurrency', () => {
        it('formats positive numbers', () => {
            expect(formatCurrency(1234.56)).toBe('$1,234.56')
        })

        it('formats zero', () => {
            expect(formatCurrency(0)).toBe('$0.00')
        })

        it('formats negative numbers', () => {
            expect(formatCurrency(-500.99)).toBe('-$500.99')
        })

        it('formats large numbers with commas', () => {
            expect(formatCurrency(1000000)).toBe('$1,000,000.00')
        })

        it('rounds to 2 decimal places', () => {
            expect(formatCurrency(10.999)).toBe('$11.00')
            expect(formatCurrency(10.001)).toBe('$10.00')
        })
    })
})
