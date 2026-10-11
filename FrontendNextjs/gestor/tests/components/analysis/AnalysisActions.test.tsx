import { fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AnalysisActions, switchPeriodMode } from '@/components/analysis/AnalysisActions'
import { buildExportSnapshot } from '@/components/analysis/analysis-export'
import { renderWithIntl } from '../../utils/intl'
import { makeReport, TODAY } from './fixtures'

const search = vi.hoisted(() => ({ value: '' }))

vi.mock('next/navigation', () => ({
	useSearchParams: () => new URLSearchParams(search.value),
	usePathname: () => '/app/analysis',
}))

vi.mock('@/hooks/queries/useAccountsQuery', () => ({
	useGetAccounts: () => ({ data: [{ id: 'acc-1', name: 'Checking' }] }),
}))

vi.mock('@/components/analysis/useAnalysisReport', async (importOriginal) => ({
	...(await importOriginal<object>()),
	useAnalysisReport: () => ({ report: null }),
}))

function desktop() {
	// Mobile and desktop controls are both in the DOM (CSS picks one); the desktop row is the last one.
	const groups = screen.getAllByRole('group', { name: 'Period' })
	return groups[groups.length - 1].parentElement as HTMLElement
}

describe('AnalysisActions', () => {
	let replaceState: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'] })
		vi.setSystemTime(new Date(2026, 9, 11, 12))
		search.value = ''
		replaceState = vi.spyOn(window.history, 'replaceState')
	})

	afterEach(() => {
		vi.useRealTimers()
		replaceState.mockRestore()
	})

	it('defaults to the current month and cannot go past it', () => {
		renderWithIntl(<AnalysisActions />)
		const row = desktop()

		expect(within(row).getByText('October 2026')).toBeInTheDocument()
		expect(within(row).getByRole('button', { name: 'Next month' })).toBeDisabled()
		expect(within(row).getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')
	})

	it('moves to the previous month through the URL', () => {
		renderWithIntl(<AnalysisActions />)
		fireEvent.click(within(desktop()).getByRole('button', { name: 'Previous month' }))
		expect(replaceState).toHaveBeenCalledWith(null, '', '/app/analysis?period=2026-09')
	})

	it('keeps the account when stepping and enables "next" for a past month', () => {
		search.value = 'period=2026-01&account=acc-1'
		renderWithIntl(<AnalysisActions />)
		const row = desktop()

		expect(within(row).getByText('January 2026')).toBeInTheDocument()
		fireEvent.click(within(row).getByRole('button', { name: 'Previous month' }))
		expect(replaceState).toHaveBeenCalledWith(null, '', '/app/analysis?period=2025-12&account=acc-1')
		fireEvent.click(within(row).getByRole('button', { name: 'Next month' }))
		expect(replaceState).toHaveBeenLastCalledWith(null, '', '/app/analysis?period=2026-02&account=acc-1')
	})

	it('switches to year mode', () => {
		renderWithIntl(<AnalysisActions />)
		fireEvent.click(within(desktop()).getByRole('button', { name: 'Year' }))
		expect(replaceState).toHaveBeenCalledWith(null, '', '/app/analysis?period=2026')
	})

	it('has no floating tools and no dead search filter', () => {
		renderWithIntl(<AnalysisActions />)
		expect(screen.queryByRole('button', { name: /tools/i })).not.toBeInTheDocument()
		expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
		expect(within(desktop()).getByRole('combobox', { name: 'Account' })).toBeInTheDocument()
		expect(within(desktop()).getByRole('button', { name: 'Export' })).toBeInTheDocument()
	})
})

describe('switchPeriodMode', () => {
	it('keeps the user near the period they were looking at', () => {
		expect(switchPeriodMode({ mode: 'month', year: 2025, month: 4 }, 'year', TODAY)).toEqual({
			mode: 'year',
			year: 2025,
		})
		expect(switchPeriodMode({ mode: 'year', year: 2025 }, 'month', TODAY)).toEqual({
			mode: 'month',
			year: 2025,
			month: 12,
		})
		expect(switchPeriodMode({ mode: 'month', year: 2026, month: 10 }, 'range', TODAY)).toEqual({
			mode: 'range',
			from: '2026-10-01',
			to: '2026-10-11',
		})
	})
})

describe('buildExportSnapshot', () => {
	it('rounds every amount to cents', () => {
		const snapshot = buildExportSnapshot(makeReport(), 'acc-1', new Date('2026-10-11T12:00:00Z'))
		const { generated_at: _timestamp, ...numbers } = snapshot
		expect(JSON.stringify(numbers)).not.toMatch(/\d\.\d{3,}/)
		expect(snapshot.period).toMatchObject({ mode: 'month', from: '2026-10-01', to: '2026-10-11' })
		expect(snapshot.totals.expense_change_percent).toBe(1.67)
		expect(snapshot.fixed_variable).toEqual({ fixed: 45000, variable: 25100 })
		expect(snapshot.account_id).toBe('acc-1')
	})
})
