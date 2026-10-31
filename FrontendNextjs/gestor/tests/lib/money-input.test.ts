import { describe, expect, it } from 'vitest'
import * as z from 'zod'
import {
	moneyInputToNumber,
	moneySchema,
	optionalMoneySchema,
	parseMoneyInput,
	toMoneyInputText,
} from '@/lib/money-input'

function value(input: unknown, decimals?: number) {
	const result = parseMoneyInput(input, decimals === undefined ? undefined : { decimals })
	return result.ok ? result.value : result.error
}

describe('parseMoneyInput', () => {
	it.each([
		['1500.50', 1500.5],
		['1500,50', 1500.5],
		['1,500.50', 1500.5],
		['1.500,50', 1500.5],
		['1500', 1500],
		['12,5', 12.5],
		['12.5', 12.5],
		['0,07', 0.07],
		[',5', 0.5],
		['1,500,000.25', 1500000.25],
		['1.500.000,25', 1500000.25],
		['1,500,000', 1500000],
		['1.500.000', 1500000],
		['  1 500,50 ', 1500.5],
		['1 500,50', 1500.5],
		['RD$1,500.00', 1500],
		['US$ 20', 20],
		['-50', -50],
		['-1.234,5', -1234.5],
		['-0', 0],
		['0', 0],
	])('parses %j as %d', (input, expected) => {
		expect(value(input)).toBe(expected)
	})

	describe('ambiguous single separator followed by 3 digits (es-DO rule)', () => {
		it('reads a comma as thousands', () => {
			expect(value('1,500')).toBe(1500)
			expect(value('12,345')).toBe(12345)
			expect(value('999,000')).toBe(999000)
		})

		it('reads a dot as the decimal mark', () => {
			expect(value('1.500')).toBe(1.5)
			expect(value('1.250', 8)).toBe(1.25)
		})

		it('reads a comma after a leading zero or 4+ digits as the decimal mark', () => {
			expect(value('0,750')).toBe(0.75)
			expect(value('0,125', 8)).toBe(0.125)
			expect(value('1500,500')).toBe(1500.5)
			expect(value('1234,567')).toBe('decimals')
		})
	})

	it('rejects empty input instead of returning 0', () => {
		expect(value('')).toBe('empty')
		expect(value('   ')).toBe('empty')
		expect(value(null)).toBe('empty')
		expect(value(undefined)).toBe('empty')
	})

	it.each([
		'abc',
		'12abc',
		'1e5',
		'1,50,000',
		'1.500,000.5',
		'1,5.50',
		'1500,',
		'1500.',
		'.',
		'-',
		'--5',
		'1-5',
		'1.2.3,4.5',
	])('rejects %j as invalid', (input) => {
		expect(value(input)).toBe('invalid')
	})

	it('rejects non-finite numbers and other types', () => {
		expect(value(Number.NaN)).toBe('invalid')
		expect(value(Number.POSITIVE_INFINITY)).toBe('invalid')
		expect(value({})).toBe('invalid')
	})

	it('allows at most 2 decimals by default, ignoring trailing zeros', () => {
		expect(value('1.005')).toBe('decimals')
		expect(value('0,001')).toBe('decimals')
		expect(value('1.50000')).toBe(1.5)
		expect(value(19.99)).toBe(19.99)
		expect(value(0.001)).toBe('decimals')
	})

	it('accepts more decimals when asked (quantities, rates)', () => {
		expect(value('0.00012345', 8)).toBe(0.00012345)
		expect(value('58,6543', 6)).toBe(58.6543)
		expect(value(1e-7, 8)).toBe(1e-7)
		expect(value('0.000000001', 8)).toBe('decimals')
	})

	it('parses numbers from the form defaults', () => {
		expect(value(1500.5)).toBe(1500.5)
		expect(value(100000)).toBe(100000)
		expect(value(-5000)).toBe(-5000)
	})
})

describe('moneyInputToNumber', () => {
	it('returns NaN for empty or invalid input', () => {
		expect(moneyInputToNumber('1500,50')).toBe(1500.5)
		expect(moneyInputToNumber('')).toBeNaN()
		expect(moneyInputToNumber('abc')).toBeNaN()
	})
})

describe('toMoneyInputText', () => {
	it('writes numbers without exponent or grouping', () => {
		expect(toMoneyInputText(1500.5)).toBe('1500.5')
		expect(toMoneyInputText(1e-7)).toBe('0.0000001')
		expect(toMoneyInputText(1e21)).toBe('1000000000000000000000')
		expect(toMoneyInputText(Number.NaN)).toBe('')
		expect(toMoneyInputText(null)).toBe('')
		expect(toMoneyInputText('12,5')).toBe('12,5')
	})

	it('round-trips through the parser', () => {
		for (const n of [0, 0.07, 19.99, 1500.5, 1234567.89]) {
			expect(value(toMoneyInputText(n))).toBe(n)
		}
	})
})

describe('moneySchema', () => {
	const schema = moneySchema({ required: 'required', invalid: 'invalid', decimals: 'decimals' }).pipe(
		z.number().min(0.01, 'min'),
	)

	function issues(input: unknown) {
		const result = schema.safeParse(input)
		return result.success ? result.data : result.error.issues.map((issue) => issue.message)
	}

	it('outputs the parsed number', () => {
		expect(issues('1500,50')).toBe(1500.5)
		expect(issues(25)).toBe(25)
	})

	it('reports empty, invalid and over-precise input with its message', () => {
		expect(issues('')).toEqual(['required'])
		expect(issues('abc')).toEqual(['invalid'])
		expect(issues('1.005')).toEqual(['decimals'])
		expect(issues('0')).toEqual(['min'])
	})

	it('falls back to the required message', () => {
		const minimal = moneySchema({ required: 'required' })
		const result = minimal.safeParse('abc')
		expect(result.success).toBe(false)
		expect(result.error?.issues[0].message).toBe('required')
	})
})

describe('optionalMoneySchema', () => {
	const schema = optionalMoneySchema({ invalid: 'invalid', decimals: 'decimals' })

	it('maps empty input to undefined', () => {
		expect(schema.parse('')).toBeUndefined()
		expect(schema.parse(undefined)).toBeUndefined()
		expect(schema.parse('12,5')).toBe(12.5)
	})

	it('still rejects garbage', () => {
		const result = schema.safeParse('abc')
		expect(result.success).toBe(false)
		expect(result.error?.issues[0].message).toBe('invalid')
	})
})
